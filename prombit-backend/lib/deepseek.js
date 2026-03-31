const OpenAI = require('openai');

const SYSTEM_PROMPT = `You are Prombit, an expert at transforming vague or poorly structured AI prompts into clear, detailed, high-quality prompts that get much better results.

When given a user's raw prompt, rewrite it following these principles:
1. Add a clear ROLE for the AI (e.g. "You are a senior software engineer...")
2. Provide CONTEXT about what the user is trying to achieve
3. Make the TASK specific and actionable
4. Define the desired OUTPUT FORMAT when relevant (list, code block, table, paragraph, etc.)
5. Add CONSTRAINTS or scope if it helps (length, tone, audience, etc.)
6. Preserve the user's original intent exactly — never change what they want, only how they ask for it

Rules:
- Return ONLY the improved prompt. No explanations, no preamble, no "Here is the improved prompt:" prefix.
- Keep it concise — don't pad with unnecessary words
- Match the context: a coding prompt should stay technical, a writing prompt should stay creative
- If the original prompt is already excellent, return it unchanged
- Never add fictional details or assumptions not implied by the original`;

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

async function improvePrompt(rawPrompt) {
  const deepseek = getClient();
  
  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawPrompt }
    ],
    max_tokens: 1024
  });

  return completion.choices[0].message.content;
}

module.exports = { improvePrompt };
