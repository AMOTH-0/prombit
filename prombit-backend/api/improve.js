const { improvePrompt } = require('../lib/deepseek');

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

  // Legacy alias kept for backward compatibility
  AUDIO_MUSIC: `You are Prombit. Rewrite this AI music/audio generation prompt.
Add: genre, tempo/BPM, instruments, mood, energy level, reference artists if helpful, structure, and production style.
Return ONLY the improved prompt. No explanations.`,

  UNKNOWN_AI: `You are Prombit. Improve this prompt to be clearer, more specific, and more likely to produce excellent results.
Add a clear role, context, task, output format, and constraints where helpful.
Return ONLY the improved prompt. No explanations.`,
};

// ─── Shared rule appended to every category prompt ────────────────────────

const LANGUAGE_RULE = `- Detect the language of the user's prompt and write the improved prompt in that same language. If the prompt is in Korean, respond in Korean. If in Japanese, respond in Japanese. If in French, respond in French. Always match the user's language exactly.`;

// ─── Rate limiting ─────────────────────────────────────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  const record = rateLimitMap.get(ip);
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return true;
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) return false;
  record.count++;
  return true;
}

// ─── Handler ───────────────────────────────────────────────────────────────

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // Strict Origin Validation (Security)
  // Ensure the request comes from a Chrome Extension (or localhost for testing)
  const origin = req.headers.origin || '';
  if (!origin.startsWith('chrome-extension://') && !origin.includes('localhost') && origin !== 'null') {
    return res.status(403).json({ success: false, error: 'FORBIDDEN_ORIGIN' });
  }

  try {
    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ success: false, error: 'RATE_LIMITED' });
    }

    // Input validation
    const { prompt, siteCategory = 'UNKNOWN_AI', siteUrl = '' } = req.body || {};
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

    // Build the system prompt: category instructions + language rule + site context
    const basePrompt = SYSTEM_PROMPTS[siteCategory] || SYSTEM_PROMPTS['UNKNOWN_AI'];
    const withLanguage = `${basePrompt}\n${LANGUAGE_RULE}`;
    const systemPrompt = siteUrl
      ? `${withLanguage}\n\nThis prompt is being written for: ${siteUrl}\nApply your knowledge of how prompts work best on this specific platform, including any platform-specific syntax, parameters, or conventions.`
      : withLanguage;

    // Improve
    const improvedPrompt = await improvePrompt(trimmedPrompt, systemPrompt);

    return res.status(200).json({ success: true, improvedPrompt });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'INTERNAL_SERVER_ERROR'
    });
  }
};
