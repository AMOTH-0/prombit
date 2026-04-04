const { improvePrompt } = require('../lib/deepseek');
const { Redis } = require('@upstash/redis');
const { hashIdentifier } = require('../lib/hash');
const { isDenylisted } = require('../lib/denylist');
const { trackAnomaly } = require('../lib/anomaly');
const { triggerBudgetAlertOnce } = require('../lib/alerts');
const { safeTelemetryEvent } = require('../lib/telemetry');

// Initialize Redis if env vars are present
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) 
  ? Redis.fromEnv() 
  : null;

// ─── Budget Constants (Nano-dollars: 1 USD = 1,000,000,000 nUSD) ───────────
const COST_IN_NANO_PER_TOKEN = 140;   // $0.14 per 1M tokens
const COST_OUT_NANO_PER_TOKEN = 280;  // $0.28 per 1M tokens
const MAX_BUDGET_NANO = 5_000_000_000; // $5.00 strict daily limit
const MAX_MONTHLY_BUDGET_NANO = 25_000_000_000; // $25.00 strict monthly limit
const MAX_RESERVATION_NANO = Math.ceil((1200 * COST_IN_NANO_PER_TOKEN) + (1000 * COST_OUT_NANO_PER_TOKEN));

// ─── Category-specific system prompts ─────────────────────────────────────
const SYSTEM_PROMPT = `You are Prombit, an expert prompt engineer. Your job is to rewrite a user's raw prompt into a cleaner, more effective version that gets better results from AI.

## Core principle
The improved prompt must be PROPORTIONAL to the original.
- Short vague prompt → short structured prompt (sharpen the intent, do not invent details)
- Medium prompt with some context → medium prompt with better structure
- Long detailed prompt → long prompt with improved clarity and format
NEVER add fictional details, invented roles, made-up constraints, or assumed context that is not present or clearly implied in the original.

## What you are allowed to add
Only add elements that are DIRECTLY IMPLIED by what the user wrote:
- If the user mentions "professional email" → tone is implied (formal)
- If the user mentions "Python" → language is known
- If the user mentions "for my boss" → audience is implied
- If the user mentions "short" → length constraint is implied
If none of these signals exist in the original prompt, DO NOT add them.

## The 4 levels of improvement (choose based on input length and detail)

### Level 1 — Micro prompt (1-5 words, very vague)
The user has given almost no information.
Goal: Clarify intent and add minimal structure. Keep it short.
Do NOT add: roles, company context, technical stack, format specs, or constraints.
Only do: rephrase to be clearer and more actionable.
Example:
  Input: "fix my code"
  Output: "Review the following code, identify any bugs or issues, and provide the corrected version with a brief explanation of what was changed."

### Level 2 — Short prompt (1-2 sentences, some intent)
The user has given a clear topic but missing structure.
Goal: Add the missing structural element (role OR format OR scope — pick the most useful ONE).
Do NOT add multiple new elements. One improvement only.
Example:
  Input: "write me a cover letter"
  Output: "Write a professional cover letter for a job application. Use a formal tone, keep it to 3 paragraphs: opening hook, relevant experience, and call to action."

### Level 3 — Medium prompt (2-4 sentences, decent context)
The user has intent, topic, and some context.
Goal: Reorganize for clarity. Add structure, fix ambiguity, specify output format if missing.
Only add elements clearly implied by what is already there.
Example:
  Input: "I need a landing page for my SaaS tool that helps developers track API costs. Make it look modern."
  Output: "Design a modern landing page for a SaaS developer tool that tracks API costs. Include: a headline that communicates the value proposition, a features section (3-4 items), a pricing teaser, and a CTA button. Use a clean, technical aesthetic suitable for a developer audience."

### Level 4 — Detailed prompt (already has role, context, format)
The user has given substantial information.
Goal: Polish and sharpen only. Remove ambiguity. Fix structure. Do not add new content.
If the prompt is already excellent, return it unchanged.

## Hard rules
- Return ONLY the improved prompt. No preamble, no explanation, no "Here is the improved version:" prefix.
- Never invent: company names, tech stacks, team sizes, locations, industries, specific numbers, or named frameworks unless the user mentioned them.
- Never add constraints the user didn't ask for (e.g. "under 500 words" when they didn't mention length).
- Never add a persona/role unless the user's prompt implies one (e.g. "as a doctor" is implied if they mention a medical topic professionally).
- The improved prompt should sound like it came from the user — not from a prompt engineering textbook.
- Match the user's language exactly. If they wrote in Korean, output in Korean. If Japanese, output in Japanese. Always match their language.
- When in doubt, do less. A slightly improved short prompt beats a hallucinated long one every time.`;

