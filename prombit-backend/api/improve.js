const { improvePrompt } = require('../lib/deepseek');

// Very basic in-memory rate limiting mechanism (per serverless instance)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip) {
  if (!ip) return true; // fallback if IP cannot be detected

  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  const record = rateLimitMap.get(ip);
  if (now > record.resetTime) {
    // Reset window
    record.count = 1;
    record.resetTime = now + RATE_LIMIT_WINDOW_MS;
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Rate limit exceeded
  }

  record.count++;
  return true;
}

module.exports = async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    // 1. Rate Limiting
    // Vercel headers for client IP (x-forwarded-for or x-real-ip)
    const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    
    if (!checkRateLimit(ip)) {
      return res.status(429).json({ success: false, error: 'RATE_LIMITED' });
    }

    // 2. Input Validation
    const { prompt } = req.body || {};
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

    // 3. Process Prompt via DeepSeek
    const improvedPrompt = await improvePrompt(trimmedPrompt);

    // 4. Return Output
    return res.status(200).json({
      success: true,
      improvedPrompt
    });
    
  } catch (error) {
    console.error('API Error:', error);
    // Generic error fallback, don't leak internal crash stacks to the client
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'INTERNAL_SERVER_ERROR' 
    });
  }
};
