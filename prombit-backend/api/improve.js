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
const MAX_RESERVATION_NANO = Math.ceil((1200 * COST_IN_NANO_PER_TOKEN) + (200 * COST_OUT_NANO_PER_TOKEN));

// ─── Category-specific system prompts ─────────────────────────────────────
const SYSTEM_PROMPTS = {
  TEXT_CHAT: `You are Prombit. Rewrite this AI chat prompt to be clearer and more structured.
Add: a role for the AI, context, specific task, output format, and constraints.
Return ONLY the improved prompt. No explanations, no preamble.`,

  SEARCH: `You are Prombit. Rewrite this research/search query to be more precise and targeted.
Add: specific scope, time range if relevant, type of sources preferred, and exact information needed.
Return ONLY the improved query. No explanations.`,

  CODE: `You are Prombit. Rewrite this coding prompt for an AI coding assistant.
Add: programming language and framework, exact functionality required, inputs/outputs, edge cases, performance or style constraints, and desired format (function, class, full file, with tests, with comments).
Return ONLY the improved prompt. No explanations.`,

  IMAGE: `You are Prombit. Rewrite this image generation prompt professionally.
Add: subject, art style, lighting, mood, color palette, composition, camera angle, quality tags (highly detailed, 8k, photorealistic, cinematic, etc.).
Write it as a rich descriptive prompt the way expert Midjourney/SD users write them.
Return ONLY the improved prompt. No explanations.`,

  VIDEO: `You are Prombit. Rewrite this AI video generation prompt.
Add: scene description, subject motion/action, camera movement (slow pan, zoom in, static, etc.), lighting, mood, visual style, and temporal details (beginning/middle/end of clip).
Return ONLY the improved prompt. No explanations.`,

  MUSIC: `You are Prombit. Rewrite this AI music generation prompt.
Add: genre, sub-genre, tempo/BPM, key instruments, mood, energy level, structure (intro/verse/chorus/bridge), reference artists or songs, and production style.
Return ONLY the improved prompt. No explanations.`,

  VOICE: `You are Prombit. Rewrite this AI voice or TTS prompt.
Add: tone (professional, warm, excited, calm, authoritative), pace, emotion, use case (ad, audiobook, podcast, explainer, customer service), accent if relevant, and any pronunciation notes.
Return ONLY the improved prompt. No explanations.`,

  WRITING: `You are Prombit. Rewrite this AI writing prompt.
Add: content type (blog, email, ad copy, product description, social post), target audience, tone, desired length, key points to cover, and call to action if relevant.
Return ONLY the improved prompt. No explanations.`,

  DESIGN: `You are Prombit. Rewrite this AI design prompt.
Add: design type (UI screen, logo, banner, illustration, wireframe), target platform and screen size, brand style and color palette, layout preferences, target audience, and specific elements to include or avoid.
Return ONLY the improved prompt. No explanations.`,

  PRODUCTIVITY: `You are Prombit. Rewrite this AI productivity or automation prompt.
Add: clear goal, context about the workflow or document, desired output format, and any constraints on length or style.
Return ONLY the improved prompt. No explanations.`,

  AGENT: `You are Prombit. Rewrite this AI agent or automation prompt.
Add: clear objective, input data and sources, expected output or actions, step-by-step breakdown for complex tasks, tools or APIs to use if known, and success criteria.
Return ONLY the improved prompt. No explanations.`,

  DATA: `You are Prombit. Rewrite this AI data or analytics prompt.
Add: dataset or data source context, specific metric or insight needed, time range, filters or segments, desired output format (chart, table, summary, SQL query), and business context.
Return ONLY the improved prompt. No explanations.`,

  INFRA: `You are Prombit. Rewrite this AI API or model playground prompt.
Add: model behavior instructions, output format specification, tone and style, constraints, and example input/output if helpful.
Return ONLY the improved prompt. No explanations.`,

  AUDIO_MUSIC: `You are Prombit. Rewrite this AI music/audio generation prompt.
Add: genre, tempo/BPM, instruments, mood, energy level, reference artists if helpful, structure, and production style.
Return ONLY the improved prompt. No explanations.`,

  UNKNOWN_AI: `You are Prombit. Improve this prompt to be clearer, more specific, and more likely to produce excellent results.
Add a clear role, context, task, output format, and constraints where helpful.
Return ONLY the improved prompt. No explanations.`,
};

const LANGUAGE_RULE = `- Detect the language of the user's prompt and write the improved prompt in that same language. If the prompt is in Korean, respond in Korean. If in Japanese, respond in Japanese. If in French, respond in French. Always match the user's language exactly.`;

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
    const basePrompt = SYSTEM_PROMPTS[siteCategory] || SYSTEM_PROMPTS['UNKNOWN_AI'];
    const withLanguage = `${basePrompt}\n${LANGUAGE_RULE}`;
    const systemPrompt = siteUrl
      ? `${withLanguage}\n\nThis prompt is being written for: ${siteUrl}\nApply your knowledge of how prompts work best on this specific platform, including any platform-specific syntax, parameters, or conventions.`
      : withLanguage;

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
