// Prombit Popup Script

const enabledToggle    = document.getElementById('enabled-toggle');
const autoToggle       = document.getElementById('auto-toggle');
const saveBtn          = document.getElementById('save-btn');
const saveStatus       = document.getElementById('save-status');

chrome.storage.sync.get(['enabled', 'autoMode'], (data) => {
  if (data.enabled !== undefined) enabledToggle.checked = data.enabled;
  if (data.autoMode !== undefined) autoToggle.checked = data.autoMode;
});

saveBtn.addEventListener('click', async () => {
  const enabled  = enabledToggle.checked;
  const autoMode = autoToggle.checked;

  await chrome.storage.sync.set({ enabled, autoMode });
  saveStatus.textContent = '✓ Saved';
  setTimeout(() => { saveStatus.textContent = ''; }, 2000);
});
