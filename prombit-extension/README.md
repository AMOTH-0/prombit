# PromptCraft Chrome Extension

> Grammarly for AI prompts. Automatically rewrites your vague prompts into structured, high-quality ones.

## What it does

When you're typing a prompt on ChatGPT, Gemini, Claude, Perplexity, or Copilot:
1. A small **"Improve Prompt"** button appears in the text box
2. Click it (or press `Ctrl+Shift+P`) to send your prompt through PromptCraft's AI engine
3. A side-by-side comparison appears showing your original vs. the improved version
4. Click **"Use improved prompt"** to replace it instantly

---

## Setup (5 minutes)

### Step 1 — Get an Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Load the extension in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **"Load unpacked"**
4. Select this folder (`promptcraft-extension`)
5. The PromptCraft icon will appear in your toolbar

### Step 3 — Add your API key
1. Click the PromptCraft icon in your Chrome toolbar
2. Paste your API key into the field
3. Click **Save settings**
4. Status should say "Ready — API key saved"

### Step 4 — Use it
- Go to [chatgpt.com](https://chatgpt.com) or [gemini.google.com](https://gemini.google.com)
- Type a prompt
- Click the **"Improve Prompt"** button that appears, or press `Ctrl+Shift+P`

---

## Supported sites
| Site | URL |
|------|-----|
| ChatGPT | chatgpt.com |
| Gemini | gemini.google.com |
| Claude | claude.ai |
| Perplexity | perplexity.ai |
| Microsoft Copilot | copilot.microsoft.com |

---

## Project structure

```
promptcraft-extension/
├── manifest.json              # Extension config (MV3)
├── popup.html                 # Settings popup
├── popup.css                  # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── styles/
│   └── injected.css           # Styles injected into AI sites
└── src/
    ├── background/
    │   └── background.js      # Service worker — handles API calls
    ├── content/
    │   └── content.js         # Injected into AI sites
    └── popup/
        └── popup.js           # Settings logic
```

---

## Security notes
- Your API key is stored in Chrome's `storage.sync` (encrypted, local to your browser)
- Prompts are sent **only** to Anthropic's API (`api.anthropic.com`) — nowhere else
- No user data is ever collected or logged
- The extension requests minimum permissions: `activeTab`, `storage`, `scripting`

---

## Customizing the AI prompt system

The prompt improvement logic lives in `src/background/background.js` in the `SYSTEM_PROMPT` constant. You can edit this to change how prompts are improved — for example, making it more focused on coding prompts, or creative writing, etc.

---

## Next steps (roadmap)
- [ ] Visual annotation tool (screenshot + draw to generate prompts)
- [ ] Desktop app (system-wide, works outside browser)
- [ ] Prompt history and library
- [ ] Stripe billing integration
- [ ] Mobile app

---

## Cost estimate
Each prompt improvement costs approximately **$0.001–0.003** using Claude Sonnet.
At 500 improvements/month = ~$1.50 in API costs per user.
