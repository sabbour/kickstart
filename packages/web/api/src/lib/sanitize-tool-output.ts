/**
 * @module @aks-kickstart/api/lib/sanitize-tool-output
 *
 * Sanitizes tool output before it is sent to the LLM context or streamed to
 * the client.  Guards against prompt-injection persistence and sensitive data
 * leakage by:
 *   1. Enforcing a maximum output length (truncation).
 *   2. Stripping HTML/script content that could be rendered by the client.
 *   3. Redacting raw error stack traces.
 */

/** Maximum characters allowed in a single tool result (before JSON encoding). */
const MAX_TOOL_OUTPUT_LENGTH = 16_000;

/**
 * Attribute-aware HTML tag pattern.
 * Uses `(?:[^>"']|"[^"]*"|'[^']*')*` instead of `[^>]*` so that a `>`
 * inside a quoted attribute value (e.g. `src=">"`) does not prematurely
 * terminate the match — fixing the CodeQL bad-tag-filter alert.
 */
const HTML_TAG_RE = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/**
 * Matches `<script>…</script>` and `<style>…</style>` blocks including their
 * content, using a back-reference so a single replacement covers both tag
 * names and avoids chaining multiple incomplete patterns.
 */
const SCRIPT_STYLE_BLOCK_RE =
  /<(script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>/gi;

/**
 * Strip all HTML from a string leaving plain text intact.
 * Tool results are plain-text data, not HTML documents — any HTML is an
 * injection vector.
 *
 * Strategy (avoids incomplete multi-character sanitisation chains):
 *   1. Remove `<script>` / `<style>` blocks *with their content* so that
 *      inline JS/CSS does not surface as plain text in the LLM context.
 *   2. Strip every remaining tag in one comprehensive pass using an
 *      attribute-aware regex that handles `>` inside quoted attribute values.
 */
function stripDangerousHtml(text: string): string {
  return text
    .replace(SCRIPT_STYLE_BLOCK_RE, "")
    .replace(HTML_TAG_RE, "");
}

/**
 * Redact stack traces from error messages so internal file paths and
 * dependency versions don't leak to the LLM or client.
 */
function sanitizeErrorText(text: string): string {
  // Use [^\n]+ instead of .+ to make the per-line scope explicit and prevent
  // polynomial backtracking in the repeated group (ReDoS fix).
  return text.replace(
    /(\n\s+at\s+[^\n]+){2,}/g,
    "\n    [stack trace redacted]",
  );
}

/**
 * Sanitize a tool result before feeding it to the LLM or streaming to client.
 *
 * Accepts an arbitrary `unknown` value (the raw tool result), JSON-stringifies
 * it, applies all sanitization passes, and returns a safe string ready for
 * insertion into the LLM message array.
 */
export function sanitizeToolOutput(raw: unknown): string {
  let text: string;
  if (typeof raw === "string") {
    text = raw;
  } else {
    try {
      text = JSON.stringify(raw);
    } catch {
      text = String(raw);
    }
  }

  text = stripDangerousHtml(text);
  text = sanitizeErrorText(text);

  if (text.length > MAX_TOOL_OUTPUT_LENGTH) {
    text = text.slice(0, MAX_TOOL_OUTPUT_LENGTH) + "\n[output truncated]";
  }

  return text;
}
