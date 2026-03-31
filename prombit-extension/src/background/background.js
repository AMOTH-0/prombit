// Prombit Background Service Worker

// ─── Core handler ──────────────────────────────────────────────────────────

async function handleImprovePrompt(rawPrompt) {
  if (!rawPrompt || rawPrompt.trim().length < 3) throw new Error('PROMPT_TOO_SHORT');

  const response = await fetch('https://prombit.vercel.app/api/improve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: rawPrompt })
  });
  
  const data = await response.json();
  if (!data.success) throw new Error(data.error);
  return data.improvedPrompt;
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
