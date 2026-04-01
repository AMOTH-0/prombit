const OpenAI = require('openai');

let client = null;

function getClient() {
  if (!client) {
    if (!process.env.DEEPSEEK_API_KEY) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }
    client = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    });
  }
  return client;
}

/**
 * Improve a prompt using the provided system prompt.
 * @param {string} rawPrompt   - The user's raw prompt text.
 * @param {string} systemPrompt - The system instructions for this category.
 */
async function improvePrompt(rawPrompt, systemPrompt) {
  const deepseek   = getClient();
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 30_000); // 30s hard limit

  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: rawPrompt }
      ],
      max_tokens:  1024,
      temperature: 0.3, // lower = faster + more deterministic for prompt rewriting
    }, { signal: controller.signal });

    return completion.choices[0].message.content;
  } finally {
    clearTimeout(timeout); // always clear so the timer doesn't fire after success
  }
}

module.exports = { improvePrompt };
