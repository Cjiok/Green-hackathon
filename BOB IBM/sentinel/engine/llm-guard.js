// Sentinel — LLM Guard Layer

import { parseText }   from './parser.js';
import { detect }      from './detector.js';
import { classify }    from './classifier.js';
import { enforce }     from './enforcer.js';

// Placeholder token map — replace sensitive types with descriptive tokens
const PLACEHOLDER_MAP = {
  'API Key':           'REDACTED_API_KEY',
  'Password / Token':  'REDACTED_TOKEN',
  'Credit Card Number':'REDACTED_CARD',
  'SSN':               'REDACTED_SSN',
  'Private Key':       'REDACTED_PRIVATE_KEY',
  'Email Address':     'REDACTED_EMAIL',
  'Phone Number':      'REDACTED_PHONE',
  'Revenue Figure':    'REDACTED_REVENUE',
  'Financial Term':    'REDACTED_FINANCIAL',
  'Legal Term':        'REDACTED_LEGAL',
  'M&A Term':          'REDACTED_MA',
  'HR Term':           'REDACTED_HR',
  'Project Codename':  'REDACTED_PROJECT',
};

function tokenise(chunk, matches) {
  let sanitised = chunk;
  const sorted = [...matches].sort((a, b) => b.value.length - a.value.length);
  for (const m of sorted) {
    const placeholder = PLACEHOLDER_MAP[m.type] || 'REDACTED';
    const escaped = m.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitised = sanitised.replace(new RegExp(escaped, 'gi'), `[${placeholder}]`);
  }
  return sanitised;
}

/**
 * Runs the full Sentinel pipeline with context='llm'.
 *
 * @param {string} text — raw LLM prompt text
 * @returns {{ allowed: boolean, sanitised?: string, redactions?: Array, reason?: string, blockedChunks?: Array }}
 */
export function guardLLMInput(text) {
  const chunks   = parseText(text);
  const detected = detect(chunks);
  const { chunks: classified } = classify(detected);

  const blockedChunks = [];
  const redactions    = [];
  const sanitisedParts = [];

  for (const chunk of classified) {
    const result = enforce(chunk.chunk, chunk.label, chunk.matches, 'llm');

    if (result.action === 'BLOCK') {
      blockedChunks.push({
        chunk:   chunk.chunk,
        label:   chunk.label,
        matches: chunk.matches,
        reason:  result.reason,
      });
      // Still need to produce some output — use a full block marker
      sanitisedParts.push(`[BLOCKED: ${chunk.label} CONTENT REMOVED]`);
    } else if (result.action === 'REDACT') {
      // Use descriptive tokens instead of generic [REDACTED]
      const tokenised = tokenise(chunk.chunk, chunk.matches);
      sanitisedParts.push(tokenised);

      for (const m of chunk.matches) {
        redactions.push({
          original:    m.value,
          type:        m.type,
          placeholder: PLACEHOLDER_MAP[m.type] || 'REDACTED',
          reason:      `${m.type} detected (Layer ${m.layer}) — ${m.levelName}`,
        });
      }
    } else {
      sanitisedParts.push(chunk.chunk);
    }
  }

  if (blockedChunks.length > 0) {
    return {
      allowed:       false,
      reason:        `${blockedChunks.length} RESTRICTED chunk(s) blocked. Cannot send to LLM.`,
      blockedChunks,
      sanitised:     sanitisedParts.join(' '),
      redactions,
    };
  }

  return {
    allowed:   true,
    sanitised: sanitisedParts.join(' '),
    redactions,
  };
}
