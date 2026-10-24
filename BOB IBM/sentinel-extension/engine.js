// Sentinel Detection Engine — shared by content script and popup
// Loaded before content.js via manifest order

const SENTINEL_LEVELS = { PUBLIC: 0, INTERNAL: 1, CONFIDENTIAL: 2, RESTRICTED: 3 };
const SENTINEL_LEVEL_NAMES = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

const SENTINEL_RULES = {
  patterns: [
    { regex: /\b(sk_live_|sk_prod_|sk-[A-Za-z0-9]{20,}|api[_-]?key[_-]?[:=]\s*)[A-Za-z0-9_\-]{16,}/gi,                                           label: 'API Key',        level: 3 },
    { regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/gi,                                                                                            label: 'Private Key',    level: 3 },
    { regex: /\b(password|passwd|secret|token)\s*[:=]\s*\S+/gi,                                                                                    label: 'Credential',     level: 3 },
    { regex: /\b(?:\d[ -]?){13,16}\b/g,                                                                                                            label: 'Credit Card',    level: 3 },
    { regex: /\b\d{3}-\d{2}-\d{4}\b/g,                                                                                                             label: 'SSN',            level: 3 },
    { regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,                                                                              label: 'IBAN',           level: 3 },
    { regex: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g,                                                                            label: 'Email Address',  level: 2 },
    { regex: /(\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g,                                                                            label: 'Phone Number',   level: 2 },
    { regex: /(\$|€|£|EUR|USD|GBP)\s*\d[\d,]*\.?\d*\s*[kmb]?\b|\b\d[\d,]*\.?\d*\s*(euros?|dollars?|pounds?|thousand|million|billion|[kmb])\b/gi, label: 'Money Amount',   level: 2 },
  ],
  keywords: [
    { words: ['burn rate','runway','arr','mrr','cap table','term sheet','series a','series b','pre-money','post-money','convertible note','safe note'], label: 'Financial Data',   level: 2 },
    { words: ['acquisition','merger','acquiring','acquire','due diligence','letter of intent','nda','non-disclosure','litigation','lawsuit'],           label: 'Legal / M&A',      level: 3 },
    { words: ['salary','compensation','stock options','fired','laid off','performance review','offer letter'],                                          label: 'HR / Personnel',   level: 2 },
    { words: ["never tell","don't share","between us","off the record","do not share","keep this quiet","pivot","not public"],                         label: 'Strategic Secret', level: 3 },
  ],
  semantic: [
    { pattern: /\b(never tell|don.t share|between us|off the record|keep this quiet)\b/i, label: 'Strategic Secret', level: 3 },
    { pattern: /\b(acquire|acquiring|acquisition|merger|due diligence)\b/i,               label: 'M&A Activity',     level: 3 },
    { pattern: /\b(term sheet|closing|round closes|fundraise|raise)\b/i,                  label: 'Funding Activity', level: 3 },
    { pattern: /\b(burn rate|runway|months of runway)\b/i,                                label: 'Financial Health', level: 2 },
    { pattern: /\b(pivot|pivoting|secret project|stealth)\b/i,                            label: 'Strategic Pivot',  level: 3 },
  ],
  // Loaded from storage, defaults here
  custom: []
};

function sentinelScan(text) {
  if (!text || text.trim().length < 3) return { level: 0, findings: [] };

  const findings = [];
  const lower = text.toLowerCase();

  // Layer 1 — regex patterns
  for (const rule of SENTINEL_RULES.patterns) {
    const re = new RegExp(rule.regex.source, rule.regex.flags);
    let m;
    while ((m = re.exec(text)) !== null) {
      findings.push({ label: rule.label, value: m[0], level: rule.level, layer: 1 });
    }
  }

  // Layer 2 — keyword matching
  for (const group of SENTINEL_RULES.keywords) {
    for (const word of group.words) {
      if (lower.includes(word)) {
        findings.push({ label: group.label, value: word, level: group.level, layer: 2 });
        break;
      }
    }
  }

  // Layer 3 — semantic heuristics
  for (const rule of SENTINEL_RULES.semantic) {
    const m = text.match(rule.pattern);
    if (m) findings.push({ label: rule.label, value: m[0], level: rule.level, layer: 3 });
  }

  // Layer 4 — custom rules (loaded from storage)
  for (const rule of SENTINEL_RULES.custom) {
    if (!rule.enabled) continue;
    try {
      const re = new RegExp(rule.pattern, 'gi');
      let m;
      while ((m = re.exec(text)) !== null) {
        findings.push({ label: rule.label || rule.name, value: m[0], level: rule.level, layer: 4 });
      }
    } catch (_) {}
  }

  // Deduplicate by value
  const seen = new Set();
  const unique = findings.filter(f => {
    const key = f.value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });

  const highestLevel = unique.reduce((max, f) => Math.max(max, f.level), 0);
  return { level: highestLevel, levelName: SENTINEL_LEVEL_NAMES[highestLevel], findings: unique };
}

function sentinelRedact(text) {
  let out = text;
  const placeholders = {
    'API Key':        'REDACTED_API_KEY',
    'Private Key':    'REDACTED_PRIVATE_KEY',
    'Credential':     'REDACTED_CREDENTIAL',
    'Credit Card':    'REDACTED_CARD',
    'SSN':            'REDACTED_SSN',
    'IBAN':           'REDACTED_IBAN',
    'Email Address':  'REDACTED_EMAIL',
    'Phone Number':   'REDACTED_PHONE',
    'Money Amount':   'REDACTED_AMOUNT',
  };
  for (const rule of SENTINEL_RULES.patterns) {
    const ph = placeholders[rule.label] || 'REDACTED';
    const re = new RegExp(rule.regex.source, rule.regex.flags);
    out = out.replace(re, `[${ph}]`);
  }
  for (const rule of SENTINEL_RULES.custom) {
    if (!rule.enabled) continue;
    try {
      out = out.replace(new RegExp(rule.pattern, 'gi'), '[REDACTED_CUSTOM]');
    } catch (_) {}
  }
  return out;
}
