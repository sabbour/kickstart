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
/**
 * Sanitize a tool result before feeding it to the LLM or streaming to client.
 *
 * Accepts an arbitrary `unknown` value (the raw tool result), JSON-stringifies
 * it, applies all sanitization passes, and returns a safe string ready for
 * insertion into the LLM message array.
 */
export declare function sanitizeToolOutput(raw: unknown): string;
//# sourceMappingURL=sanitize-tool-output.d.ts.map