// ─── Rate Limit Helper ─────────────────────────────────────────────────────

async function checkRedisRateLimit(ip) {
  if (!redis) return true; 
  const minKey = `prombit:req:min:${ip}`;
  const hrKey  = `prombit:req:hr:${ip}`;
  const dayKey = `prombit:req:day:${ip}`;
  const globalHrKey = `prombit:global:hr`;

  try {
    const [minHits, hrHits, dayHits, globalHits] = await redis.pipeline()
      .incr(minKey).incr(hrKey).incr(dayKey).incr(globalHrKey)
      .expire(minKey, 60, { nx: true }).expire(hrKey, 3600, { nx: true }).expire(dayKey, 86400, { nx: true }).expire(globalHrKey, 3600, { nx: true })
      .exec();

    // 15/min, 50/hour, 200/day
    if (minHits > 15 || hrHits > 50 || dayHits > 200) return false; 
    
    // Global bucket breaker
    if (globalHits > 5000) {
      console.error('[SECURITY] GLOBAL RATE LIMIT EXCEEDED. CIRCUIT BREAKER TRIPPED.');
      return false;
    }
    return true;
  } catch (err) { return true; } // Fail gracefully
}

// ─── Main Handler ──────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method Not Allowed' });

  const dateStr = new Date().toISOString().split('T')[0];
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || 'unknown');
  const ua = req.headers['user-agent'] || '';
  
  // Create an untraceable but persistent fingerprint for the source
  const hashedSource = hashIdentifier(`${rawIp}|${ua}`);

  let telemetryStatus = 'upstream_fail';
  let actualCostNano = 0;
  let inTokens = 0;
  let outTokens = 0;
  let promptLength = 0;
  let budgetKey = `prombit:cost:usd:${dateStr}`;
  let monthlyBudgetKey = `prombit:cost:usd:${dateStr.substring(0, 7)}`; // "2026-04"
  let newTotalNano = 0;
  let newMonthlyNano = 0;

  const fail = async (statusCode, errorCode, statusString) => {
    telemetryStatus = statusString;
    return res.status(statusCode).json({ success: false, error: errorCode });
  };

  try {
    // 1. Kill Switch & Emergency Override
    if (process.env.KILL_SWITCH === 'true' || process.env.FORCE_DISABLE === 'true') {
      return fail(503, 'SERVICE_DISABLED_MANUALLY', 'budget_locked');
    }

    // 2. Denylist Check
    if (await isDenylisted(redis, hashedSource)) {
      return fail(403, 'FORBIDDEN_SOURCE', 'denylisted');
    }

    // 3. Strict Origin Validation
    const origin = req.headers.origin || '';
    if (!origin.startsWith('chrome-extension://') && !origin.includes('localhost')) {
      return fail(403, 'FORBIDDEN_ORIGIN', 'blocked');
    }

    // 4. Rate Limiting
    if (!(await checkRedisRateLimit(hashedSource))) {
      return fail(429, 'RATE_LIMITED', 'rate_limited');
    }

    // 5. Schema & Validation
    const { prompt } = req.body || {};
    let { siteCategory = 'UNKNOWN_AI', siteUrl = '' } = req.body || {};

    if (typeof siteCategory !== 'string' || siteCategory.length > 50) return fail(400, 'PAYLOAD_TOO_LARGE', 'validation_fail');
    if (typeof siteUrl !== 'string' || siteUrl.length > 500) return fail(400, 'PAYLOAD_TOO_LARGE', 'validation_fail');

    if (!prompt || typeof prompt !== 'string') return fail(400, 'PROMPT_MISSING', 'validation_fail');
    
    const trimmedPrompt = prompt.trim();
    promptLength = trimmedPrompt.length;

    if (promptLength < 3) return fail(400, 'PROMPT_TOO_SHORT', 'validation_fail');
    if (promptLength > 4000) return fail(400, 'PROMPT_TOO_LONG', 'validation_fail');

    // 6. Heuristics
    const blocklist = /ignore all prior|ignore all previous|disregard.{0,50}instructions|forget everything|system prompt|you are a helpful assistant|bypass|jailbreak/i;
    if (blocklist.test(trimmedPrompt)) {
      return fail(400, 'PROMPT_POLICY_VIOLATION', 'blocked');
    }

    // 7. Atomic Budget Pre-Reservation (Daily + Monthly)
    if (redis) {
      try {
        const [monthVal, dayVal] = await redis.pipeline()
          .incrby(monthlyBudgetKey, MAX_RESERVATION_NANO)
          .incrby(budgetKey, MAX_RESERVATION_NANO)
          .expire(monthlyBudgetKey, 86400 * 60, { nx: true }) // 60 days
          .expire(budgetKey, 86400, { nx: true })
          .exec();
          
        newMonthlyNano = Number(monthVal) || 0;
        newTotalNano = Number(dayVal) || 0;
        
        if (newTotalNano > MAX_BUDGET_NANO || newMonthlyNano > MAX_MONTHLY_BUDGET_NANO) {
          await redis.pipeline()
            .decrby(budgetKey, MAX_RESERVATION_NANO)
            .decrby(monthlyBudgetKey, MAX_RESERVATION_NANO)
            .exec();
          return fail(503, 'SERVICE_DISABLED_BUDGET_EXCEEDED', 'budget_locked');
        }
        
        // Alerts exactly once per threshold
        if (newTotalNano >= MAX_BUDGET_NANO) {
          triggerBudgetAlertOnce(redis, dateStr, 100, newTotalNano, MAX_BUDGET_NANO);
        } else if (newTotalNano > MAX_BUDGET_NANO * 0.8) {
          triggerBudgetAlertOnce(redis, dateStr, 80, newTotalNano, MAX_BUDGET_NANO);
        } else if (newTotalNano > MAX_BUDGET_NANO * 0.5) {
          triggerBudgetAlertOnce(redis, dateStr, 50, newTotalNano, MAX_BUDGET_NANO);
        }
      } catch (e) {
        return fail(500, 'BUDGET_CHECK_UNAVAILABLE', 'upstream_fail');
      }
    }

    // 8. Build Prompt & Execute
    const systemPrompt = siteUrl
      ? `${SYSTEM_PROMPT}\n\nThis prompt is being written for: ${siteUrl}\nApply your knowledge of how prompts work best on this specific platform, including any platform-specific syntax, parameters, or conventions.`
      : SYSTEM_PROMPT;

    const result = await improvePrompt(trimmedPrompt, systemPrompt);
    
    inTokens = result.usage?.prompt_tokens || 0;
    outTokens = result.usage?.completion_tokens || 0;
    actualCostNano = Math.ceil((inTokens * COST_IN_NANO_PER_TOKEN) + (outTokens * COST_OUT_NANO_PER_TOKEN));
    
    // Sucess
    telemetryStatus = 'ok';
    return res.status(200).json({ success: true, improvedPrompt: result.content });

  } catch (error) {
    // Scrub logs: DO NOT log error.message because upstream SDK embeds PII (raw prompt text) on validation errors
    console.error('[SERVER ERROR]', error.name || error.code || error.status || 'UNKNOWN');
    telemetryStatus = 'upstream_fail';
    return res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  } finally {
    // 9. Mandatory Budget Refund Adjustment
    if (redis && newTotalNano > 0 && newMonthlyNano > 0) {
      const unusedReserve = MAX_RESERVATION_NANO - actualCostNano;
      if (unusedReserve > 0 && !isNaN(unusedReserve)) {
        await redis.pipeline()
          .decrby(budgetKey, unusedReserve)
          .decrby(monthlyBudgetKey, unusedReserve)
          .exec();
      }
    }

    // 10. Asynchronous Telemetry & Anomaly Processing (does not block HTTP response)
    trackAnomaly(redis, hashedSource, telemetryStatus).catch(console.error);
    safeTelemetryEvent(redis, {
      dateStr, status: telemetryStatus, costNano: actualCostNano, 
      inTokens, outTokens, promptLength, hashedSource
    }).catch(console.error);
  }
};
