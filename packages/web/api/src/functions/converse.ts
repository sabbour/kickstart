/**
 * POST /api/converse — v2 harness converse handler.
 *
 * Loads or creates a Session, runs the Runner, and streams 9 SSE event types:
 *   start | chunk | a2ui | tool_start | tool_done | phase | user_action_req | end | error
 *
 * Leela C4: phase routing is handled via the `end` event's `intent` field which
 * the browser passes to `useNavigation.onIntent()`. This handler does NOT perform
 * direct phase routing.
 */

import { app } from "@azure/functions";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { getRegistry } from "../startup/packs.js";
import { getOrCreateSession } from "@kickstart/harness/runtime/session";
import { Runner } from "@kickstart/harness/runtime/runner";
import { SSE_RESPONSE_HEADERS, formatSSEFrame } from "@kickstart/harness/runtime/sse";
import type { SSEEventType } from "@kickstart/harness/runtime/sse";

interface ConverseRequest {
  sessionId?: string;
  message: string;
  clientMessageId?: string;
}

async function converse(
  request: HttpRequest,
  ctx: InvocationContext,
): Promise<Response> {
  ctx.log("v2 converse handler");

  let body: ConverseRequest;
  try {
    body = await request.json() as ConverseRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.message || typeof body.message !== "string") {
    return new Response(JSON.stringify({ error: "'message' field is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Extract OID from Azure SWA principal header (may be undefined in dev/anon mode)
  const principalHeader = request.headers.get("x-ms-client-principal");
  let oid = "anonymous";
  if (principalHeader) {
    try {
      const decoded = Buffer.from(principalHeader, "base64").toString("utf-8");
      const principal = JSON.parse(decoded) as { userId?: string; claims?: Array<{ typ: string; val: string }> };
      const oidClaim = principal.claims?.find(
        (c) => c.typ === "http://schemas.microsoft.com/identity/claims/objectidentifier" || c.typ === "oid"
      );
      oid = oidClaim?.val ?? principal.userId ?? "anonymous";
    } catch { /* use default */ }
  }

  const registry = getRegistry();
  const session = getOrCreateSession(body.sessionId, oid);
  const runner = new Runner(registry);

  // Build SSE ReadableStream
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: SSEEventType, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(formatSSEFrame(event, data)));
        } catch { /* client disconnected */ }
      };

      try {
        await runner.run(session, body.message, write);
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

app.http("converse", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse",
  handler: converse,
});

