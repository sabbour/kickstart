/**
 * @module @kickstart/api/lib/error-response
 *
 * Shared error handling utilities for API functions.
 * Logs full error details server-side and returns a generic message to clients.
 */
import type { InvocationContext } from "@azure/functions";
/**
 * Build a safe 500 error response. Logs full error details server-side,
 * returns only a generic message to the client.
 */
export declare function safeErrorResponse(err: unknown, context: InvocationContext, label: string): {
    status: 500;
    jsonBody: {
        error: string;
    };
};
/**
 * Format a safe error message for SSE streaming responses.
 * Returns only a generic error — never internal details.
 */
export declare function safeStreamError(err: unknown, context: InvocationContext, label: string): string;
//# sourceMappingURL=error-response.d.ts.map