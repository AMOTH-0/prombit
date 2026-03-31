// PromptCraft Content Script
// Injected into ChatGPT, Gemini, Claude, Perplexity, etc.
// Detects the active prompt input and adds the PromptCraft button

(function () {
  'use strict';

  // Site-specific selectors for the prompt textarea
  const SITE_SELECTORS = {
    'chatgpt.com': '#prompt-textarea, div[contenteditable="true"][data-id]',
    'chat.openai.com': '#prompt-textarea, div[contenteditable="true"][data-id]',
    'gemini.google.com': 'div[contenteditable="true"].ql-editor, rich-textarea div[contenteditable="true"]',
    'claude.ai': 'div[contenteditable="true"].ProseMirror',
    'perplexity.ai': 'textarea[placeholder], div[contenteditable="true"]',
    'copilot.microsoft.com': 'div[contenteditable="true"], textarea'
  };

  let currentInput = null;
  let pcButton = null;
  let pcOverlay = null;
  let isImproving = false;

  // ─── Find the active input on this site ───────────────────────────────────

  function getSelector() {
    const host = window.location.hostname.replace('www.', '');
    for (const [site, sel] of Object.entries(SITE_SELECTORS)) {
      if (host.includes(site)) return sel;
    }
    return 'textarea, div[contenteditable="true"]';
  }

  function findActiveInput() {
    const selector = getSelector();
    const elements = document.querySelectorAll(selector);
    // Prefer the one that's visible and has reasonable size
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 20) return el;
    }
    return elements[0] || null;
  }

  function getInputText(el) {
    if (!el) return '';
    return el.isContentEditable ? el.innerText.trim() : el.value.trim();
  }

  function setInputText(el, text) {
    if (!el) return;
    if (el.isContentEditable) {
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } else {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      nativeInputValueSetter.call(el, text);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ─── Button ────────────────────────────────────────────────────────────────

  function createButton() {
    const btn = document.createElement('button');
    btn.id = 'promptcraft-btn';
    btn.className = 'promptcraft-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Improve Prompt</span>
    `;
    btn.title = 'Improve this prompt with PromptCraft (Ctrl+Shift+P)';
    btn.addEventListener('click', triggerImprove);
    return btn;
  }

  function positionButton(inputEl) {
    if (!pcButton || !inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    pcButton.style.top = `${rect.bottom + scrollTop - 36}px`;
    pcButton.style.left = `${rect.right + scrollLeft - 160}px`;
    pcButton.style.display = 'flex';
  }

  // ─── Overlay (shows original vs improved) ──────────────────────────────────

  function createOverlay(original, improved) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'promptcraft-overlay';
    overlay.className = 'promptcraft-overlay';
    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        <div class="pc-header">
          <div class="pc-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>PromptCraft</span>
          </div>
          <button class="pc-close" id="pc-close-btn">✕</button>
        </div>
        <div class="pc-columns">
          <div class="pc-col">
            <div class="pc-col-label">Original</div>
            <div class="pc-col-text pc-original">${escapeHtml(original)}</div>
          </div>
          <div class="pc-divider"></div>
          <div class="pc-col">
            <div class="pc-col-label pc-label-improved">Improved</div>
            <div class="pc-col-text pc-improved">${escapeHtml(improved)}</div>
          </div>
        </div>
        <div class="pc-actions">
          <button class="pc-btn-secondary" id="pc-discard-btn">Keep original</button>
          <button class="pc-btn-primary" id="pc-apply-btn">Use improved prompt ↗</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#pc-close-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-discard-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-apply-btn').addEventListener('click', () => {
      applyImprovedPrompt(improved);
      removeOverlay();
    });

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) removeOverlay();
    });

    pcOverlay = overlay;
  }

  function removeOverlay() {
    if (pcOverlay) {
      pcOverlay.remove();
      pcOverlay = null;
    }
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  // ─── Loading state ─────────────────────────────────────────────────────────

  function showLoadingOverlay(original) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'promptcraft-overlay';
    overlay.className = 'promptcraft-overlay';
    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        <div class="pc-header">
          <div class="pc-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>PromptCraft</span>
          </div>
          <button class="pc-close" id="pc-close-btn">✕</button>
        </div>
        <div class="pc-loading">
          <div class="pc-spinner"></div>
          <p>Improving your prompt…</p>
          <div class="pc-original-preview">${escapeHtml(original.slice(0, 120))}${original.length > 120 ? '…' : ''}</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#pc-close-btn').addEventListener('click', () => {
      removeOverlay();
      isImproving = false;
      resetButton();
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        removeOverlay();
        isImproving = false;
        resetButton();
      }
    });
    pcOverlay = overlay;
  }

  function showErrorOverlay(message) {
    removeOverlay();
    const overlay = document.createElement('div');
    overlay.id = 'promptcraft-overlay';
    overlay.className = 'promptcraft-overlay';

    const errorMessages = {
      'NO_API_KEY': 'No API key found. Click the PromptCraft icon in your toolbar and add your API key (Anthropic, OpenAI, or Google).',
      'UNKNOWN_API_KEY': 'Key format not recognised. Supported: Anthropic (sk-ant-…), OpenAI (sk-…), Google (AIza…).',
      'INVALID_API_KEY': 'Your API key was rejected. Double-check it is correct and has the right permissions.',
      'RATE_LIMITED': 'You\'ve hit the API rate limit. Please wait a moment and try again.',
      'PROMPT_TOO_SHORT': 'Your prompt is too short to improve. Write a bit more first.'
    };

    const displayMessage = errorMessages[message] || message;

    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        <div class="pc-header">
          <div class="pc-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <span>PromptCraft</span>
          </div>
          <button class="pc-close" id="pc-close-btn">✕</button>
        </div>
        <div class="pc-error">
          <div class="pc-error-icon">⚠️</div>
          <p>${displayMessage}</p>
          <button class="pc-btn-secondary" id="pc-err-close">Dismiss</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#pc-close-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-err-close').addEventListener('click', removeOverlay);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) removeOverlay(); });
    pcOverlay = overlay;
  }

  // ─── Core improve logic ────────────────────────────────────────────────────

  async function triggerImprove() {
    if (isImproving) return;

    currentInput = findActiveInput();
    const rawPrompt = getInputText(currentInput);

    if (!rawPrompt || rawPrompt.length < 3) {
      showErrorOverlay('PROMPT_TOO_SHORT');
      return;
    }

    isImproving = true;
    setButtonLoading(true);
    showLoadingOverlay(rawPrompt);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'IMPROVE_PROMPT',
        prompt: rawPrompt
      });

      removeOverlay();

      if (response.success) {
        createOverlay(rawPrompt, response.improvedPrompt);
      } else {
        showErrorOverlay(response.error);
      }
    } catch (err) {
      removeOverlay();
      showErrorOverlay(err.message || 'Something went wrong. Please try again.');
    } finally {
      isImproving = false;
      setButtonLoading(false);
    }
  }

  function applyImprovedPrompt(text) {
    currentInput = findActiveInput();
    if (currentInput) {
      setInputText(currentInput, text);
      currentInput.focus();
    }
  }

  function setButtonLoading(loading) {
    if (!pcButton) return;
    if (loading) {
      pcButton.classList.add('pc-loading-btn');
      pcButton.querySelector('span').textContent = 'Improving…';
      pcButton.disabled = true;
    } else {
      pcButton.classList.remove('pc-loading-btn');
      pcButton.querySelector('span').textContent = 'Improve Prompt';
      pcButton.disabled = false;
    }
  }

  function resetButton() {
    setButtonLoading(false);
  }

  // ─── Keyboard shortcut listener ────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'TRIGGER_IMPROVE') {
      triggerImprove();
    }
  });

  // ─── Inject button into page ───────────────────────────────────────────────

  function injectButton() {
    if (document.getElementById('promptcraft-btn')) return;
    pcButton = createButton();
    pcButton.style.display = 'none';
    document.body.appendChild(pcButton);
  }

  function updateButtonVisibility() {
    const input = findActiveInput();
    if (input && pcButton) {
      positionButton(input);
    } else if (pcButton) {
      pcButton.style.display = 'none';
    }
  }

  // ─── Watch for input focus ─────────────────────────────────────────────────

  document.addEventListener('focusin', (e) => {
    const selector = getSelector();
    if (e.target.matches(selector) || e.target.closest(selector)) {
      currentInput = findActiveInput();
      if (pcButton) positionButton(currentInput || e.target);
    }
  });

  document.addEventListener('focusout', () => {
    // Small delay so button click registers before hiding
    setTimeout(() => {
      const focused = document.activeElement;
      if (focused?.id !== 'promptcraft-btn' && !focused?.closest('#promptcraft-overlay')) {
        if (pcButton) pcButton.style.display = 'none';
      }
    }, 150);
  });

  window.addEventListener('scroll', updateButtonVisibility, { passive: true });
  window.addEventListener('resize', updateButtonVisibility, { passive: true });

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    injectButton();
    // Re-check after SPA navigation (ChatGPT, Gemini are SPAs)
    const observer = new MutationObserver(() => {
      if (!document.getElementById('promptcraft-btn')) {
        injectButton();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
