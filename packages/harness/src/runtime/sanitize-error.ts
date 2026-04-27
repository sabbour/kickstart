/**
 * sanitize-error — strips infrastructure details from error messages before
 * forwarding them to the browser SSE stream.
 *
 * Raw error messages from the OpenAI SDK or the harness runtime can contain
 * model IDs, deployment names, UUIDs, quota figures, and rate-limit thresholds
 * that must never reach end users. This module provides a single
 * `sanitizeError(err)` function that:
 *
 * 1. Returns a safe hard-coded message for known error types.
 * 2. Strips recognisable sensitive patterns from unknown errors.
 * 3. Falls back to a generic message when nothing safe remains.
 */

import {
  MaxTurnsExceededError,
  ModelBehaviorError,
  ToolCallError,
  ToolTimeoutError,
  InputGuardrailTripwireTriggered,
  OutputGuardrailTripwireTriggered,
  ToolInputGuardrailTripwireTriggered,
  ToolOutputGuardrailTripwireTriggered,
} from '@openai/agents';

// ---------------------------------------------------------------------------
// Sensitive-pattern regexes — order matters (most specific first)
// ---------------------------------------------------------------------------

/** Matches model identifiers such as gpt-4, gpt-4o, gpt-35-turbo, gpt-4.1-mini */
const RE_MODEL_ID = /gpt-[\w.-]+/gi;

/** Matches deployment / resource UUIDs */
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Matches Azure OpenAI deployment name patterns (alphanumeric with hyphens, 8+ chars) */
const RE_DEPLOYMENT = /\bdeploy(?:ment)?(?:\s+name)?[:\s]+["']?[\w-]{4,}["']?/gi;

/** Matches quota / rate-limit figures and terminology */
const RE_QUOTA = /quota\s+exceeded|rate[\s-]?limit(?:ed)?|TPM\b|RPM\b|\b\d[\d,.]*\s*(?:tokens?|requests?)\s*(?:per|\/)\s*\w+/gi;

/** Matches Azure endpoint hostnames */
const RE_AZURE_ENDPOINT = /https?:\/\/[\w-]+\.openai\.azure\.com[^\s,)]*/gi;

const SENSITIVE_PATTERNS: RegExp[] = [
  RE_AZURE_ENDPOINT,
  RE_DEPLOYMENT,
  RE_MODEL_ID,
  RE_UUID,
  RE_QUOTA,
];

const GENERIC_FALLBACK = 'An unexpected error occurred. Please try again.';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a user-safe error message for `err`.
 *
 * The original error should be logged server-side by the caller — this
 * function never logs itself so that it can be used in non-server contexts.
 */
export function sanitizeError(err: unknown): string {
  // ── Known harness / SDK error types ──────────────────────────────────────
  if (err instanceof MaxTurnsExceededError) {
    return 'The conversation reached its maximum length. Please start a new conversation.';
  }

  if (
    err instanceof InputGuardrailTripwireTriggered ||
    err instanceof OutputGuardrailTripwireTriggered ||
    err instanceof ToolInputGuardrailTripwireTriggered ||
    err instanceof ToolOutputGuardrailTripwireTriggered
  ) {
    return 'Request could not be completed.';
  }

  if (err instanceof ModelBehaviorError) {
    return 'The AI model returned an unexpected response. Please try again.';
  }

  if (err instanceof ToolTimeoutError) {
    return 'A tool call timed out. Please try again.';
  }

  if (err instanceof ToolCallError) {
    return 'A tool call failed. Please try again.';
  }

  // ── OpenAI REST API errors (AuthenticationError, RateLimitError, etc.) ───
  // Identified by their constructor name so we avoid importing from `openai`
  // directly (the harness only depends on `@openai/agents`).
  if (err instanceof Error) {
    switch (err.constructor.name) {
      case 'AuthenticationError':
        return 'Authentication failed. Please check your configuration.';
      case 'PermissionDeniedError':
        return 'Access denied. Please check your configuration.';
      case 'RateLimitError':
        return 'Service is currently busy. Please try again later.';
      case 'APIConnectionError':
      case 'APIConnectionTimeoutError':
        return 'Unable to connect to the AI service. Please try again.';
      case 'InternalServerError':
        return 'The AI service encountered an error. Please try again.';
    }
  }

  // ── Generic Error — strip sensitive patterns ──────────────────────────────
  if (err == null) {
    return GENERIC_FALLBACK;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const stripped = stripSensitivePatterns(rawMessage).trim();

  return stripped.length > 0 ? stripped : GENERIC_FALLBACK;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Removes all sensitive patterns from `message` and collapses excess
 * whitespace and punctuation left behind.
 */
export function stripSensitivePatterns(message: string): string {
  let result = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    // Reset lastIndex because all patterns have the `g` flag
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[redacted]');
  }
  // Collapse duplicate [redacted] tokens and tidy up surrounding punctuation
  result = result.replace(/(\[redacted\]\s*){2,}/g, '[redacted] ');
  result = result.replace(/[,:]\s*\[redacted\]\s*([,:])/g, '$1');
  result = result.replace(/\s{2,}/g, ' ');
  return result;
}
