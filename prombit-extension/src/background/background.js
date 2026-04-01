// Prombit Background Service Worker

// ─── Security: HMAC-SHA256 Request Signing ──────────────────────────────────

const CLIENT_SECRET = 'pr0mb1t_h4rd3n3d_x92k_2026'; // Shared secret

async function signRequest(payload, timestamp, nonce) {
  const encoder   = new TextEncoder();
  const keyData   = encoder.encode(CLIENT_SECRET);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  const dataToSign = encoder.encode(timestamp + nonce + payload);
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, dataToSign);
  
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Core handler ──────────────────────────────────────────────────────────

let _improving = false; // in-flight dedup guard

async function handleImprovePrompt(prompt, siteCategory = 'UNKNOWN_AI', siteUrl = '') {
  if (_improving) throw new Error('ALREADY_IMPROVING');
  if (!prompt || prompt.trim().length < 3) throw new Error('PROMPT_TOO_SHORT');

  _improving = true;
  try {
    const timestamp = Date.now().toString();
    const nonce     = Math.random().toString(36).substring(2, 15);
    const bodyStr   = JSON.stringify({ prompt, siteCategory, siteUrl });
    const signature = await signRequest(bodyStr, timestamp, nonce);

    const response = await fetch('https://prombit.vercel.app/api/improve', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-prombit-sig': signature,
        'x-prombit-time': timestamp,
        'x-prombit-nonce': nonce
      },
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
