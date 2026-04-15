// Prombit Content Script — Registry-Based AI Site Detection
// Runs on <all_urls>. Button only appears on sites in AI_SITE_REGISTRY.

(function () {
  'use strict';

  // ─── Full AI Site Registry ─────────────────────────────────────────────────
  // Each entry: { domain, category, label }
  // getSiteConfig() matches hostname exactly or as a subdomain suffix.

  const AI_SITE_REGISTRY = [

    // ── TEXT_CHAT — General AI Chatbots & LLM Platforms ────────────────────
    { domain: 'chatgpt.com',              category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.openai.com',          category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'claude.ai',                category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'gemini.google.com',        category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'copilot.microsoft.com',    category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'perplexity.ai',            category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'grok.com',                 category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'x.ai',                     category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'meta.ai',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'pi.ai',                    category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'poe.com',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.deepseek.com',        category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'deepseek.com',             category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.mistral.ai',          category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'mistral.ai',               category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'kimi.ai',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.kimi.ai',             category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'moonshot.cn',              category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'huggingface.co',           category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'character.ai',             category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'beta.character.ai',        category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'jan.ai',                   category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.qwen.ai',             category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'qwenlm.ai',                category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'tongyi.aliyun.com',        category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'yiyan.baidu.com',          category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'xinghuo.xfyun.cn',         category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'tiangong.cn',              category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'coze.com',                 category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'coze.cn',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'doubao.com',               category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'talkie-ai.com',            category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'you.com',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'venice.ai',                category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'chat.lmsys.org',           category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'nat.dev',                  category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'together.ai',              category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'groq.com',                 category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'cohere.com',               category: 'TEXT_CHAT',    label: 'Improve Prompt' },
    { domain: 'manus.im',                 category: 'TEXT_CHAT',    label: 'Improve Prompt' },

    // ── SEARCH — AI Search & Research Tools ────────────────────────────────
    { domain: 'phind.com',                category: 'SEARCH',       label: 'Improve Search Prompt' },
    { domain: 'elicit.org',               category: 'SEARCH',       label: 'Improve Research Prompt' },
    { domain: 'consensus.app',            category: 'SEARCH',       label: 'Improve Research Prompt' },
    { domain: 'scite.ai',                 category: 'SEARCH',       label: 'Improve Research Prompt' },
    { domain: 'researchrabbit.ai',        category: 'SEARCH',       label: 'Improve Research Prompt' },
    { domain: 'notebooklm.google.com',    category: 'SEARCH',       label: 'Improve Research Prompt' },
    { domain: 'kagi.com',                 category: 'SEARCH',       label: 'Improve Search Prompt' },
    { domain: 'exa.ai',                   category: 'SEARCH',       label: 'Improve Search Prompt' },
    { domain: 'andi.co',                  category: 'SEARCH',       label: 'Improve Search Prompt' },
    { domain: 'globe.engineer',           category: 'SEARCH',       label: 'Improve Search Prompt' },
    { domain: 'iask.ai',                  category: 'SEARCH',       label: 'Improve Search Prompt' },

    // ── CODE — AI Coding IDEs & Developer Tools ─────────────────────────────
    { domain: 'github.com',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'cursor.com',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'cursor.sh',                category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'codeium.com',              category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'windsurf.com',             category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'windsurf.ai',              category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'trae.ai',                  category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'trae.com',                 category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'replit.com',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'tabnine.com',              category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'devin.ai',                 category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'sweep.dev',                category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'mutable.ai',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'continue.dev',             category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'bolt.new',                 category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'lovable.dev',              category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'v0.dev',                   category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'val.town',                 category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'codex.openai.com',         category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'sourcegraph.com',          category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'cody.dev',                 category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'pieces.app',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'softgen.ai',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'factory.ai',               category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'augmentcode.com',          category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'zed.dev',                  category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'idx.google.com',           category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'blackbox.ai',              category: 'CODE',         label: 'Improve Code Prompt' },
    { domain: 'gitpod.io',                category: 'CODE',         label: 'Improve Code Prompt' },

    // ── IMAGE — AI Image Generation ──────────────────────────────────────────
    { domain: 'midjourney.com',           category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'leonardo.ai',              category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'app.leonardo.ai',          category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'playgroundai.com',         category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'playground.ai',            category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'firefly.adobe.com',        category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'express.adobe.com',       category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'ideogram.ai',              category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'bluewillow.ai',            category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'dreamstudio.ai',           category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'krea.ai',                  category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'stability.ai',             category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'getimg.ai',                category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'nightcafe.studio',         category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'tensor.art',               category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'civitai.com',              category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'openart.ai',               category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'seaart.ai',                category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'pixai.art',                category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'flux1.ai',                 category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'fal.ai',                   category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'imagine.art',              category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'artbreeder.com',           category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'clipdrop.co',              category: 'IMAGE',        label: 'Improve Image Prompt' },
    { domain: 'dezgo.com',                category: 'IMAGE',        label: 'Improve Image Prompt' },

    // ── VIDEO — AI Video Generation ──────────────────────────────────────────
    { domain: 'runwayml.com',             category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'app.runwayml.com',         category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'pika.art',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'synthesia.io',             category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'heygen.com',               category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'app.heygen.com',           category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'colossyan.com',            category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'lumalabs.ai',              category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'luma.ai',                  category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'klingai.com',              category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'kling.ai',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'hailuoai.video',           category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'hailuoai.com',             category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'kaiber.ai',                category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'genmo.ai',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'invideo.io',               category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'pictory.ai',               category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'veed.io',                  category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'fliki.ai',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'steve.ai',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'haiper.ai',                category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'veo.google.com',           category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'sora.com',                 category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'wan.video',                category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'pixverse.ai',              category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'seedance.ai',              category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'vidu.ai',                  category: 'VIDEO',        label: 'Improve Video Prompt' },
    { domain: 'hera.video',              category: 'VIDEO',        label: 'Improve Video Prompt' },

    // ── VOICE — AI Voice, TTS & Audio ───────────────────────────────────────
    { domain: 'elevenlabs.io',            category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'play.ht',                  category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'resemble.ai',              category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'murf.ai',                  category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'descript.com',             category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'speechify.com',            category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'wellsaidlabs.com',         category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'voicemod.net',             category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'lovo.ai',                  category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'listnr.tech',              category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'rimeai.com',               category: 'VOICE',        label: 'Improve Voice Prompt' },
    { domain: 'podcast.adobe.com',       category: 'VOICE',        label: 'Improve Voice Prompt' },

    // ── MUSIC — AI Music Generation ──────────────────────────────────────────
    { domain: 'suno.com',                 category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'suno.ai',                  category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'app.suno.ai',              category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'udio.com',                 category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'soundraw.io',              category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'aiva.ai',                  category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'mubert.com',               category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'beatoven.ai',              category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'loudly.com',               category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'boomy.com',                category: 'MUSIC',        label: 'Improve Music Prompt' },
    { domain: 'thatawave.ai',            category: 'MUSIC',        label: 'Improve Music Prompt' },

    // ── WRITING — AI Writing & Content Tools ────────────────────────────────
    { domain: 'jasper.ai',                category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'copy.ai',                  category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'writesonic.com',           category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'sudowrite.com',            category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'grammarly.com',            category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'notion.so',               category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'rytr.me',                  category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'paperpal.com',             category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'hyperwriteai.com',         category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'paragraphai.com',          category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'wordtune.com',             category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'quillbot.com',             category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'prowritingaid.com',        category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'inkforall.com',            category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'anyword.com',              category: 'WRITING',      label: 'Improve Writing Prompt' },
    { domain: 'cohesive.so',              category: 'WRITING',      label: 'Improve Writing Prompt' },

    // ── DESIGN — AI Design, UI & Presentation Tools ─────────────────────────
    { domain: 'figma.com',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'framer.com',               category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'canva.com',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'webflow.com',              category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'locofy.ai',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'uizard.io',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'builder.io',               category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'tome.app',                 category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'gamma.app',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'stitch.withgoogle.com',    category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'relume.io',                category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'durable.co',               category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'mixo.io',                  category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'beautiful.ai',             category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'presentations.ai',         category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'simplified.com',           category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'galileo.ai',               category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'magician.design',          category: 'DESIGN',       label: 'Improve Design Prompt' },
    { domain: 'supademo.com',            category: 'DESIGN',       label: 'Improve Design Prompt' },

    // ── PRODUCTIVITY — AI Productivity & Office Tools ───────────────────────
    { domain: 'clickup.com',              category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'airtable.com',             category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'coda.io',                  category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'mem.ai',                   category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'taskade.com',              category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'slite.com',                category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'motion.app',               category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'turbo.ai',                 category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'turbolearn.ai',            category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'otter.ai',                 category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'fireflies.ai',             category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'bearly.ai',                category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'adept.ai',                 category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'reclaim.ai',               category: 'PRODUCTIVITY', label: 'Improve Prompt' },
    { domain: 'krisp.ai',                 category: 'PRODUCTIVITY', label: 'Improve Prompt' },

    // ── AGENT — AI Agents & Automation ──────────────────────────────────────
    { domain: 'zapier.com',               category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'lindy.ai',                 category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'manus.ai',                 category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'agentgpt.reworkd.ai',      category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'superagi.com',             category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'crewai.com',               category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'flowise.ai',               category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'flowiseai.com',            category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'n8n.io',                   category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'make.com',                 category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'relevanceai.com',          category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'activepieces.com',         category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'gumloop.com',              category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'bardeen.ai',               category: 'AGENT',        label: 'Improve Agent Prompt' },
    { domain: 'dust.tt',                  category: 'AGENT',        label: 'Improve Agent Prompt' },

    // ── DATA — AI Data, Analytics & BI ──────────────────────────────────────
    { domain: 'thoughtspot.com',          category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'hex.tech',                 category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'datarobot.com',            category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'obviously.ai',             category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'monkeylearn.com',          category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'tellius.com',              category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'akkio.com',                category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'julius.ai',                category: 'DATA',         label: 'Improve Data Prompt' },
    { domain: 'rows.com',                 category: 'DATA',         label: 'Improve Data Prompt' },

    // ── INFRA — Model APIs & Playgrounds ────────────────────────────────────
    { domain: 'platform.openai.com',      category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'console.anthropic.com',    category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'aistudio.google.com',      category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'replicate.com',            category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'fireworks.ai',             category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'modal.com',                category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'anyscale.com',             category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'openrouter.ai',            category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'deepinfra.com',            category: 'INFRA',        label: 'Improve Prompt' },
    { domain: 'lepton.ai',                category: 'INFRA',        label: 'Improve Prompt' },

  ];


  // ─── Registry Map — O(1) lookup ───────────────────────────────────────────

  // Strip ✦ from all labels once at module load — render path never needs to
  AI_SITE_REGISTRY.forEach(e => { e.label = e.label.replace('✦ ', ''); });

  // Map keyed by domain for O(1) exact lookup instead of O(n) array scan
  const REGISTRY_MAP = new Map(AI_SITE_REGISTRY.map(e => [e.domain, e]));

  function getSiteConfig() {
    const hostname = window.location.hostname.replace(/^www\./, '');
    // Exact match — O(1)
    if (REGISTRY_MAP.has(hostname)) return REGISTRY_MAP.get(hostname);
    // Subdomain suffix match (e.g. app.suno.ai → suno.ai)
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const suffix = parts.slice(i).join('.');
      if (REGISTRY_MAP.has(suffix)) return REGISTRY_MAP.get(suffix);
    }
    return null;
  }

  // ─── State ────────────────────────────────────────────────────────────────

  let siteConfig   = null;   // { domain, category, label } | null
  let currentInput = null;
  let pcButton     = null;
  let pcOverlay    = null;
  let isImproving  = false;
  let lastUrl      = location.href;

  // ── Performance caches (never mutate core logic) ──────────────────────────
  let _cachedInput    = null;   // last resolved input element
  let _cachedInputUrl = null;   // URL at time of cache
  let _rafPending     = false;  // RAF throttle flag for scroll/resize

  // Native value setters — cached once; getOwnPropertyDescriptor is expensive
  const _textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  const _inputSetter    = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,    'value').set;

  // ─── Smart input finder ───────────────────────────────────────────────────

  function findBestInput() {
    // Return cached result if URL is unchanged and element is still in the DOM
    if (_cachedInput && _cachedInputUrl === location.href && _cachedInput.isConnected) {
      return _cachedInput;
    }

    // One combined selector is faster than four separate querySelectorAll calls
    const all = document.querySelectorAll(
      '[role="textbox"], div[contenteditable="true"], div[contenteditable=""], textarea, input[type="text"], input:not([type])'
    );

    // Filter to elements that pass the prompt-input guard
    const visible = [];
    for (const el of all) {
      if (isPromptInput(el)) visible.push(el);
    }

    if (!visible.length) return null;

    // Score each candidate — pick the best one
    const best = visible.sort((a, b) => inputScore(b) - inputScore(a))[0];

    // Cache against current URL; invalidated on navigation
    _cachedInput    = best;
    _cachedInputUrl = location.href;
    return best;
  }

  function invalidateInputCache() {
    _cachedInput    = null;
    _cachedInputUrl = null;
  }

  function inputScore(el) {
    let s = 0;
    const rect = el.getBoundingClientRect();

    // Bigger = better
    s += Math.min(rect.width, 900) / 10;
    s += Math.min(rect.height, 400) / 5;

    // Centered on page
    const cx = rect.left + rect.width / 2;
    if (Math.abs(cx - window.innerWidth / 2) < window.innerWidth * 0.3) s += 20;

    // Prompt-like placeholder / aria-label
    const hint = (
      el.getAttribute('placeholder') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-placeholder') || ''
    ).toLowerCase();
    if (/prompt|message|describe|generate|ask|tell|write|song|music|style|create|imagine|idea|compose|chat/i.test(hint)) s += 30;

    // Prefer contenteditable and textarea over plain input
    if (el.isContentEditable) s += 15;
    if (el.tagName === 'TEXTAREA') s += 10;

    // Nearby generate/send button
    const parent = el.closest('form') || el.parentElement?.parentElement;
    if (parent) {
      const btns = parent.querySelectorAll('button, [role="button"]');
      for (const btn of btns) {
        if (/^(generate|create|run|send|ask|go|imagine|compose|make|build|render|submit)/i.test(btn.innerText?.trim())) {
          s += 25;
          break;
        }
      }
    }

    // Penalise password / search types
    const t = (el.getAttribute('type') || '').toLowerCase();
    if (['password', 'email', 'search', 'tel', 'url', 'number'].includes(t)) s = -999;

    return s;
  }

  // ─── Prompt-input guard ───────────────────────────────────────────────────
  // Returns true only for inputs that are plausibly an AI prompt box.
  // Used in both the focusin handler and the active-element poll so the button
  // never appears on search bars, login fields, comment boxes, etc.

  function isPromptInput(el) {
    if (!el) return false;

    // Disqualify by input type
    const type = (el.getAttribute?.('type') || '').toLowerCase();
    if (['password', 'email', 'search', 'tel', 'url', 'number'].includes(type)) return false;

    // Disqualify by ARIA role
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    if (['search', 'searchbox'].includes(role)) return false;

    // Disqualify if inside a search region, navigation, or banner/header landmark
    if (el.closest('[role="search"]'))      return false;
    if (el.closest('[role="navigation"]'))  return false;
    if (el.closest('[role="banner"]'))      return false;
    if (el.closest('nav'))                  return false;
    if (el.closest('header'))              return false;

    // Disqualify if placeholder/label strongly implies this is a search field
    const hint = (
      el.getAttribute('placeholder') ||
      el.getAttribute('aria-label') ||
      el.getAttribute('aria-placeholder') || ''
    ).toLowerCase();
    if (/^search[\s\W]|^find[\s\W]|^filter[\s\W]|search\.\.\.|find\.\.\./i.test(hint)) return false;

    // Must be on-screen and have a plausible size
    const rect = el.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 20)      return false;
    if (rect.top >= window.innerHeight || rect.bottom <= 0) return false;

    return true;
  }

  // ─── Input read/write helpers ─────────────────────────────────────────────

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
      // Use pre-cached native setters — avoids getOwnPropertyDescriptor per call
      const setter = el.tagName === 'TEXTAREA' ? _textareaSetter : _inputSetter;
      setter.call(el, text);
      el.dispatchEvent(new Event('input',  { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ─── Button ───────────────────────────────────────────────────────────────

  function createButton(label) {
    const btn = document.createElement('button');
    btn.id        = 'promptcraft-btn';
    btn.className = 'promptcraft-btn';
    btn.innerHTML = `<span>${label}</span>`; // ✦ already stripped at module init
    btn.title = 'Improve this prompt with Prombit (Ctrl+Shift+P)';
    btn.addEventListener('click', triggerImprove);
    return btn;
  }

  function injectButton() {
    if (document.getElementById('promptcraft-btn')) return;
    pcButton = createButton(siteConfig?.label || 'Improve Prompt');
    // Start fully hidden — only show on input focus
    pcButton.style.display = 'none';
    pcButton.style.opacity = '0';
    document.body.appendChild(pcButton);
  }

  function removeButton() {
    document.getElementById('promptcraft-btn')?.remove();
    pcButton = null;
  }

  // ─── Button positioning ─────────────────────────────────────────────────────

  function positionButton(inputEl) {
    if (!pcButton || !inputEl) return;
    const rect = inputEl.getBoundingClientRect();

    // Below the input, left-aligned — never overlaps text or send button
    const top  = rect.bottom + 6;
    const left = rect.left;  // left edge of input

    // Clamp so it never goes off-screen
    const clampedLeft = Math.max(8, left);
    const clampedTop  = Math.min(top, window.innerHeight - 50);

    pcButton.style.position = 'fixed';
    pcButton.style.top      = `${clampedTop}px`;
    pcButton.style.left     = `${clampedLeft}px`;
    pcButton.style.bottom   = 'auto';
    pcButton.style.right    = 'auto';
    pcButton.style.zIndex   = '2147483647';
  }


  // ─── Show / hide with animation ───────────────────────────────────────────

  let _resizeObserver = null;

  function showButton(inputEl) {
    if (!pcButton || !inputEl) return;
    // Guard: skip if already visible for this exact element
    // Prevents double-fire from overlapping focusin + direct 'focus' listeners
    if (pcButton.style.display !== 'none' && currentInput === inputEl) return;
    positionButton(inputEl);
    watchInputResize(inputEl);
    // Force animation restart every time
    pcButton.style.animation = 'none';
    void pcButton.offsetHeight; // trigger reflow
    pcButton.style.display   = 'flex';
    pcButton.style.animation = 'prombit-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
  }

  function hideButton() {
    if (!pcButton) return;
    pcButton.style.animation = 'prombit-fade-out 0.15s ease forwards';
    setTimeout(() => {
      if (pcButton) pcButton.style.display = 'none';
    }, 150);
  }

  function watchInputResize(inputEl) {
    if (!inputEl || !window.ResizeObserver) return;
    if (_resizeObserver) { _resizeObserver.disconnect(); }
    _resizeObserver = new ResizeObserver(() => {
      if (pcButton && pcButton.style.display !== 'none') {
        positionButton(inputEl);
      }
    });
    _resizeObserver.observe(inputEl);
  }

  // ─── Overlay helpers ──────────────────────────────────────────────────────

  // Single-pass escapeHtml: strict XSS protection including quotes
  const _ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '\n': '<br>' };
  function escapeHtml(text) {
    return text.replace(/[&<>"'\n]/g, c => _ESC_MAP[c]);
  }

  function removeOverlay() {
    if (pcOverlay) { pcOverlay.remove(); pcOverlay = null; }
  }

  function buildOverlayShell() {
    const overlay = document.createElement('div');
    overlay.id        = 'promptcraft-overlay';
    overlay.className = 'promptcraft-overlay';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { removeOverlay(); isImproving = false; resetButton(); }
    });
    return overlay;
  }

  const LOGO_SVG = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>`;

  function headerHtml() {
    return `
      <div class="pc-header">
        <div class="pc-logo">${LOGO_SVG}<span>Prombit</span></div>
        <button class="pc-close" id="pc-close-btn">✕</button>
      </div>`;
  }

  function showLoadingOverlay(original) {
    removeOverlay();
    const overlay = buildOverlayShell();
    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        ${headerHtml()}
        <div class="pc-loading">
          <div class="pc-spinner"></div>
          <p>Improving your prompt…</p>
          <div class="pc-original-preview">${escapeHtml(original.slice(0, 120))}${original.length > 120 ? '…' : ''}</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pc-close-btn').addEventListener('click', () => {
      removeOverlay(); isImproving = false; resetButton();
    });
    pcOverlay = overlay;
  }

  function createOverlay(original, improved) {
    removeOverlay();
    const overlay = buildOverlayShell();
    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        ${headerHtml()}
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
          <button class="pc-btn-primary"   id="pc-apply-btn">Use improved prompt ↗</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pc-close-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-discard-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-apply-btn').addEventListener('click', () => {
      applyImprovedPrompt(improved); removeOverlay();
    });
    pcOverlay = overlay;
  }

  function showErrorOverlay(message) {
    removeOverlay();
    const msgs = {
      RATE_LIMITED:     "You've hit the API rate limit. Please wait a moment and try again.",
      PROMPT_TOO_SHORT: 'Your prompt is too short to improve. Write a bit more first.',
      INTERNAL_SERVER_ERROR: 'The server encountered an error. Please try again later.'
    };
    const overlay = buildOverlayShell();
    overlay.innerHTML = `
      <div class="pc-overlay-inner">
        ${headerHtml()}
        <div class="pc-error">
          <div class="pc-error-icon">⚠️</div>
          <p>${msgs[message] || message}</p>
          <button class="pc-btn-secondary" id="pc-err-close">Dismiss</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#pc-close-btn').addEventListener('click', removeOverlay);
    overlay.querySelector('#pc-err-close').addEventListener('click', removeOverlay);
    pcOverlay = overlay;
  }

  // ─── Core improve logic ───────────────────────────────────────────────────

  async function triggerImprove() {
    if (isImproving) return;

    // Prefer the element the user was actually focused on (set by focus handlers).
    // Only fall back to findBestInput() if currentInput was never set.
    const input = currentInput || findBestInput();
    const rawPrompt = getInputText(input);

    if (!rawPrompt || rawPrompt.length < 3) {
      showErrorOverlay('PROMPT_TOO_SHORT');
      return;
    }

    isImproving = true;
    setButtonLoading(true);
    showLoadingOverlay(rawPrompt);

    try {
      const response = await chrome.runtime.sendMessage({
        type:         'IMPROVE_PROMPT',
        prompt:       rawPrompt,
        siteCategory: siteConfig?.category || 'UNKNOWN_AI',
        siteUrl:      window.location.hostname,
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
    const target = currentInput || findBestInput();
    if (target) { setInputText(target, text); target.focus(); }
  }

  function setButtonLoading(loading) {
    if (!pcButton) return;
    const span = pcButton.querySelector('span'); // cache the DOM query
    if (loading) {
      pcButton.classList.add('pc-loading-btn');
      span.textContent = 'Improving…';
      pcButton.disabled = true;
    } else {
      pcButton.classList.remove('pc-loading-btn');
      span.textContent = siteConfig?.label || 'Improve Prompt'; // ✦ stripped at init
      pcButton.disabled = false;
    }
  }

  function resetButton() { setButtonLoading(false); }

  // ─── Keyboard shortcut ────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener(message => {
    if (message.type === 'TRIGGER_IMPROVE') triggerImprove();
  });

  // ─── Init & SPA navigation ────────────────────────────────────────────────

  function runDetection() {
    siteConfig = getSiteConfig(); // null on unknown sites — label falls back to 'Improve Prompt'
    injectButton(); // always inject; only appears when a prompt input is focused
  }

  function init() {
    runDetection();

    // ── Auto-focus check: show button if input is already focused ──────
    function checkAutoFocus() {
      if (!pcButton) return;
      const input = findBestInput();
      if (!input) return;
      if (document.activeElement === input || input.contains(document.activeElement)) {
        currentInput = input;
        showButton(input);
      }
    }

    // Attach focus/blur DIRECTLY to the input element so programmatic
    // .focus() calls (which don't always bubble 'focusin') are also caught.
    function attachDirectListeners(inputEl) {
      if (!inputEl || inputEl._prombitAttached) return;
      inputEl._prombitAttached = true;

      inputEl.addEventListener('focus', () => {
        if (!siteConfig || !pcButton) return;
        currentInput = inputEl;
        showButton(inputEl);
      });

      inputEl.addEventListener('blur', () => {
        setTimeout(() => {
          const focused   = document.activeElement;
          const onButton  = focused?.closest('#promptcraft-btn');
          const onOverlay = focused?.closest('#promptcraft-overlay');
          if (!onButton && !onOverlay) hideButton();
        }, 200);
      });
    }

    // ── Document-level focusin: walk DOM from e.target ─────────────────
    document.addEventListener('focusin', (e) => {
      if (!siteConfig || !pcButton) return;

      let el = e.target;
      while (el && el !== document.body) {
        const tag  = el.tagName || '';
        const type = (el.getAttribute?.('type') || '').toLowerCase();
        const role = (el.getAttribute?.('role') || '').toLowerCase();

        const isEditable  = el.isContentEditable;
        const isTextarea  = tag === 'TEXTAREA';
        const isTextInput = tag === 'INPUT' && ['text', 'search', ''].includes(type);
        const isTextbox   = role === 'textbox';

        if (isEditable || isTextarea || isTextInput || isTextbox) {
          if (isPromptInput(el)) {
            currentInput = el;
            showButton(el);
            attachDirectListeners(el);
            return;
          }
        }
        el = el.parentElement;
      }
    });

    // ── Document-level focusout: hide when moving away ─────────────────
    document.addEventListener('focusout', () => {
      setTimeout(() => {
        const focused   = document.activeElement;
        const onButton  = focused?.closest('#promptcraft-btn');
        const onOverlay = focused?.closest('#promptcraft-overlay');
        if (!onButton && !onOverlay) hideButton();
      }, 200);
    });

    // ── RAF-throttled scroll/resize — max one reposition per animation frame ─
    function onScrollOrResize() {
      if (_rafPending || !pcButton || pcButton.style.display === 'none' || !currentInput) return;
      _rafPending = true;
      requestAnimationFrame(() => {
        _rafPending = false;
        if (pcButton && pcButton.style.display !== 'none' && currentInput) {
          positionButton(currentInput);
        }
      });
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    // ── Check auto-focus now; cancel later retries once input is found ───
    checkAutoFocus();
    const _t1 = setTimeout(() => { if (!currentInput) checkAutoFocus(); }, 500);
    const _t2 = setTimeout(() => { if (!currentInput) checkAutoFocus(); }, 1500);
    setTimeout(() => {
      const inp = findBestInput();
      if (inp) {
        attachDirectListeners(inp);
        clearTimeout(_t1); // input found — cancel redundant retries
        clearTimeout(_t2);
      }
    }, 600);

    // ── SPA: poll for URL changes ───────────────────────────────────────
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        invalidateInputCache(); // stale element ref — clear before re-detecting
        removeButton();
        setTimeout(() => {
          runDetection();
          setTimeout(checkAutoFocus, 200);
          setTimeout(() => {
            const inp = findBestInput();
            if (inp) attachDirectListeners(inp);
          }, 300);
        }, 800);
      }
    }, 500);

    // ── Active-element poll: show button whenever the input has focus ──
    // Handles cases where a popup (emoji picker, autocomplete, browser dialog)
    // closes and focus returns to the input without reliably firing 'focus'.
    setInterval(() => {
      if (!pcButton) return;
      const ae = document.activeElement;
      if (!ae || ae === document.body || ae === document.documentElement) return;

      const tag  = ae.tagName || '';
      const type = (ae.getAttribute?.('type') || '').toLowerCase();
      const role = (ae.getAttribute?.('role') || '').toLowerCase();
      const isEditable  = ae.isContentEditable;
      const isTextarea  = tag === 'TEXTAREA';
      const isTextInput = tag === 'INPUT' && ['text', 'search', ''].includes(type);
      const isTextbox   = role === 'textbox';

      if (isEditable || isTextarea || isTextInput || isTextbox) {
        if (isPromptInput(ae) && pcButton.style.display === 'none') {
          currentInput = ae;
          attachDirectListeners(ae);
          showButton(ae);
        }
      }
    }, 300);

    // ── Keep button injected if SPA removes it from the DOM ────────────
    // pcButton.isConnected avoids a live DOM query on every mutation
    new MutationObserver(() => {
      if (!pcButton || !pcButton.isConnected) {
        injectButton();
        setTimeout(checkAutoFocus, 100);
      }
    }).observe(document.body, { childList: true, subtree: true });
  }


  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
