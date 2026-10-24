// Sentinel — Main App Logic
import { parseText }       from './engine/parser.js';
import { detect }          from './engine/detector.js';
import { classify }        from './engine/classifier.js';
import { enforce }         from './engine/enforcer.js';
import { guardLLMInput }   from './engine/llm-guard.js';
import { RULES, LEVELS, LEVEL_NAMES } from './data/rules.js';

// ─── Tab Navigation ───────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ─── Audit Log Store ──────────────────────────────────────────────────────

const auditLog = [
  { ts: '2025-07-08 09:12:04', user: 'alice@company.io',  action: 'BLOCK',  label: 'RESTRICTED',   context: 'llm',   status: 'Blocked — M&A term detected' },
  { ts: '2025-07-08 09:14:51', user: 'bob@company.io',    action: 'REDACT', label: 'CONFIDENTIAL', context: 'llm',   status: 'API key redacted' },
  { ts: '2025-07-08 09:31:22', user: 'carol@company.io',  action: 'WARN',   label: 'CONFIDENTIAL', context: 'email', status: 'Revenue figure — flagged for approval' },
  { ts: '2025-07-08 10:02:10', user: 'dave@company.io',   action: 'ALLOW',  label: 'PUBLIC',       context: 'view',  status: 'Passed — no sensitive data' },
  { ts: '2025-07-08 10:18:45', user: 'alice@company.io',  action: 'BLOCK',  label: 'RESTRICTED',   context: 'share', status: 'Blocked — Project Nighthawk codename' },
  { ts: '2025-07-08 11:05:33', user: 'eve@company.io',    action: 'WARN',   label: 'INTERNAL',     context: 'email', status: 'Internal content shared externally' },
  { ts: '2025-07-08 11:42:17', user: 'frank@company.io',  action: 'REDACT', label: 'CONFIDENTIAL', context: 'llm',   status: 'Email address & phone redacted' },
  { ts: '2025-07-08 12:00:09', user: 'carol@company.io',  action: 'ALLOW',  label: 'PUBLIC',       context: 'share', status: 'Passed — public content' },
  { ts: '2025-07-08 13:15:58', user: 'bob@company.io',    action: 'BLOCK',  label: 'RESTRICTED',   context: 'llm',   status: 'Blocked — credit card pattern detected' },
  { ts: '2025-07-08 14:02:44', user: 'dave@company.io',   action: 'WARN',   label: 'CONFIDENTIAL', context: 'share', status: 'Salary data flagged for approval' },
];

function renderAuditLog(filter = 'ALL') {
  const tbody = document.getElementById('audit-tbody');
  const rows = filter === 'ALL' ? auditLog : auditLog.filter(r => r.action === filter);
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><span style="font-family:monospace;font-size:12px">${r.ts}</span></td>
      <td>${r.user}</td>
      <td><span class="badge badge-${r.action.toLowerCase()}">${r.action}</span></td>
      <td><span class="badge badge-${r.label.toLowerCase()}">${r.label}</span></td>
      <td><code style="font-size:11.5px">${r.context}</code></td>
      <td style="color:var(--muted);font-size:12.5px">${r.status}</td>
    </tr>
  `).join('');
}

renderAuditLog();

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAuditLog(btn.dataset.filter);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function levelClass(label) {
  return label ? label.toLowerCase() : 'public';
}

function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlightMatches(chunk, matches) {
  if (!matches || matches.length === 0) return escapeHtml(chunk);
  let text = chunk;
  // Build non-overlapping intervals
  const intervals = [];
  for (const m of matches) {
    const idx = text.toLowerCase().indexOf(m.value.toLowerCase());
    if (idx !== -1) intervals.push({ start: idx, end: idx + m.value.length, type: m.type, level: m.levelName });
  }
  intervals.sort((a, b) => a.start - b.start);
  // Merge overlapping
  const merged = [];
  for (const iv of intervals) {
    if (merged.length && iv.start < merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  let result = '';
  let cursor = 0;
  for (const iv of merged) {
    result += escapeHtml(text.slice(cursor, iv.start));
    result += `<mark class="matched" title="${escapeHtml(iv.type)}">${escapeHtml(text.slice(iv.start, iv.end))}</mark>`;
    cursor = iv.end;
  }
  result += escapeHtml(text.slice(cursor));
  return result;
}

function addAuditEntry(action, label, context, status) {
  const now = new Date();
  const ts = now.toISOString().replace('T', ' ').slice(0, 19);
  auditLog.unshift({ ts, user: 'admin@sentinel.local', action, label, context, status });
}

// ─── Tab 1: Scanner ───────────────────────────────────────────────────────

document.getElementById('scan-btn').addEventListener('click', () => {
  const input   = document.getElementById('scan-input').value.trim();
  const context = document.getElementById('scan-context').value;
  const results = document.getElementById('scan-results');

  if (!input) {
    results.innerHTML = '<p class="empty-state">Paste some text above and click Scan & Enforce.</p>';
    return;
  }

  const chunks    = parseText(input);
  const detected  = detect(chunks);
  const classified = classify(detected);

  const { chunks: cls, documentLevel, summary } = classified;

  // Compute per-chunk enforcement
  const enforced = cls.map(c => ({
    ...c,
    enforcement: enforce(c.chunk, c.label, c.matches, context),
  }));

  // Sanitised output: join all sanitised chunks
  const sanitisedFull = enforced.map(e => e.enforcement.sanitised ?? '[BLOCKED]').join(' ');

  // Add audit entry
  const topAction = enforced.find(e => e.enforcement.action === 'BLOCK')  ? 'BLOCK'
                  : enforced.find(e => e.enforcement.action === 'REDACT') ? 'REDACT'
                  : enforced.find(e => e.enforcement.action === 'WARN')   ? 'WARN'
                  : 'ALLOW';
  addAuditEntry(topAction, documentLevel, context, `Scanned ${cls.length} chunk(s)`);

  results.innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:16px">
      <span class="doc-level-badge ${documentLevel}">
        ${levelIcon(documentLevel)} Document Level: ${documentLevel}
      </span>
      <div class="summary-bar">
        <span class="summary-pill badge-restricted">${summary.restricted} Restricted</span>
        <span class="summary-pill badge-confidential">${summary.confidential} Confidential</span>
        <span class="summary-pill badge-internal">${summary.internal} Internal</span>
        <span class="summary-pill badge-public">${summary.public} Public</span>
      </div>
    </div>
    <div class="chunk-list">
      ${enforced.map((e, i) => renderChunkCard(e, i)).join('')}
    </div>
    ${sanitisedFull !== input ? `
    <div class="sanitised-box mt-20">
      <div class="sanitised-box-header">✦ Sanitised Output</div>
      <div class="sanitised-box-body">${escapeHtml(sanitisedFull)}</div>
    </div>` : ''}
  `;
});

