/**
 * Sanitize an A2UI action context before dispatching.
 * Ensures values are safe primitives and constrains string length
 * to prevent abuse via oversized or unexpected payloads.
 */

const MAX_STRING_LENGTH = 1024;
const MAX_KEYS = 50;

export function sanitizeActionContext(
  ctx: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!ctx || typeof ctx !== 'object') return {};

  const result: Record<string, unknown> = {};
  let keyCount = 0;

  for (const [key, value] of Object.entries(ctx)) {
    if (keyCount >= MAX_KEYS) break;

    if (typeof value === 'string') {
      result[key] = value.slice(0, MAX_STRING_LENGTH);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value === null || value === undefined) {
      result[key] = value;
    } else if (Array.isArray(value)) {
      // Allow arrays of primitives (e.g. multi-select values)
      result[key] = value
        .filter(v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
        .map(v => (typeof v === 'string' ? v.slice(0, MAX_STRING_LENGTH) : v));
    }
    // Objects and functions are intentionally dropped

    keyCount++;
  }

  return result;
}
