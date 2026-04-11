/**
 * @module @kickstart/api/lib/content-safety
 *
 * Lightweight LLM-based content safety pre-flight check for user input.
 * Uses minimal tokens to keep the check fast and cheap.
 * Gracefully skips if Azure OpenAI is not configured.
 */
export interface ContentSafetyResult {
    safe: boolean;
    error?: string;
}
/**
 * Check whether a user message is appropriate for a professional
 * software development context. Returns `{ safe: true }` if the
 * message passes, or `{ safe: false, error }` if it doesn't.
 *
 * If Azure OpenAI is not configured, the check is skipped (returns safe).
 */
export declare function checkContentSafety(message: string): Promise<ContentSafetyResult>;
//# sourceMappingURL=content-safety.d.ts.map