/**
 * @module @kickstart/mcp-server/app/protocol
 *
 * PostMessage protocol types and handler for the MCP App HTML surface.
 * Defines the message format between the sandboxed iframe and the MCP server.
 */

import type { SessionState } from "@kickstart/harness";
import { handleKickstart } from "../tools/kickstart.js";
import { handleConverse } from "../tools/converse.js";
import { handleAction } from "../tools/action.js";
import type { A2UICapability } from "../a2ui.js";

// ── Inbound messages (App → Server) ─────────────────────────────────

export interface KickstartMessage {
  type: "kickstart";
}

export interface ConverseMessage {
  type: "converse";
  sessionId: string;
  message: string;
}

export interface ActionMessage {
  type: "action";
  sessionId: string;
  actionType: string;
  payload: Record<string, unknown>;
}

export type AppToServerMessage =
  | KickstartMessage
  | ConverseMessage
  | ActionMessage;

// ── Outbound messages (Server → App) ────────────────────────────────

export interface ResponseMessage {
  type: "response";
  sessionId: string;
  phase: string;
  a2ui?: unknown;
  text?: string;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerToAppMessage = ResponseMessage | ErrorMessage;

// ── Validation ──────────────────────────────────────────────────────

/**
 * Validate an inbound message from the app iframe.
 * Returns the typed message or null if invalid.
 */
export function parseAppMessage(data: unknown): AppToServerMessage | null {
  if (!data || typeof data !== "object") return null;
  const msg = data as Record<string, unknown>;

  switch (msg.type) {
    case "kickstart":
      return { type: "kickstart" };

    case "converse":
      if (typeof msg.sessionId !== "string" || typeof msg.message !== "string") return null;
      return { type: "converse", sessionId: msg.sessionId, message: msg.message };

    case "action":
      if (typeof msg.sessionId !== "string" || typeof msg.actionType !== "string") return null;
      return {
        type: "action",
        sessionId: msg.sessionId,
        actionType: msg.actionType,
        payload: (msg.payload && typeof msg.payload === "object" ? msg.payload : {}) as Record<string, unknown>,
      };

    default:
      return null;
  }
}

// ── Handler ─────────────────────────────────────────────────────────

/**
 * Process an inbound App message and produce the outbound response.
 * Routes to the appropriate tool handler (kickstart, converse, action).
 */
export async function handleAppMessage(
  msg: AppToServerMessage,
  sessions: Map<string, SessionState>,
  capability: A2UICapability = "kickstart",
): Promise<ServerToAppMessage> {
  try {
    switch (msg.type) {
      case "kickstart": {
        const result = await handleKickstart(sessions, undefined, capability);
        const sessionId = extractSessionId(result);
        const phase = extractPhase(result);
        const a2ui = extractA2UI(result);
        const text = extractText(result);
        return { type: "response", sessionId, phase, a2ui, text };
      }

      case "converse": {
        const result = await handleConverse(sessions, msg.sessionId, msg.message, capability);
        const phase = extractPhase(result);
        const a2ui = extractA2UI(result);
        const text = extractText(result);
        return { type: "response", sessionId: msg.sessionId, phase, a2ui, text };
      }

      case "action": {
        const result = await handleAction(
          sessions,
          msg.sessionId,
          msg.actionType as "advance" | "skip" | "select" | "submit",
          msg.payload,
        );
        const phase = extractPhase(result);
        const a2ui = extractA2UI(result);
        const text = extractText(result);
        return { type: "response", sessionId: msg.sessionId, phase, a2ui, text };
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { type: "error", message };
  }
}

// ── Result extraction helpers ───────────────────────────────────────

type ToolResult = {
  content: Array<
    | { type: "text"; text: string }
    | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }
  >;
};

/** Extract session ID from tool result text (format: `sessionId` in backticks). */
function extractSessionId(result: ToolResult): string {
  for (const item of result.content) {
    if (item.type === "text") {
      const match = item.text.match(/\*\*Session:\*\*\s*`([^`]+)`/);
      if (match) return match[1];
    }
  }
  return "";
}

/** Extract current phase name from tool result text. */
function extractPhase(result: ToolResult): string {
  for (const item of result.content) {
    if (item.type === "text") {
      const match = item.text.match(/\*\*Phase:\*\*\s*(\w+)/);
      if (match) return match[1];
    }
  }
  return "Discover";
}

/** Extract A2UI document from embedded resource, if present. */
function extractA2UI(result: ToolResult): unknown | undefined {
  for (const item of result.content) {
    if (item.type === "resource" && item.resource.mimeType === "application/json+a2ui") {
      try {
        const doc = JSON.parse(item.resource.text);
        return doc.root;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Extract plain text from the result (first text content item). */
function extractText(result: ToolResult): string | undefined {
  for (const item of result.content) {
    if (item.type === "text") return item.text;
  }
  return undefined;
}
