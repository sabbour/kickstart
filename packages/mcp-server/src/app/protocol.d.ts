/**
 * @module @kickstart/mcp-server/app/protocol
 *
 * PostMessage protocol types and handler for the MCP App HTML surface.
 * Defines the message format between the sandboxed iframe and the MCP server.
 */
import type { SessionState } from "@kickstart/core";
import type { A2UICapability } from "../a2ui.js";
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
export type AppToServerMessage = KickstartMessage | ConverseMessage | ActionMessage;
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
/**
 * Validate an inbound message from the app iframe.
 * Returns the typed message or null if invalid.
 */
export declare function parseAppMessage(data: unknown): AppToServerMessage | null;
/**
 * Process an inbound App message and produce the outbound response.
 * Routes to the appropriate tool handler (kickstart, converse, action).
 */
export declare function handleAppMessage(msg: AppToServerMessage, sessions: Map<string, SessionState>, capability?: A2UICapability): Promise<ServerToAppMessage>;
//# sourceMappingURL=protocol.d.ts.map