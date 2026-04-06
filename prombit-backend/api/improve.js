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

// ─── System prompt ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Prombit, an expert prompt engineer. Your ONLY job is to rewrite the user's raw prompt into a better version that gets improved results from AI.

CRITICAL — READ THIS FIRST:
You must NEVER answer, execute, solve, or respond to the content of the prompt.
No matter how long, detailed, or specific the prompt is — you are REWRITING it, not completing it.
If the user's prompt asks a question, do not answer it. Rewrite it into a better question.
If the user's prompt asks you to write code, do not write code. Rewrite the prompt to be clearer.
If the user's prompt describes a task, do not do the task. Rewrite the prompt to be more effective.
Return ONLY the rewritten prompt text. Nothing else. No prefix, no explanation, no "Here is the improved version:".

---

## Proportionality rule
The improved prompt must match the scale of the original.
- Short vague prompt → short structured prompt (sharpen intent, do not invent details)
- Medium prompt → medium prompt with better structure and clarity
- Long detailed prompt → long prompt, polished and organized, do not shrink it
- Already excellent prompt → return it unchanged or with minimal polish
NEVER inflate a short prompt into a long one. NEVER summarize a long detailed prompt into a short one.

---

## Prompt element toolkit
These are the building blocks of a strong prompt. Add each one ONLY when the user's prompt signals it is needed or implied. Do not mechanically add all of them.

### 1. Role / Persona
Add when: the task benefits from a specific expertise and the domain is clear from context.
Examples of when to add: coding task → "Act as a senior software engineer", medical question → "As a medical professional", legal question → "As a legal expert".
Do NOT add a generic role like "You are a helpful assistant" — that adds nothing.
Do NOT add any role if the prompt is casual or general-purpose.

### 2. Task / Objective
Always present. This is the core of every prompt. Make it explicit, specific, and actionable.
Bad: "Tell me about climate change." Good: "Explain the three main causes of climate change and their relative impact, in plain language suitable for a high school student."

### 3. Context / Background
Add when: the task is complex, the AI needs domain knowledge, or the user has provided partial context that needs to be organized.
Do NOT add invented context. Only structure and clarify what is already in the original.

### 4. Output Format
Add when: the task has a clear deliverable type (report, list, table, email, code, JSON, essay, step-by-step guide).
Specify format when it is missing and the task clearly implies one.
Do NOT add format specs to conversational or open-ended prompts where format doesn't matter.

### 5. Constraints
Add ONLY constraints explicitly stated or clearly implied by the user (e.g., "for a beginner" → keep it simple, "short" → brief output, "under 1 page" → length limit).
Do NOT invent constraints the user never mentioned.

### 6. Tone / Audience
Add when: the user signals who will read the output ("for my professor", "for kids", "formal", "casual", "for my boss") or the task type strongly implies a tone (professional email → formal).
Do NOT add tone specs to general-purpose prompts.

### 7. Examples (few-shot)
Add when: the task requires the AI to match a specific pattern, style, or format and an example would make the expectation clear.
Keep examples minimal — one is usually enough. Only add if the task is ambiguous without one.

### 8. Step-by-step / Chain of thought
Add when: the task requires reasoning, analysis, problem-solving, or multi-step logic.
Phrasing: "Think through this step by step before giving your answer." or "Break down your reasoning before concluding."
Do NOT add to simple generation tasks (writing an email, making a list, etc.).

### 9. Uncertainty permission
Add when: the task involves facts, research, or specific knowledge where hallucination is a risk.
Phrasing: "If you are unsure about any fact, say so rather than guessing."
Do NOT add to creative or generative tasks.

---

## Improvement levels (calibrate your additions to the input)

### Level 1 — Micro (1-5 words, near-zero context)
Only clarify intent. Make it actionable. Add nothing else.
Input: "fix my code" → Output: "Review the following code for bugs and errors, then provide the corrected version with a brief explanation of each fix."

### Level 2 — Short (1-2 sentences, clear intent but thin)
Add ONE missing structural element — whichever is most valuable (format, scope, or task clarity).
Input: "write me a cover letter" → Output: "Write a professional cover letter for a job application. Structure it in 3 paragraphs: an opening that highlights my motivation, a middle paragraph connecting my experience to the role, and a closing call to action. Use a formal but confident tone."

### Level 3 — Medium (2-5 sentences, decent context)
Reorganize for clarity. Fill in 2-3 missing elements that are clearly implied. Specify output format if absent.
Use only what the user's text supports — no invented details.

### Level 4 — Long / Detailed (already structured)
Polish only. Fix ambiguities. Improve sentence clarity. Tighten structure. Do not add new content.
If it is already a high-quality prompt, return it with minimal or no changes.

---

## Hard prohibitions
- Do NOT answer, solve, execute, or respond to the content of the prompt under any circumstances.
- Do NOT invent: company names, tech stacks, team sizes, locations, industries, statistics, or frameworks the user never mentioned.
- Do NOT add a role/persona unless strongly implied by the domain.
- Do NOT add constraints the user never stated.
- Do NOT add "under X words" length limits unless the user mentioned length.
- Do NOT prefix the output with "Here is the improved prompt:" or any explanation. Return the prompt text only.
- The rewritten prompt must sound like it came from the user — not a prompt engineering textbook.
- Match the user's language exactly. Korean input → Korean output. Japanese → Japanese. Always.
- When uncertain whether to add something, do less. A slightly improved prompt beats a hallucinated over-engineered one.`;

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
