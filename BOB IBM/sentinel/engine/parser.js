// Sentinel — Document / Text Parser

/**
 * Splits input text into sentence-level chunks.
 * Returns an array of { chunk, index } objects.
 */
export function parseText(input) {
  if (!input || typeof input !== 'string') return [];

  // Normalise line endings
  const normalised = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on sentence boundaries: '. ', '! ', '? ', or '\n'
  // Keep the delimiter attached to the preceding sentence
  const raw = normalised.split(/(?<=[.!?])\s+|\n+/);

  const chunks = [];
  raw.forEach((chunk, i) => {
    const trimmed = chunk.trim();
    if (trimmed.length > 0) {
      chunks.push({ chunk: trimmed, index: i });
    }
  });

  // Re-index after filtering empty
  return chunks.map((c, i) => ({ chunk: c.chunk, index: i }));
}
