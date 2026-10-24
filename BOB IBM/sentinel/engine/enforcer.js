// Sentinel — Enforcer

import { LEVELS } from '../data/rules.js';

// Contexts treated as "external" for INTERNAL warnings
const EXTERNAL_CONTEXTS = ['share', 'email'];

/**
 * Redacts known sensitive values from a chunk by replacing each matched
 * value with [REDACTED].
 */
function redactChunk(chunk, matches) {
  let sanitised = chunk;
  // Sort matches longest-first to avoid partial overlap issues
  const sorted = [...matches].sort((a, b) => b.value.length - a.value.length);
  for (const m of sorted) {
    // Escape the matched value for use in a regex
    const escaped = m.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    sanitised = sanitised.replace(new RegExp(escaped, 'gi'), '[REDACTED]');
  }
  return sanitised;
}

/**
 * Enforce policy on a single chunk.
 *
 * @param {string}  chunk    — original text chunk
 * @param {string}  label    — 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED'
 * @param {Array}   matches  — matches array from detector
 * @param {string}  context  — 'llm' | 'share' | 'email' | 'view'
 * @returns {{ action: string, sanitised: string|null, reason: string }}
 */
export function enforce(chunk, label, matches, context) {
  const ctx = (context || 'view').toLowerCase();

  // PUBLIC — always allow
  if (label === 'PUBLIC') {
    return {
      action: 'ALLOW',
      sanitised: chunk,
      reason: 'Content is public — no restrictions.',
    };
  }

  // RESTRICTED — always block regardless of context
  if (label === 'RESTRICTED') {
    return {
      action: 'BLOCK',
      sanitised: null,
      reason: `Restricted content cannot be used in context "${ctx}". Matched: ${matches.map(m => m.type).join(', ') || 'custom rule'}.`,
    };
  }

  // CONFIDENTIAL
  if (label === 'CONFIDENTIAL') {
    if (ctx === 'llm') {
      return {
        action: 'REDACT',
        sanitised: redactChunk(chunk, matches),
        reason: 'Confidential content redacted before sending to LLM.',
      };
    }
    if (ctx === 'share' || ctx === 'email') {
      return {
        action: 'WARN',
        sanitised: chunk,
        reason: `Confidential content flagged for approval before ${ctx}. Contains: ${matches.map(m => m.type).join(', ')}.`,
      };
    }
    // view — allow with warning
    return {
      action: 'WARN',
      sanitised: chunk,
      reason: `Confidential content — handle with care. Contains: ${matches.map(m => m.type).join(', ')}.`,
    };
  }

  // INTERNAL
  if (label === 'INTERNAL') {
    if (EXTERNAL_CONTEXTS.includes(ctx)) {
      return {
        action: 'WARN',
        sanitised: chunk,
        reason: `Internal content should not be shared externally via ${ctx}.`,
      };
    }
    return {
      action: 'ALLOW',
      sanitised: chunk,
      reason: 'Internal content — permitted for internal use.',
    };
  }

  // Fallback
  return { action: 'ALLOW', sanitised: chunk, reason: 'No policy matched.' };
}
