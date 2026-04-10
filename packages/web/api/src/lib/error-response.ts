/**
 * @module @kickstart/api/lib/error-response
 *
 * Shared error handling utilities for API functions.
 * Logs full error details server-side and returns a generic message to clients.
 */

import type { InvocationContext } from "@azure/functions";

const GENERIC_ERROR_MESSAGE = "An error occurred processing your request.";

/**
 * Build a safe 500 error response. Logs full error details server-side,
 * returns only a generic message to the client.
 */
export function safeErrorResponse(
  err: unknown,
  context: InvocationContext,
  label: string,
): { status: 500; jsonBody: { error: string } } {
  const detail = err instanceof Error ? err.message : String(err);
  context.error(`${label}: ${detail}`);
  if (err instanceof Error && err.stack) {
    context.error(`${label} stack: ${err.stack}`);
  }
  return { status: 500, jsonBody: { error: GENERIC_ERROR_MESSAGE } };
}

/**
 * Format a safe error message for SSE streaming responses.
 * Returns only a generic error — never internal details.
 */
export function safeStreamError(
  err: unknown,
  context: InvocationContext,
  label: string,
): string {
  const detail = err instanceof Error ? err.message : String(err);
  context.error(`${label}: ${detail}`);
  if (err instanceof Error && err.stack) {
    context.error(`${label} stack: ${err.stack}`);
  }
  return GENERIC_ERROR_MESSAGE;
}
