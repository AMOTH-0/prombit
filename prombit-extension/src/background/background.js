// Prombit Background Service Worker

const DESKTOP_API = 'http://127.0.0.1:27182/prompt';

// ─── Record prompt to local Prombit desktop app ────────────────────────────
// Fire-and-forget — fails silently if the desktop app isn't running.
function recordToDesktop(prompt, siteCategory) {
  fetch(DESKTOP_API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text: prompt, tool: siteCategory || 'Browser' }),
  }).catch(() => {}); // desktop may not be running — ignore
}

// ─── Core handler ──────────────────────────────────────────────────────────

let _improving = false; // in-flight dedup guard

async function handleImprovePrompt(prompt, siteCategory = 'UNKNOWN_AI', siteUrl = '') {
  if (_improving) throw new Error('ALREADY_IMPROVING');
  if (!prompt || prompt.trim().length < 3) throw new Error('PROMPT_TOO_SHORT');

  // Record the original prompt to the local desktop app before improving
  recordToDesktop(prompt, siteCategory);

  _improving = true;
  try {
    const bodyStr = JSON.stringify({ prompt, siteCategory, siteUrl });

    const response = await fetch('https://prombit.vercel.app/api/improve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.improvedPrompt;
  } finally {
    _improving = false;
  }
}

// ─── Message listener ──────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
