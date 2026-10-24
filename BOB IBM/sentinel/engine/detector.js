// Sentinel — Detection Engine (4 Layers)

import { RULES, LEVELS, LEVEL_NAMES } from '../data/rules.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

function levelName(n) {
  return LEVEL_NAMES[n] ?? 'PUBLIC';
}

// Reset lastIndex on all regexes before running (global flag reuse issue)
function freshRegex(r) {
  const flags = r.flags.includes('g') ? r.flags : r.flags + 'g';
  return new RegExp(r.source, flags);
}

// ─── Layer 1: Regex Patterns ───────────────────────────────────────────────

function layer1(chunk) {
  const matches = [];
  for (const [key, def] of Object.entries(RULES.patterns)) {
    const re = freshRegex(def.regex);
    let m;
    while ((m = re.exec(chunk)) !== null) {
      matches.push({
        layer: 1,
        type: def.label,
        value: m[0],
        level: def.level,
        levelName: levelName(def.level),
      });
    }
  }
  return matches;
}

// ─── Layer 2: Entity / Keyword Matching ────────────────────────────────────

function layer2(chunk) {
  const lower = chunk.toLowerCase();
  const matches = [];
  for (const [, def] of Object.entries(RULES.entities)) {
    for (const kw of def.keywords) {
      // word boundary-aware check
      const re = new RegExp(`\\b${kw.replace(/[-]/g, '\\-')}\\b`, 'i');
      if (re.test(lower)) {
        matches.push({
          layer: 2,
          type: def.label,
          value: kw,
          level: def.level,
          levelName: levelName(def.level),
        });
      }
    }
  }
  return matches;
}

// ─── Layer 3: Heuristic Semantic Rules ─────────────────────────────────────

const HEURISTIC_RESTRICTED = [
  "never tell", "don't share", "dont share", "between us", "keep this secret",
  "off the record", "do not forward", "not for distribution", "eyes only",
  "strictly confidential",
];

const HEURISTIC_CONFIDENTIAL = [
  "acquire", "pivot", "runway", "burn rate", "closing", "term sheet",
  "due diligence", "letter of intent", "strategic plan", "restructure",
  "down round", "bridge financing", "inside information",
];

function layer3(chunk) {
  const lower = chunk.toLowerCase();
  const matches = [];

  for (const phrase of HEURISTIC_RESTRICTED) {
    if (lower.includes(phrase)) {
      matches.push({
        layer: 3,
        type: 'Heuristic (Restricted)',
        value: phrase,
        level: LEVELS.RESTRICTED,
        levelName: 'RESTRICTED',
      });
    }
  }

  for (const phrase of HEURISTIC_CONFIDENTIAL) {
    if (lower.includes(phrase)) {
      matches.push({
        layer: 3,
        type: 'Heuristic (Confidential)',
        value: phrase,
        level: LEVELS.CONFIDENTIAL,
        levelName: 'CONFIDENTIAL',
      });
    }
  }

  return matches;
}

// ─── Layer 4: Custom Rules ─────────────────────────────────────────────────

function layer4(chunk) {
  const matches = [];
  for (const rule of RULES.customRules) {
    if (!rule.enabled) continue;
    try {
      const re = new RegExp(rule.pattern, 'gi');
      let m;
      while ((m = re.exec(chunk)) !== null) {
        matches.push({
          layer: 4,
          type: rule.label,
          value: m[0],
          level: rule.level,
          levelName: levelName(rule.level),
        });
      }
    } catch (_) {
      // invalid regex — skip
    }
  }
  return matches;
}

// ─── Main Detect ───────────────────────────────────────────────────────────

/**
 * Runs all 4 detection layers on each chunk.
 * @param {Array<{chunk: string, index: number}>} chunks
 * @returns {Array<{chunk, index, matches, highestLevel}>}
 */
export function detect(chunks) {
  return chunks.map(({ chunk, index }) => {
    const matches = [
      ...layer1(chunk),
      ...layer2(chunk),
      ...layer3(chunk),
      ...layer4(chunk),
    ];

    const highestLevel = matches.reduce((max, m) => Math.max(max, m.level), LEVELS.PUBLIC);

    return { chunk, index, matches, highestLevel };
  });
}
