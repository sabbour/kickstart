/**
 * Sanitizes action context before it flows into LLM continuation prompts.
 *
 * Prevents prompt-injection by enforcing an allowlist of context keys,
 * capping individual value lengths, and stripping control characters.
 */

/** Maximum character length for any single stringified context value. */
const MAX_VALUE_LENGTH = 200;

/** Maximum number of context entries forwarded to prompt synthesis. */
const MAX_CONTEXT_KEYS = 10;

/**
 * Allowlisted context keys. Only these are forwarded to prompt synthesis.
 * Keys not in this set are silently dropped.
 */
const ALLOWED_KEYS = new Set([
  'value',
  'selectedValue',
  'selectedLabel',
  'label',
  'id',
  'phase',
  'step',
  'option',
  'choice',
  'name',
]);

/**
 * Strip control characters and cap the string length.
 * Preserves printable Unicode — only removes C0/C1 control codes
 * (except tab/newline/CR which are collapsed to a single space).
 */
function sanitizeValue(val: unknown): string {
  const raw = Array.isArray(val) ? val.join(', ') : String(val ?? '');
  return raw
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .slice(0, MAX_VALUE_LENGTH);
}

/**
 * Sanitize an action context object for safe inclusion in LLM prompts.
 *
 * 1. Filters to {@link ALLOWED_KEYS} only.
 * 2. Strips control characters from every value.
 * 3. Caps each value at {@link MAX_VALUE_LENGTH} characters.
 * 4. Returns at most {@link MAX_CONTEXT_KEYS} entries.
 */
export function sanitizeActionContext(
  context: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!context || typeof context !== 'object') return {};

  const sanitized: Record<string, unknown> = {};
  let count = 0;

  for (const [key, value] of Object.entries(context)) {
    if (count >= MAX_CONTEXT_KEYS) break;
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;

    sanitized[key] = sanitizeValue(value);
    count++;
  }

  return sanitized;
}

// Re-export constants for testing
export { ALLOWED_KEYS, MAX_VALUE_LENGTH, MAX_CONTEXT_KEYS };
