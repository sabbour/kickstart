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
import { sessionStore } from "@aks-kickstart/harness/runtime/session";
import { Runner } from "@aks-kickstart/harness/runtime/runner";
import { createReadSkillTool } from "../../../../pack-core/src/tools/read_skill.js";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@aks-kickstart/harness/runtime/sse";
import { getOidFromPrincipalHeader } from "@aks-kickstart/harness/runtime/resume";
import { z } from "zod";
import type { SSEEventType } from "@aks-kickstart/harness/runtime/sse";

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

  // Crit1: OID check — return 403 (not 200 SSE) on mismatch
  const requesterOid = getOidFromPrincipalHeader(request.headers.get("x-ms-client-principal"));
  if (requesterOid === null || session.user.oid !== requesterOid) {
    return new Response('Forbidden', { status: 403 });
  }

  // B3: compare-and-swap — clear pendingUserAction BEFORE validation to prevent concurrent replay
  const pending = session.pendingUserAction;
  if (!pending) {
    return new Response(JSON.stringify({ error: "No pending UserAction on this session" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  session.pendingUserAction = null;

  if (pending.name !== toolName) {
    return new Response(JSON.stringify({ error: `Pending action is "${pending.name}", not "${toolName}"` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (actionId && pending.runId !== actionId) {
    return new Response(JSON.stringify({ error: `Run ID mismatch` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Crit2: validate resultPayload against stored resultSchema — return 400 (not 200 SSE) on failure
  let validatedResult: unknown = resultPayload;
  if (pending.resultSchema) {
    const schema = pending.resultSchema as z.ZodTypeAny;
    const parsed = schema.safeParse(resultPayload);
    if (!parsed.success) {
      return new Response('Bad Request', { status: 400 });
    }
    validatedResult = parsed.data;
  }

  const registry = getRegistry();
  const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: SSEEventType, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
        } catch { /* client disconnected */ }
      };

      try {
        await runner.resume(session, validatedResult, write);
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
