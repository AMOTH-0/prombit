const { improvePrompt } = require('../lib/deepseek');
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

// ─── Constants & Configuration ─────────────────────────────────────────────

const CLIENT_SECRET = process.env.PROMBIT_CLIENT_SECRET || 'pr0mb1t_h4rd3n3d_x92k_2026';

// Initialize Redis if env vars are present (Upstash generates these in Vercel)
const redis = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) 
  ? Redis.fromEnv() 
  : null;

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


// ─── Security Helpers ──────────────────────────────────────────────────────

function verifySignature(payload, timeHeader, nonceHeader, sigHeader) {
  if (!timeHeader || !nonceHeader || !sigHeader) return false;
  
  // Reject if older than 5 minutes (300,000 ms)
  const reqTime = parseInt(timeHeader, 10);
  if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 300000) return false;

  const dataToSign = timeHeader + nonceHeader + payload;
  const expectedSig = crypto.createHmac('sha256', CLIENT_SECRET).update(dataToSign).digest('hex');
  
  // Prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(sigHeader));
  } catch (err) {
    return false; // length mismatch throws an error
  }
}

async function verifyNonce(nonce) {
  if (!redis) return true; // Fail gracefully if Redis is unsupported
  try {
    const key = `prombit:nonce:${nonce}`;
    // sets key only if it doesn't exist, expires in 5 mins
    const success = await redis.set(key, '1', { nx: true, ex: 300 }); 
    return (success === 'OK' || success === 1 || success === true);
  } catch (err) {
    console.warn('[REDIS] Nonce error:', err.message);
    return true; // Fail graceful
  }
}

async function checkRedisRateLimit(ip) {
  if (!redis) return true; 
  
  const minKey = `prombit:req:min:${ip}`;
  const hrKey  = `prombit:req:hr:${ip}`;
  const dayKey = `prombit:req:day:${ip}`;

  try {
    // Pipeline increments and set expiry logic natively.
    const [minHits, hrHits, dayHits] = await redis.pipeline()
      .incr(minKey)
      .incr(hrKey)
      .incr(dayKey)
      .expire(minKey, 60, { nx: true })
      .expire(hrKey, 3600, { nx: true })
      .expire(dayKey, 86400, { nx: true })
      .exec();

    // 15/min, 50/hour, 200/day
    if (minHits > 15 || hrHits > 50 || dayHits > 200) {
      return false; // Rate limited
    }
    return true;
  } catch (err) {
    console.warn('[REDIS] Rate limit error:', err.message);
    return true; // Fail gracefully
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Kill Switch
  if (process.env.KILL_SWITCH === 'true') {
    return res.status(503).json({ success: false, error: 'SERVICE_UNAVAILABLE' });
  }

  // 2. Strict Origin Validation
  const origin = req.headers.origin || '';
  if (!origin.startsWith('chrome-extension://') && !origin.includes('localhost')) {
    return res.status(403).json({ success: false, error: 'FORBIDDEN_ORIGIN' });
  }

  try {
    // 3. HMAC Auth & Replay Prevention
    const sigHeader   = req.headers['x-prombit-sig'];
    const timeHeader  = req.headers['x-prombit-time'];
    const nonceHeader = req.headers['x-prombit-nonce'];
    
    // Reproduce original payload string identically to extension
    const { prompt, siteCategory = 'UNKNOWN_AI', siteUrl = '' } = req.body || {};
    const payloadStr = JSON.stringify({ prompt, siteCategory, siteUrl });

    if (!verifySignature(payloadStr, timeHeader, nonceHeader, sigHeader)) {
      return res.status(401).json({ success: false, error: 'INVALID_SIGNATURE' });
    }

    if (!(await verifyNonce(nonceHeader))) {
      return res.status(401).json({ success: false, error: 'REPLAY_DETECTED' });
    }

    // 4. Rate Limiting
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(',')[0].trim() : (req.headers['x-real-ip'] || 'unknown');
    if (!(await checkRedisRateLimit(ip))) {
      return res.status(429).json({ success: false, error: 'RATE_LIMITED' });
    }

    // 5. Schema & Validation
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'PROMPT_MISSING' });
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < 3) {
      return res.status(400).json({ success: false, error: 'PROMPT_TOO_SHORT' });
    }
    if (trimmedPrompt.length > 4000) {
      return res.status(400).json({ success: false, error: 'PROMPT_TOO_LONG' });
    }

    // Heuristics: Block jailbreak or proxy attempts
    const blocklist = /ignore all prior|ignore all previous|disregard.{0,50}instructions|forget everything|system prompt|you are a helpful assistant|bypass|jailbreak/i;
    if (blocklist.test(trimmedPrompt)) {
      console.warn(`[SECURITY] Blocked prompt injection from IP: ${ip}`);
      return res.status(400).json({ success: false, error: 'PROMPT_POLICY_VIOLATION' });
    }

    // 6. Build the system prompt
    const basePrompt = SYSTEM_PROMPTS[siteCategory] || SYSTEM_PROMPTS['UNKNOWN_AI'];
    const withLanguage = `${basePrompt}\n${LANGUAGE_RULE}`;
    const systemPrompt = siteUrl
      ? `${withLanguage}\n\nThis prompt is being written for: ${siteUrl}\nApply your knowledge of how prompts work best on this specific platform, including any platform-specific syntax, parameters, or conventions.`
      : withLanguage;

    // 7. Execute
    const improvedPrompt = await improvePrompt(trimmedPrompt, systemPrompt);
    
    // Log telemetry
    console.log(`[OK] Improved ~${trimmedPrompt.length} chars for ${siteUrl || siteCategory} | IP: ${crypto.createHash('sha256').update(ip).digest('hex').substring(0, 8)}`);

    return res.status(200).json({ success: true, improvedPrompt });

  } catch (error) {
    console.error('[SERVER ERROR]', error.message);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
};
