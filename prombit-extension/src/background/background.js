// PromptCraft Background Service Worker
// Supports: Anthropic (Claude), OpenAI (GPT-4o), Google (Gemini)

const SYSTEM_PROMPT = `You are PromptCraft, an expert at transforming vague or poorly structured AI prompts into clear, detailed, high-quality prompts that get much better results.

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

// ─── Provider detection ────────────────────────────────────────────────────

const PROVIDERS = {
  anthropic: {
    name: 'Anthropic (Claude)',
    detect: (key) => key.startsWith('sk-ant-'),
    model: 'claude-sonnet-4-20250514',
    call: callAnthropic
  },
  openai: {
    name: 'OpenAI (GPT-4o)',
    detect: (key) => key.startsWith('sk-') && !key.startsWith('sk-ant-'),
    model: 'gpt-4o',
    call: callOpenAI
  },
  gemini: {
    name: 'Google (Gemini)',
    detect: (key) => key.startsWith('AIza'),
    model: 'gemini-2.0-flash',
    call: callGemini
  }
};

function detectProvider(apiKey) {
  if (!apiKey) return null;
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    if (provider.detect(apiKey)) return { id, ...provider };
  }
  return null;
}

// ─── API callers ───────────────────────────────────────────────────────────

async function callAnthropic(apiKey, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: PROVIDERS.anthropic.model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(err.error?.message || `Anthropic API error ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(apiKey, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: PROVIDERS.openai.model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    throw new Error(err.error?.message || `OpenAI API error ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGemini(apiKey, prompt) {
  const model = PROVIDERS.gemini.model;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1024 }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err.error?.message || '';
    if (response.status === 403) throw new Error('INVALID_API_KEY');
    if (response.status === 429) throw new Error('RATE_LIMITED');
    // Surface the real Google error message so it's visible in the UI
    throw new Error(`Gemini: ${msg || `HTTP ${response.status}`}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// ─── Core handler ──────────────────────────────────────────────────────────

async function handleImprovePrompt(rawPrompt) {
  const { apiKey } = await chrome.storage.sync.get('apiKey');

  if (!apiKey) throw new Error('NO_API_KEY');
  if (!rawPrompt || rawPrompt.trim().length < 3) throw new Error('PROMPT_TOO_SHORT');

  const provider = detectProvider(apiKey);
  if (!provider) throw new Error('UNKNOWN_API_KEY');

  return await provider.call(apiKey, rawPrompt);
}

// ─── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IMPROVE_PROMPT') {
    handleImprovePrompt(message.prompt)
      .then(result => sendResponse({ success: true, improvedPrompt: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiKey', 'enabled', 'autoMode'], (data) => {
      const provider = detectProvider(data.apiKey);
      sendResponse({ ...data, providerName: provider?.name || null });
    });
    return true;
  }

  if (message.type === 'DETECT_PROVIDER') {
    const provider = detectProvider(message.apiKey);
    sendResponse({ provider: provider ? { id: provider.id, name: provider.name } : null });
    return true;
  }
});

// ─── Keyboard shortcut ─────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'improve-prompt') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_IMPROVE' });
  }
});
