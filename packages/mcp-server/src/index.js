#!/usr/bin/env node
/**
 * @module @kickstart/mcp-server
 *
 * MCP server entry point for AKS Kickstart.
 * Exposes tools for guided AKS onboarding via the Model Context Protocol.
 * Serves the MCP App HTML surface for IDE-native UX.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createInitialState, transition, Phase, } from "@kickstart/core";
import { handleKickstart, deleteEngineState } from "./tools/kickstart.js";
import { handleConverse } from "./tools/converse.js";
import { handleGenerateManifests } from "./tools/generate-manifests.js";
import { handleCheckStatus } from "./tools/check-status.js";
import { handleAction } from "./tools/action.js";
import { resolveA2UICapability, KICKSTART_CATALOG_ID } from "./a2ui.js";
import { parseAppMessage, handleAppMessage } from "./app/protocol.js";
// ── In-memory session store (Phase 1 — no persistence) ─────────────
const sessions = new Map();
/** Session TTL: 1 hour in milliseconds. */
const SESSION_TTL_MS = 60 * 60 * 1000;
/** Purge sessions that haven't been touched in over TTL. */
function cleanStaleSessions() {
    const now = Date.now();
    for (const [id, session] of sessions) {
        const updatedAt = new Date(session.updatedAt).getTime();
        if (now - updatedAt > SESSION_TTL_MS) {
            sessions.delete(id);
            deleteEngineState(id);
        }
    }
}
// Run cleanup every 10 minutes
const cleanupInterval = setInterval(cleanStaleSessions, 10 * 60 * 1000);
cleanupInterval.unref(); // Don't keep process alive for cleanup
// ── Client A2UI capability (resolved during initialize) ─────────────
let clientCapability = "kickstart";
// ── Load MCP App HTML ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/** The MCP App HTML content, loaded once at startup. */
let appHtml;
try {
    appHtml = readFileSync(resolve(__dirname, "app", "kickstart-app.html"), "utf-8");
}
catch {
    appHtml = "<html><body><p>Kickstart App failed to load.</p></body></html>";
    process.stderr.write("Warning: kickstart-app.html not found in dist/app/\n");
}
/** Resource URI for the MCP App HTML. */
const APP_RESOURCE_URI = "kickstart://app/main";
// ── MCP Server Setup ────────────────────────────────────────────────
const server = new McpServer({
    name: "kickstart",
    version: "0.1.0",
});
// ── Tool: kickstart ─────────────────────────────────────────────────
server.tool("kickstart", "Start a new AKS Kickstart conversation. Returns an A2UI conversation phase indicator and intro text.", {
    message: z.string().optional().describe("Optional initial message from the user"),
}, async (params) => handleKickstart(sessions, params.message, clientCapability));
// ── Tool: converse ──────────────────────────────────────────────────
server.tool("converse", "Continue a multi-turn Kickstart conversation. Processes user message through the phase machine and returns the phase-appropriate system prompt with A2UI phase indicator.", {
    sessionId: z.string().describe("Active session ID from a kickstart conversation"),
    message: z.string().describe("User message to process"),
}, async (params) => handleConverse(sessions, params.sessionId, params.message, clientCapability));
// ── Tool: generate-manifests ────────────────────────────────────────
server.tool("generate-manifests", "Generate Kubernetes manifests and GitHub Actions workflows from the current conversation state.", {
    sessionId: z.string().describe("Active session ID from a kickstart conversation"),
}, async (params) => handleGenerateManifests(sessions, params.sessionId, clientCapability));
// ── Tool: check-status ──────────────────────────────────────────────
server.tool("check-status", "Check the deployment status for an active session.", {
    sessionId: z.string().describe("Active session ID"),
}, async (params) => handleCheckStatus(sessions, params.sessionId));
// ── Tool: action ────────────────────────────────────────────────────
server.tool("action", "Handle a user action from the A2UI interface (button click, form submission, resource selection).", {
    sessionId: z.string().describe("Active session ID"),
    actionType: z.enum(["advance", "skip", "select", "submit"]).describe("Type of user action"),
    payload: z.record(z.string(), z.unknown()).optional().describe("Action-specific data"),
}, async (params) => handleAction(sessions, params.sessionId, params.actionType, params.payload));
// ── Tool: app-message ──────────────────────────────────────────────
// Relay for postMessage protocol — routes messages from the MCP App iframe
// through the appropriate tool handler.
server.tool("app-message", "Relay a message from the MCP App HTML surface. Routes kickstart/converse/action messages through the appropriate handler.", {
    message: z.record(z.string(), z.unknown()).describe("App-to-server message object with a 'type' field"),
}, async (params) => {
    const parsed = parseAppMessage(params.message);
    if (!parsed) {
        return {
            content: [{ type: "text", text: "Invalid app message format." }],
        };
    }
    const response = await handleAppMessage(parsed, sessions, clientCapability);
    return {
        content: [{ type: "text", text: JSON.stringify(response) }],
    };
});
// ── Resource: MCP App HTML ─────────────────────────────────────────
server.resource("kickstart-app", APP_RESOURCE_URI, { mimeType: "text/html", description: "Kickstart MCP App — IDE-native conversation UI" }, async () => ({
    contents: [
        {
            uri: APP_RESOURCE_URI,
            mimeType: "text/html",
            text: appHtml,
        },
    ],
}));
// ── Start Server ────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Kickstart MCP server error: ${message}\n`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map