// Sentinel Content Script
// Intercepts text input on ChatGPT, Claude, Gemini, Copilot, Perplexity

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────────────────────────
  const SITE_SELECTORS = {
    // Submit buttons and input areas per site
    'chatgpt.com':          { input: '#prompt-textarea',                     submit: '[data-testid="send-button"], button[aria-label="Send prompt"]' },
    'chat.openai.com':      { input: '#prompt-textarea',                     submit: '[data-testid="send-button"], button[aria-label="Send prompt"]' },
    'claude.ai':            { input: '[contenteditable="true"]',             submit: 'button[aria-label="Send Message"], button[type="submit"]' },
    'gemini.google.com':    { input: '.ql-editor, [contenteditable="true"]', submit: 'button[aria-label="Send message"], .send-button' },
    'copilot.microsoft.com':{ input: 'textarea[placeholder], #userInput',    submit: 'button[aria-label="Submit"], button[type="submit"]' },
    'www.bing.com':         { input: '#searchbox, textarea',                 submit: 'button[aria-label="Submit"], #search_icon_searchbox' },
    'perplexity.ai':        { input: 'textarea',                             submit: 'button[aria-label="Submit"]' },
  };

  const hostname = location.hostname;
  const siteConfig = Object.entries(SITE_SELECTORS).find(([host]) => hostname.includes(host));
  if (!siteConfig) return;
  const selectors = siteConfig[1];

  // ── State ───────────────────────────────────────────────────────────────────
  let bannerEl = null;
  let currentScanResult = null;
  let interceptEnabled = true;
  let lastText = '';

  // Load settings from storage
  chrome.storage.sync.get(['sentinelEnabled', 'sentinelCustomRules'], (data) => {
    interceptEnabled = data.sentinelEnabled !== false;
    if (data.sentinelCustomRules) {
      SENTINEL_RULES.custom = data.sentinelCustomRules;
    }
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.sentinelEnabled !== undefined) interceptEnabled = changes.sentinelEnabled.newValue !== false;
    if (changes.sentinelCustomRules) SENTINEL_RULES.custom = changes.sentinelCustomRules.newValue || [];
  });

  // ── Banner injection ─────────────────────────────────────────────────────────
  function createBanner() {
    if (bannerEl) return;
    bannerEl = document.createElement('div');
    bannerEl.id = 'sentinel-banner';
    bannerEl.innerHTML = `
      <div id="sentinel-banner-inner">
        <span id="sentinel-icon">🛡️</span>
        <div id="sentinel-content">
          <div id="sentinel-title"></div>
          <div id="sentinel-details"></div>
        </div>
        <div id="sentinel-actions">
          <button id="sentinel-btn-redact">Send Redacted</button>
          <button id="sentinel-btn-block">Block</button>
          <button id="sentinel-btn-allow">Allow Anyway</button>
          <button id="sentinel-btn-dismiss">✕</button>
        </div>
      </div>`;
    document.body.appendChild(bannerEl);

    document.getElementById('sentinel-btn-dismiss').addEventListener('click', hideBanner);
    document.getElementById('sentinel-btn-block').addEventListener('click', () => {
      clearInput();
      showToast('🚫 Message blocked. Input cleared.', 'blocked');
      hideBanner();
      logEvent('BLOCK', currentScanResult);
    });
    document.getElementById('sentinel-btn-allow').addEventListener('click', () => {
      hideBanner();
      logEvent('ALLOW_OVERRIDE', currentScanResult);
      showToast('⚠️ Allowed with override — logged.', 'warn');
      // Let the submit proceed naturally — user already clicked or will click
    });
    document.getElementById('sentinel-btn-redact').addEventListener('click', () => {
      const redacted = sentinelRedact(lastText);
      setInputText(redacted);
      hideBanner();
      logEvent('REDACT', currentScanResult);
      showToast('✂️ Sensitive data redacted. Review before sending.', 'redact');
    });
  }

  function showBanner(result) {
    if (!bannerEl) createBanner();
    currentScanResult = result;

    const levelColors = { 1: '#f59e0b', 2: '#f97316', 3: '#ef4444' };
    const levelLabels = { 1: 'INTERNAL', 2: 'CONFIDENTIAL', 3: '🔴 RESTRICTED' };
    const color = levelColors[result.level] || '#f97316';
    const label = levelLabels[result.level] || result.levelName;

    bannerEl.style.borderLeftColor = color;
    document.getElementById('sentinel-title').innerHTML =
      `<strong style="color:${color}">Sentinel: ${label} data detected</strong>`;
    document.getElementById('sentinel-details').innerHTML =
      result.findings.slice(0, 4).map(f =>
        `<span class="sentinel-tag" style="border-color:${color};color:${color}">${f.label}</span>`
      ).join('') + (result.findings.length > 4 ? `<span class="sentinel-tag">+${result.findings.length - 4} more</span>` : '');

    bannerEl.classList.add('sentinel-visible');

    // Show/hide redact button only for CONFIDENTIAL (not RESTRICTED which must be blocked)
    document.getElementById('sentinel-btn-redact').style.display = result.level === 2 ? 'inline-block' : 'none';
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('sentinel-visible');
  }

  // ── Toast notification ───────────────────────────────────────────────────────
  function showToast(msg, type) {
    const toast = document.createElement('div');
    toast.className = `sentinel-toast sentinel-toast-${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('sentinel-toast-show'), 10);
    setTimeout(() => {
      toast.classList.remove('sentinel-toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ── Input helpers ────────────────────────────────────────────────────────────
  function getInputText() {
    const el = document.querySelector(selectors.input);
    if (!el) return '';
    return el.value !== undefined ? el.value : el.innerText || el.textContent || '';
  }

  function setInputText(text) {
    const el = document.querySelector(selectors.input);
    if (!el) return;
    if (el.value !== undefined) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      el.innerText = text;
      el.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  }

  function clearInput() {
    setInputText('');
  }

  // ── Scan on typing (debounced) ───────────────────────────────────────────────
  let debounceTimer = null;

  function onInput() {
    if (!interceptEnabled) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const text = getInputText();
      lastText = text;
      if (text.trim().length < 10) { hideBanner(); return; }
      const result = sentinelScan(text);
      if (result.level >= 2) {
        showBanner(result);
      } else {
        hideBanner();
      }
    }, 600); // 600ms debounce — scan after user pauses typing
  }

  // ── Intercept submit button ──────────────────────────────────────────────────
  function interceptSubmit(e) {
    if (!interceptEnabled) return;
    const text = getInputText();
    lastText = text;
    if (text.trim().length < 3) return;

    const result = sentinelScan(text);
    if (result.level >= 2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showBanner(result);
    }
  }

  // ── Intercept Enter key ──────────────────────────────────────────────────────
  function interceptKeydown(e) {
    if (!interceptEnabled) return;
    if (e.key !== 'Enter' || e.shiftKey) return;
    const el = document.querySelector(selectors.input);
    if (!el || !el.contains(e.target) && e.target !== el) return;

    const text = getInputText();
    lastText = text;
    if (text.trim().length < 3) return;

    const result = sentinelScan(text);
    if (result.level >= 2) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showBanner(result);
    }
  }

  // ── Event binding (with retry for SPAs) ─────────────────────────────────────
  function bindEvents() {
    const inputEl = document.querySelector(selectors.input);
    if (inputEl) {
      inputEl.addEventListener('input', onInput);
    }

    // Submit button — use capture to intercept before the page's own handler
    document.addEventListener('click', (e) => {
      const submitBtn = e.target.closest(selectors.submit);
      if (submitBtn) interceptSubmit(e);
    }, true);

    // Enter key — capture phase
    document.addEventListener('keydown', interceptKeydown, true);
  }

  // SPAs load content dynamically — retry binding until input exists
  let bindAttempts = 0;
  function tryBind() {
    bindEvents();
    if (!document.querySelector(selectors.input) && bindAttempts < 20) {
      bindAttempts++;
      setTimeout(tryBind, 1000);
    }
  }

  // Re-bind on SPA navigation
  const observer = new MutationObserver(() => {
    if (document.querySelector(selectors.input)) bindEvents();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  tryBind();

  // ── Log events to background ─────────────────────────────────────────────────
  function logEvent(action, result) {
    chrome.runtime.sendMessage({
      type: 'SENTINEL_LOG',
      payload: {
        ts: new Date().toISOString(),
        action,
        site: hostname,
        level: result ? result.levelName : 'UNKNOWN',
        findings: result ? result.findings.map(f => f.label).join(', ') : ''
      }
    });
  }

})();
