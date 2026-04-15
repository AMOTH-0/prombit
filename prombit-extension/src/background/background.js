// Prombit Background Service Worker

const DESKTOP_BASE = 'http://127.0.0.1:27182';

// ─── Fetch project context from local Prombit desktop (fail-safe) ──────────
async function fetchProjectContext(promptText) {
  try {
    const res = await fetch(
      `${DESKTOP_BASE}/context?text=${encodeURIComponent(promptText.slice(0, 300))}`,
      { signal: AbortSignal.timeout(800) }  // never block more than 800ms
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.ok && data.context) ? data.context : null;
  } catch {
    return null; // desktop not running — proceed without context
  }
}

// ─── Map hostname → human-readable tool name ───────────────────────────────
function toolFromSite(siteUrl) {
  const h = (siteUrl || '').toLowerCase().replace(/^www\./, '');
  if (h.includes('chatgpt.com'))                                      return 'ChatGPT';
  if (h.includes('claude.ai'))                                        return 'Claude';
  if (h.includes('gemini.google.com'))                                return 'Gemini';
  if (h.includes('copilot.microsoft.com') || h.includes('copilot.github.com')) return 'Copilot';
  if (h.includes('perplexity.ai'))                                    return 'Perplexity';
  if (h.includes('cursor.sh'))                                        return 'Cursor';
  if (h.includes('grok.com') || h.includes('x.ai'))                  return 'Grok';
  if (h.includes('poe.com'))                                          return 'Poe';
  if (h.includes('mistral.ai'))                                       return 'Mistral';
  if (h.includes('cohere.com'))                                       return 'Cohere';
  if (h.includes('aistudio.google.com'))                              return 'AI Studio';
  if (h.length > 0)                                                   return h; // show the domain as fallback
  return 'Browser';
}

// ─── Record prompt to local Prombit desktop app (fire-and-forget) ──────────
function recordToDesktop(prompt, toolName) {
  fetch(`${DESKTOP_BASE}/prompt`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text: prompt, tool: toolName }),
  }).catch(() => {});
}

// ─── Core handler ──────────────────────────────────────────────────────────

let _improving = false; // in-flight dedup guard

async function handleImprovePrompt(prompt, siteCategory = 'UNKNOWN_AI', siteUrl = '') {
  if (_improving) throw new Error('ALREADY_IMPROVING');
  if (!prompt || prompt.trim().length < 3) throw new Error('PROMPT_TOO_SHORT');

  // Record the original prompt with the proper tool name (fire-and-forget)
  recordToDesktop(prompt, toolFromSite(siteUrl));

  // Fetch project context from desktop in parallel with nothing — adds richness, never blocks
  const projectContext = await fetchProjectContext(prompt);

  _improving = true;
  try {
    const body = { prompt, siteCategory, siteUrl };
    if (projectContext) body.projectContext = projectContext;

    const response = await fetch('https://prombit.vercel.app/api/improve', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.improvedPrompt;
  } finally {
    _improving = false;
  }
}

// ─── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'IMPROVE_PROMPT') {
    handleImprovePrompt(message.prompt, message.siteCategory, message.siteUrl)
      .then(result => sendResponse({ success: true, improvedPrompt: result }))
      .catch(err  => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['enabled', 'autoMode'], (data) => {
      sendResponse(data);
    });
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
