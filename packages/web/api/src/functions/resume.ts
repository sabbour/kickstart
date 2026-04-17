/**
 * POST /api/converse/resume — resume a paused Runner after a UserAction result arrives.
 *
 * Security (Zapp Critical 1 + 2 + 3):
 *   Critical 1: OID from X-MS-CLIENT-PRINCIPAL must match session.user.oid → 403 if not.
 *   Critical 2: resultPayload validated against UserAction.resultSchema → 400 if fails.
 *   Critical 3: Playground stub gate enforced in runner.ts (KICKSTART_PLAYGROUND=true).
 */

import { app } from "@azure/functions";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { getRegistry } from "../startup/packs.js";
import { sessionStore } from "@kickstart/harness/runtime/session";
import { Runner } from "@kickstart/harness/runtime/runner";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@kickstart/harness/runtime/sse";
import { handleResume, getOidFromPrincipalHeader } from "@kickstart/harness/runtime/resume";
import type { SSEEventType } from "@kickstart/harness/runtime/sse";

interface ResumeRequest {
  sessionId: string;
  actionId: string;
  toolName: string;
  result: unknown;
}

async function resume(
  request: HttpRequest,
  ctx: InvocationContext,
): Promise<Response> {
  ctx.log("v2 resume handler");

  let body: ResumeRequest;
  try {
    body = await request.json() as ResumeRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { sessionId, actionId, toolName, result: resultPayload } = body;
  if (!sessionId || !toolName) {
    return new Response(JSON.stringify({ error: "'sessionId' and 'toolName' are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Look up the session
  const session = sessionStore.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract OID from Azure SWA principal header (Zapp Critical 1)
  const requesterOid = getOidFromPrincipalHeader(request.headers.get("x-ms-client-principal"));

  const registry = getRegistry();
  const runner = new Runner(registry);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: SSEEventType, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
        } catch { /* client disconnected */ }
      };

      try {
        const handlerResult = await handleResume(
          { session, requesterOid, toolName, runId: actionId, resultPayload },
          runner,
          registry,
          write,
        );

        if (handlerResult.status !== 200) {
          write("error", { message: handlerResult.error, status: handlerResult.status });
        }
      } catch (err) {
        try {
          write("error", { message: err instanceof Error ? err.message : String(err) });
        } catch { /* ignore */ }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: SSE_RESPONSE_HEADERS,
  });
}

app.http("converseResume", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse/resume",
  handler: resume,
});
