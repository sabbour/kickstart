#!/usr/bin/env node

/**
 * @module @kickstart/mcp-server
 *
 * MCP server entry point for AKS Kickstart.
 * Exposes tools for guided AKS onboarding via the Model Context Protocol.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createInitialState,
  transition,
  Phase,
} from "@kickstart/core";
import type { SessionState, ConversationState } from "@kickstart/core";

import { handleKickstart } from "./tools/kickstart.js";
import { handleGenerateManifests } from "./tools/generate-manifests.js";
import { handleCheckStatus } from "./tools/check-status.js";
import { handleAction } from "./tools/action.js";

// ── In-memory session store (Phase 1 — no persistence) ─────────────

const sessions = new Map<string, SessionState>();

// ── MCP Server Setup ────────────────────────────────────────────────

const server = new McpServer({
  name: "kickstart",
  version: "0.1.0",
});

// ── Tool: kickstart ─────────────────────────────────────────────────

server.tool(
  "kickstart",
  "Start a new AKS Kickstart conversation. Returns an A2UI conversation phase indicator and intro text.",
  {
    message: z.string().optional().describe("Optional initial message from the user"),
  },
  async (params) => handleKickstart(sessions, params.message),
);

// ── Tool: generate-manifests ────────────────────────────────────────

server.tool(
  "generate-manifests",
  "Generate Kubernetes manifests and GitHub Actions workflows from the current conversation state.",
  {
    sessionId: z.string().describe("Active session ID from a kickstart conversation"),
  },
  async (params) => handleGenerateManifests(sessions, params.sessionId),
);

// ── Tool: check-status ──────────────────────────────────────────────

server.tool(
  "check-status",
  "Check the deployment status for an active session.",
  {
    sessionId: z.string().describe("Active session ID"),
  },
  async (params) => handleCheckStatus(sessions, params.sessionId),
);

// ── Tool: action ────────────────────────────────────────────────────

server.tool(
  "action",
  "Handle a user action from the A2UI interface (button click, form submission, resource selection).",
  {
    sessionId: z.string().describe("Active session ID"),
    actionType: z.enum(["advance", "skip", "select", "submit"]).describe("Type of user action"),
    payload: z.record(z.string(), z.unknown()).optional().describe("Action-specific data"),
  },
  async (params) =>
    handleAction(sessions, params.sessionId, params.actionType, params.payload),
);

// ── Start Server ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Kickstart MCP server error: ${message}\n`);
  process.exit(1);
});