function levelIcon(label) {
  const icons = { PUBLIC: '🟢', INTERNAL: '🟡', CONFIDENTIAL: '🟠', RESTRICTED: '🔴' };
  return icons[label] || '⚪';
}

function renderChunkCard(e, i) {
  const action = e.enforcement.action;
  const highlighted = action === 'REDACT'
    ? escapeHtml(e.enforcement.sanitised || e.chunk)
    : highlightMatches(e.chunk, e.matches);

  const matchTags = e.matches.length
    ? e.matches.map(m => `<span class="badge badge-${levelClass(m.levelName)}" style="font-size:10px;margin-left:4px">${escapeHtml(m.type)}</span>`).join('')
    : '';

  return `
    <div class="chunk-card">
      <div class="chunk-header">
        <span style="color:var(--muted);font-size:11px">#${i + 1}</span>
        <span class="badge badge-${levelClass(e.label)}">${e.label}</span>
        <span class="badge badge-${action.toLowerCase()}">${action}</span>
        ${matchTags}
      </div>
      <div class="chunk-body">${highlighted}</div>
      <div class="chunk-reason">${escapeHtml(e.enforcement.reason)}</div>
    </div>
  `;
}

// ─── Tab 2: LLM Guard ────────────────────────────────────────────────────

document.getElementById('llm-btn').addEventListener('click', () => {
  const input  = document.getElementById('llm-input').value.trim();
  const origEl = document.getElementById('llm-original');
  const saniEl = document.getElementById('llm-sanitised');
  const banner = document.getElementById('llm-banner');
  const redEl  = document.getElementById('llm-redactions');

  if (!input) {
    origEl.textContent  = '';
    saniEl.textContent  = '';
    banner.className    = 'banner hidden';
    redEl.innerHTML     = '';
    return;
  }

  const result = guardLLMInput(input);

  origEl.textContent = input;
  saniEl.textContent = result.sanitised || '';

  if (!result.allowed) {
    banner.className   = 'banner banner-blocked';
    banner.innerHTML   = `🔴 <span>Blocked — ${escapeHtml(result.reason)}</span>`;
    addAuditEntry('BLOCK', 'RESTRICTED', 'llm', result.reason);
  } else {
    banner.className   = result.redactions.length ? 'banner banner-safe' : 'banner banner-safe';
    banner.innerHTML   = result.redactions.length
      ? `🟡 <span>Sent with ${result.redactions.length} redaction(s) — review sanitised output</span>`
      : `🟢 <span>Safe to send — no sensitive data detected</span>`;
    addAuditEntry(result.redactions.length ? 'REDACT' : 'ALLOW',
                  result.redactions.length ? 'CONFIDENTIAL' : 'PUBLIC',
                  'llm', `${result.redactions.length} redaction(s)`);
  }

  if (result.redactions && result.redactions.length) {
    redEl.innerHTML = `
      <div class="card-title mt-16">Redactions</div>
      ${result.redactions.map(r => `
        <div class="redaction-item">
          <span class="ri-orig">${escapeHtml(truncate(r.original, 30))}</span>
          <span class="ri-arrow">→</span>
          <span class="ri-token">[${escapeHtml(r.placeholder)}]</span>
          <span class="ri-reason">${escapeHtml(r.reason)}</span>
        </div>
      `).join('')}
    `;
  } else {
    redEl.innerHTML = '';
  }

  // Blocked chunks detail
  if (result.blockedChunks && result.blockedChunks.length) {
    redEl.innerHTML += `
      <div class="card-title mt-16" style="color:var(--red)">Blocked Chunks</div>
      ${result.blockedChunks.map(bc => `
        <div class="redaction-item" style="flex-direction:column;align-items:flex-start">
          <span style="font-size:12px;font-family:monospace;color:var(--red)">${escapeHtml(bc.chunk)}</span>
          <span style="font-size:11.5px;color:var(--muted)">${escapeHtml(bc.reason)}</span>
        </div>
      `).join('')}
    `;
  }
});

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

