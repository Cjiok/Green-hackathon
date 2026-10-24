// Sentinel — Classifier

import { LEVELS, LEVEL_NAMES } from '../data/rules.js';

/**
 * Maps a numeric level to its label string.
 */
function levelName(n) {
  return LEVEL_NAMES[n] ?? 'PUBLIC';
}

/**
 * Takes the full array of detection results and assigns final sensitivity labels.
 *
 * @param {Array} detectionResults — output of detect()
 * @returns {{ chunks, documentLevel, summary }}
 */
export function classify(detectionResults) {
  const summary = { restricted: 0, confidential: 0, internal: 0, public: 0 };
  let docLevel = LEVELS.PUBLIC;

  const chunks = detectionResults.map((result) => {
    const label = levelName(result.highestLevel);

    // Accumulate summary
    switch (result.highestLevel) {
      case LEVELS.RESTRICTED:   summary.restricted++;   break;
      case LEVELS.CONFIDENTIAL: summary.confidential++; break;
      case LEVELS.INTERNAL:     summary.internal++;     break;
      default:                  summary.public++;        break;
    }

    // Document-level is the highest chunk level
    if (result.highestLevel > docLevel) docLevel = result.highestLevel;

    return { ...result, label };
  });

  return {
    chunks,
    documentLevel: levelName(docLevel),
    summary,
  };
}
