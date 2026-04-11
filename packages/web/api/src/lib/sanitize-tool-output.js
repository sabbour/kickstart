/**
 * @module @kickstart/api/lib/sanitize-tool-output
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
/** Patterns that should never appear in tool output sent to the client. */
const DANGEROUS_HTML_RE = /<\s*\/?\s*(script|iframe|object|embed|form|input|link|meta|style|svg|base|applet)[^>]*>/gi;
/**
 * Strip dangerous HTML tags from a string while leaving plain text intact.
 * This is intentionally aggressive — tool results are plain-text data, not
 * HTML documents. Any residual HTML is an injection vector.
 */
function stripDangerousHtml(text) {
    return text
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
        .replace(/<object[\s\S]*?<\/object>/gi, "")
        .replace(/<embed[\s\S]*?<\/embed>/gi, "")
        .replace(DANGEROUS_HTML_RE, "")
        .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, "");
}
/**
 * Redact stack traces from error messages so internal file paths and
 * dependency versions don't leak to the LLM or client.
 */
function sanitizeErrorText(text) {
    return text.replace(/(\n\s+at\s+.+){2,}/g, "\n    [stack trace redacted]");
}
/**
 * Sanitize a tool result before feeding it to the LLM or streaming to client.
 *
 * Accepts an arbitrary `unknown` value (the raw tool result), JSON-stringifies
 * it, applies all sanitization passes, and returns a safe string ready for
 * insertion into the LLM message array.
 */
export function sanitizeToolOutput(raw) {
    let text;
    if (typeof raw === "string") {
        text = raw;
    }
    else {
        try {
            text = JSON.stringify(raw);
        }
        catch {
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
//# sourceMappingURL=sanitize-tool-output.js.map