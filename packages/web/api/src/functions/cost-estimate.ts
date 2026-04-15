import { app } from '@azure/functions';
import type { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  CostEstimateRequestError,
  normalizeCostEstimateRequest,
  resolveSessionCostEstimate,
} from '../lib/cost-estimate.js';
import { safeErrorResponse } from '../lib/error-response.js';
import { checkRateLimit, rateLimitResponse } from '../lib/rate-limiter.js';
import {
  adoptSessionPrincipal,
  getPrincipalId,
  getSession,
  isSessionOwnedBy,
} from '../lib/session-store.js';

app.http('cost-estimate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'sessions/{sessionId}/cost-estimate',
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const rateCheck = checkRateLimit(request, 12, 60_000);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const sessionId = request.params['sessionId'] ?? '';
      if (!sessionId) {
        return {
          status: 400,
          headers: { 'Cache-Control': 'no-store' },
          jsonBody: { error: 'sessionId is required.', code: 'invalid_request' },
        };
      }

      const session = getSession(sessionId);
      if (!session) {
        return {
          status: 404,
          headers: { 'Cache-Control': 'no-store' },
          jsonBody: { error: `Session "${sessionId}" was not found.`, code: 'session_not_found' },
        };
      }

      const principalId = getPrincipalId(request);
      if (!isSessionOwnedBy(session, principalId)) {
        return {
          status: 403,
          headers: { 'Cache-Control': 'no-store' },
          jsonBody: { error: 'This session belongs to a different user.', code: 'forbidden_session' },
        };
      }

      adoptSessionPrincipal(session, principalId);

      const body = await request.json();
      const normalized = normalizeCostEstimateRequest(body);
      const estimate = await resolveSessionCostEstimate(session, normalized);

      context.log(
        `[cost-estimate] session=${sessionId} region=${normalized.region} items=${normalized.lineItems.map((item) => item.kind).join(',')} source=${estimate.source ?? 'unknown'} cache=${estimate.cache?.status ?? 'unknown'} fallback=${estimate.fallback?.used ? 'yes' : 'no'}`,
      );

      return {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
        jsonBody: estimate,
      };
    } catch (error) {
      if (error instanceof CostEstimateRequestError) {
        return {
          status: error.status,
          headers: { 'Cache-Control': 'no-store' },
          jsonBody: { error: error.message, code: error.code },
        };
      }
      return safeErrorResponse(error, context, '[cost-estimate] error');
    }
  },
});
