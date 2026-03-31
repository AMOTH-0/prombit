// PromptCraft Popup Script — multi-provider

const apiKeyInput      = document.getElementById('api-key-input');
const enabledToggle    = document.getElementById('enabled-toggle');
const autoToggle       = document.getElementById('auto-toggle');
const saveBtn          = document.getElementById('save-btn');
const saveStatus       = document.getElementById('save-status');
const statusDot        = document.getElementById('status-dot');
const statusText       = document.getElementById('status-text');
const toggleVisBtn     = document.getElementById('toggle-key-visibility');
const providerBadge    = document.getElementById('provider-badge');

function detectProviderLocally(key) {
  if (!key) return null;
  if (key.startsWith('sk-ant-'))                           return { id: 'anthropic', name: 'Anthropic (Claude)' };
  if (key.startsWith('sk-') && !key.startsWith('sk-ant-')) return { id: 'openai',    name: 'OpenAI (GPT-4o)' };
  if (key.startsWith('AIza'))                              return { id: 'gemini',    name: 'Google (Gemini)' };
  return null;
}

function updateProviderBadge(key) {
  const trimmed = key.trim();
  if (!trimmed) { providerBadge.className = 'provider-badge hidden'; return; }
  const provider = detectProviderLocally(trimmed);
  if (provider) {
    providerBadge.className = `provider-badge ${provider.id}`;
    providerBadge.textContent = `✓ ${provider.name}`;
  } else if (trimmed.length > 6) {
    providerBadge.className = 'provider-badge unknown';
    providerBadge.textContent = '⚠ Unrecognised key format';
  } else {
    providerBadge.className = 'provider-badge hidden';
  }
}

chrome.storage.sync.get(['apiKey', 'enabled', 'autoMode'], (data) => {
  if (data.apiKey) {
    apiKeyInput.value = data.apiKey;
    updateProviderBadge(data.apiKey);
    const provider = detectProviderLocally(data.apiKey);
    setStatus('ready', provider ? `Ready — ${provider.name}` : 'Ready — API key saved');
  }
  if (data.enabled !== undefined) enabledToggle.checked = data.enabled;
  if (data.autoMode !== undefined) autoToggle.checked = data.autoMode;
});

apiKeyInput.addEventListener('input', () => updateProviderBadge(apiKeyInput.value));

toggleVisBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  const icon = document.getElementById('eye-icon');
  icon.innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

saveBtn.addEventListener('click', async () => {
  const apiKey   = apiKeyInput.value.trim();
  const enabled  = enabledToggle.checked;
  const autoMode = autoToggle.checked;

  if (apiKey && !detectProviderLocally(apiKey)) {
    setStatus('error', 'Key format not recognised — check it and try again');
    return;
  }

  await chrome.storage.sync.set({ apiKey, enabled, autoMode });
  saveStatus.textContent = '✓ Saved';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);

  if (apiKey) {
    const provider = detectProviderLocally(apiKey);
    setStatus('ready', provider ? `Ready — ${provider.name}` : 'Ready');
  } else {
    setStatus('', 'Paste any AI API key above to get started');
  }
});

apiKeyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveBtn.click(); });

function setStatus(type, message) {
  statusDot.className = 'status-dot' + (type ? ` ${type}` : '');
  statusText.textContent = message;
}
