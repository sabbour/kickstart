/**
 * @module @kickstart/api/functions/session-provision
 *
 * POST /api/session/provision — Creates an anonymous backend session for
 * playground users before they send their first message.
 *
 * Returns { sessionId } — the caller stores this as backendSessionId so that
 * the first /api/converse call can find and reuse the session rather than
 * orphaning a newly created one.
 *
 * Rate limited to 5 requests per IP to prevent session flooding.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { createSession, SessionCapExceededError } from "../lib/session-store.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";

app.http("session-provision", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "session/provision",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    // Tight rate limit — provisioning should happen once per playground load
    const rateCheck = checkRateLimit(request, 5);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      // No principal — this is an anonymous session for playground users
      const session = createSession();
      return {
        status: 200,
        jsonBody: { sessionId: session.state.sessionId },
      };
    } catch (err) {
      if (err instanceof SessionCapExceededError) {
        return { status: 503, jsonBody: { error: err.message } };
      }
      return safeErrorResponse(err, context, "Session provision error");
    }
  },
});