// ─── Tab 4: Policy Config ────────────────────────────────────────────────

function renderRules() {
  const grid = document.getElementById('rules-grid');

  // Built-in pattern rules
  const patternCards = Object.entries(RULES.patterns).map(([key, def]) => `
    <div class="rule-card">
      <div class="rule-card-header">
        <span class="rule-card-name">${escapeHtml(def.label)}</span>
        <span class="badge badge-${levelClass(LEVEL_NAMES[def.level])}">${LEVEL_NAMES[def.level]}</span>
      </div>
      <div class="rule-card-meta">${escapeHtml(def.regex.source.slice(0, 60))}${def.regex.source.length > 60 ? '…' : ''}</div>
      <div style="font-size:11.5px;color:var(--muted)">Layer 1 · Regex Pattern</div>
    </div>
  `).join('');

  // Entity keyword rules
  const entityCards = Object.entries(RULES.entities).map(([, def]) => `
    <div class="rule-card">
      <div class="rule-card-header">
        <span class="rule-card-name">${escapeHtml(def.label)}</span>
        <span class="badge badge-${levelClass(LEVEL_NAMES[def.level])}">${LEVEL_NAMES[def.level]}</span>
      </div>
      <div class="rule-card-meta">${def.keywords.slice(0, 4).join(', ')}${def.keywords.length > 4 ? ` +${def.keywords.length - 4} more` : ''}</div>
      <div style="font-size:11.5px;color:var(--muted)">Layer 2 · Keyword List</div>
    </div>
  `).join('');

  // Custom rules with toggles
  const customCards = RULES.customRules.map((rule, idx) => `
    <div class="rule-card" id="custom-rule-${idx}">
      <div class="rule-card-header">
        <span class="rule-card-name">${escapeHtml(rule.name)}</span>
        <span class="badge badge-${levelClass(LEVEL_NAMES[rule.level])}">${LEVEL_NAMES[rule.level]}</span>
        <label class="toggle" style="margin-left:auto">
          <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-custom-idx="${idx}" class="custom-rule-toggle">
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
      <div class="rule-card-meta">${escapeHtml(rule.pattern)}</div>
      <div style="font-size:11.5px;color:var(--muted)">Layer 4 · Custom Rule · ${escapeHtml(rule.label)}</div>
    </div>
  `).join('');

  grid.innerHTML = patternCards + entityCards + customCards;

  // Attach toggle listeners
  grid.querySelectorAll('.custom-rule-toggle').forEach(cb => {
    cb.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.customIdx);
      RULES.customRules[idx].enabled = e.target.checked;
    });
  });
}

renderRules();

// Add custom rule form
document.getElementById('add-rule-btn').addEventListener('click', () => {
  const name    = document.getElementById('new-rule-name').value.trim();
  const pattern = document.getElementById('new-rule-pattern').value.trim();
  const level   = parseInt(document.getElementById('new-rule-level').value);
  const msgEl   = document.getElementById('add-rule-msg');

  if (!name || !pattern) {
    msgEl.textContent = 'Name and Pattern are required.';
    msgEl.style.color = 'var(--red)';
    return;
  }
  try { new RegExp(pattern); } catch(_) {
    msgEl.textContent = 'Invalid regex pattern.';
    msgEl.style.color = 'var(--red)';
    return;
  }

  RULES.customRules.push({ name, pattern, label: name, level, enabled: true });
  renderRules();

  document.getElementById('new-rule-name').value    = '';
  document.getElementById('new-rule-pattern').value = '';
  document.getElementById('new-rule-level').value   = '2';
  msgEl.textContent = `✓ Rule "${name}" added successfully.`;
  msgEl.style.color = 'var(--green)';
  setTimeout(() => { msgEl.textContent = ''; }, 3000);
});
