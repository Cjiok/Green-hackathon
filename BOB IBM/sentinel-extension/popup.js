// Sentinel Popup Script — no inline script allowed under MV3 CSP
'use strict';

const LEVEL_NAMES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

// ── Toggle ────────────────────────────────────────────────────────────────────
const toggle     = document.getElementById('main-toggle');
const statusDot  = document.getElementById('status-dot');
const statusLabel = document.getElementById('status-label');

chrome.storage.sync.get(['sentinelEnabled'], (data) => {
  setToggle(data.sentinelEnabled !== false);
});

toggle.addEventListener('click', () => {
  const on = !toggle.classList.contains('on');
  chrome.storage.sync.set({ sentinelEnabled: on });
  setToggle(on);
});

function setToggle(on) {
  toggle.classList.toggle('on', on);
  statusDot.classList.toggle('off', !on);
  statusLabel.textContent = on ? 'Active' : 'Paused';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab).classList.add('active');
  });
});

// ── Log ───────────────────────────────────────────────────────────────────────
function loadLog() {
  chrome.runtime.sendMessage({ type: 'GET_LOG' }, (res) => {
    const log = (res && res.log) ? res.log : [];
    renderLog(log);
    renderSummary(log);
  });
}

function renderSummary(log) {
  const today = new Date().toDateString();
  const todayLog = log.filter(e => new Date(e.ts).toDateString() === today);
  const count = (action) => todayLog.filter(e => e.action === action).length;
  document.getElementById('count-block').textContent  = count('BLOCK');
  document.getElementById('count-redact').textContent = count('REDACT');
  document.getElementById('count-warn').textContent   = count('WARN');
  document.getElementById('count-allow').textContent  = count('ALLOW') + count('ALLOW_OVERRIDE');
}

function renderLog(log) {
  const container = document.getElementById('log-container');
  if (!log.length) {
    container.innerHTML = '<div class="empty-log">No events logged yet.<br>Start typing in an LLM to see Sentinel in action.</div>';
    return;
  }
  container.innerHTML = log.slice(0, 40).map(e => {
    const action = e.action || 'ALLOW';
    const ts = new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="log-entry">
        <div class="log-top">
          <span class="badge badge-${action.toLowerCase()}">${action}</span>
          <span class="log-site">${e.site || 'unknown'}</span>
          <span class="log-ts">${ts}</span>
        </div>
        <div class="log-findings">${e.findings || '—'}</div>
      </div>`;
  }).join('');
}

document.getElementById('clear-log-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_LOG' });
  document.getElementById('log-container').innerHTML = '<div class="empty-log">Log cleared.</div>';
  document.getElementById('count-block').textContent  = '0';
  document.getElementById('count-redact').textContent = '0';
  document.getElementById('count-warn').textContent   = '0';
  document.getElementById('count-allow').textContent  = '0';
});

loadLog();

// ── Custom Rules ──────────────────────────────────────────────────────────────
function loadRules() {
  chrome.storage.sync.get(['sentinelCustomRules'], (data) => {
    renderRules(data.sentinelCustomRules || []);
  });
}

function renderRules(rules) {
  const container = document.getElementById('custom-rules-list');
  if (!rules.length) {
    container.innerHTML = '<div style="font-size:12px;color:#57606a;margin-bottom:10px">No custom rules yet. Add one below.</div>';
    return;
  }
  container.innerHTML = rules.map((rule, idx) => `
    <div class="rule-item">
      <div>
        <div class="rule-name">${esc(rule.name)}</div>
        <div class="rule-level">${LEVEL_NAMES[rule.level] || 'CONFIDENTIAL'} · ${esc(rule.pattern)}</div>
      </div>
      <div class="rule-toggle ${rule.enabled ? 'on' : ''}" data-idx="${idx}">
        <div class="rule-toggle-knob"></div>
      </div>
    </div>`).join('');

  container.querySelectorAll('.rule-toggle').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      chrome.storage.sync.get(['sentinelCustomRules'], (data) => {
        const rules = data.sentinelCustomRules || [];
        rules[idx].enabled = !rules[idx].enabled;
        chrome.storage.sync.set({ sentinelCustomRules: rules });
        renderRules(rules);
      });
    });
  });
}

document.getElementById('add-rule-btn').addEventListener('click', () => {
  const name    = document.getElementById('r-name').value.trim();
  const pattern = document.getElementById('r-pattern').value.trim();
  const level   = parseInt(document.getElementById('r-level').value);
  const msgEl   = document.getElementById('rule-msg');

  if (!name || !pattern) {
    msgEl.textContent = 'Name and pattern required.';
    msgEl.style.color = '#ef4444';
    return;
  }
  try { new RegExp(pattern); } catch (_) {
    msgEl.textContent = 'Invalid regex.';
    msgEl.style.color = '#ef4444';
    return;
  }

  chrome.storage.sync.get(['sentinelCustomRules'], (data) => {
    const rules = data.sentinelCustomRules || [];
    rules.push({ name, pattern, label: name, level, enabled: true });
    chrome.storage.sync.set({ sentinelCustomRules: rules });
    renderRules(rules);
    document.getElementById('r-name').value    = '';
    document.getElementById('r-pattern').value = '';
    msgEl.textContent = `✓ Rule "${name}" added.`;
    msgEl.style.color = '#22c55e';
    setTimeout(() => { msgEl.textContent = ''; }, 3000);
  });
});

loadRules();

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
