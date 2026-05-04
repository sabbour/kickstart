#!/usr/bin/env node

/**
 * @module @sabbour/kickstart-mcp
 *
 * MCP server entry point — v2 thin adapter that wraps the harness Runner.
 *
 * Design principles:
 * - Each tool call drives one Runner turn (session management, skill injection,
 *   guardrails all flow through the harness — no duplicate runtime logic here).
 * - A2UI messages from `core.emit_ui` are forwarded as embedded resources for
 *   VS Code Copilot clients (detected via `clientInfo` in initialize handshake).
 *   Non-VS Code clients receive plain-text summaries.
 * - Only tools with `mcpExposed: true` appear in the tool manifest.
 *   Tools with `requiresSession: true` are excluded entirely.
 *   File-system tools are excluded by name (defence-in-depth).
 * - UserActions are NEVER in the tool manifest — they surface as structured
 *   interrupt blocks returned inline from the `converse` tool.
 * - `connectionId` is server-assigned at the `initialize` handshake. The client
 *   cannot supply or override it (Zapp condition 2).
 * - Interrupt resume is single-use (CAS), action-bound, TTL-guarded, and
 *   replay-protected. A process restart clears all in-memory interrupt state,
 *   so pending interrupts return 404 after restart (Zapp conditions 5 & 6).
 * - A per-session mutex serialises concurrent tool calls for the same session.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  Runner,
  getOrCreateSession,
  buildA2UIContent,
  buildInterruptContent,
} from '@aks-kickstart/harness';
import type { McpContentItem } from '@aks-kickstart/harness';
import { createReadSkillTool } from '@aks-kickstart/pack-core/tools/read_skill';

import {
  registerInterrupt,
  claimInterrupt,
  purgeExpiredInterrupts,
} from './adapter/interrupt-store.js';
import { withSessionMutex } from './adapter/session-mutex.js';
import { getRegistry } from './startup/packs.js';

// ── Load app HTML ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let appHtml: string;
try {
  appHtml = readFileSync(resolve(__dirname, 'app', 'kickstart-app.html'), 'utf-8');
} catch {
  appHtml = '<html><body><p>Kickstart App failed to load.</p></body></html>';
  process.stderr.write('Warning: kickstart-app.html not found in dist/app/\n');
}

const APP_RESOURCE_URI = 'kickstart://app/main' as const;

// ── Harness setup ──────────────────────────────────────────────────

const registry = getRegistry();

const runner = new Runner(registry, { readSkillToolFactory: createReadSkillTool });

// ── Connection-level state ─────────────────────────────────────────
// Assigned at initialize handshake; never client-supplied (Zapp condition 2).

let connectionId: string | null = null;

// ── Periodic cleanup ───────────────────────────────────────────────

const cleanupTimer = setInterval(() => {
  purgeExpiredInterrupts();
}, 5 * 60 * 1_000);
cleanupTimer.unref();

// ── MCP Server ─────────────────────────────────────────────────────

export const server = new McpServer({
  name: 'kickstart',
  version: '2.0.0',
});

// ── Initialize hook — assign connectionId
//
// oninitialized fires after the MCP initialize handshake completes.
// connectionId is ALWAYS server-assigned — the client has no say.

server.server.oninitialized = () => {
  const clientInfo = server.server.getClientVersion();

  // Server assigns connectionId — never read from client params.
  connectionId = randomUUID();

  process.stderr.write(
    `[kickstart-mcp] connection=${connectionId} client=${clientInfo?.name ?? 'unknown'}\n`,
  );
};

// ── Tool: converse ─────────────────────────────────────────────────
//
// Primary entry point. Routes user messages through the Runner.
// Returns structured interrupt block when the Runner hits a UserAction.
// UserAction interrupt blocks are structured JSON — never listed as tools.

server.tool(
  'converse',
  'Send a message to the Kickstart AI assistant. Returns the assistant reply plus ' +
    'UI update resources. Returns a structured interrupt block when user confirmation is needed.',
  {
    message: z.string().describe('User message to process'),
    sessionId: z.string().optional().describe(
      'Existing session ID to continue a conversation. Omit to start a new session.',
    ),
  },
  async ({ message, sessionId: requestedSessionId }) => {
    const oid = connectionId ?? randomUUID();
    const session = getOrCreateSession(requestedSessionId, oid);

    return withSessionMutex(session.sessionId, async () => {
      const textChunks: string[] = [];
      const a2uiMessages: Record<string, unknown>[] = [];
      let pendingInterrupt: {
        actionId: string;
        actionName: string;
        confirmComponent?: { component: string; props?: Record<string, unknown> };
        resultSchema: Record<string, unknown>;
      } | null = null;

      let runnerError: string | null = null;

      const sseWrite = (event: string, data: unknown): void => {
        if (event === 'chunk') {
          const d = data as { delta?: string };
          if (d.delta) textChunks.push(d.delta);
        } else if (event === 'a2ui') {
          a2uiMessages.push(data as Record<string, unknown>);
        } else if (event === 'error') {
          const d = data as { message?: string; code?: string };
          runnerError = d.message ?? d.code ?? 'Unknown error';
        } else if (event === 'user_action_req') {
          const d = data as {
            actionId?: string;
            toolName?: string;
            wireName?: string;
            confirmComponent?: unknown;
          };
          const actionId = d.actionId ?? randomUUID();
          const actionName = d.toolName ?? d.wireName ?? 'unknown_action';

          let confirmComponent: { component: string; props?: Record<string, unknown> } | undefined;
          if (d.confirmComponent && typeof d.confirmComponent === 'object') {
            const cc = d.confirmComponent as Record<string, unknown>;
            if (typeof cc['component'] === 'string') {
              confirmComponent = {
                component: cc['component'],
                props: cc['props'] as Record<string, unknown> | undefined,
              };
            }
          }

          // Minimal result schema — full JSON Schema generation deferred
          const resultSchema: Record<string, unknown> = { type: 'object' };

          pendingInterrupt = { actionId, actionName, confirmComponent, resultSchema };

          // Register in the interrupt store for single-use resume (Zapp condition 5)
          registerInterrupt({
            sessionId: session.sessionId,
            actionId,
            actionName,
            confirmComponent,
            resultSchema,
            issuedAt: Date.now(),
          });
        }
      };

      await runner.run(session, message, sseWrite, undefined, {});

      const content: McpContentItem[] = [];

      const fullText = textChunks.join('');
      if (fullText) content.push({ type: 'text', text: fullText });

      // A2UI: embedded resources for VS Code, plain-text summary for others
      content.push(...buildA2UIContent(a2uiMessages, false));

      // UserAction interrupt: always structured JSON, never human-readable text
      if (pendingInterrupt !== null) {
        const interrupt = pendingInterrupt as {
          actionId: string;
          actionName: string;
          confirmComponent?: { component: string; props?: Record<string, unknown> };
          resultSchema: Record<string, unknown>;
        };
        content.push(
          buildInterruptContent({
            type: 'interrupt',
            actionId: interrupt.actionId,
            actionName: interrupt.actionName,
            confirmComponent: interrupt.confirmComponent,
            resultSchema: interrupt.resultSchema,
          }),
        );
      }

      if (content.length === 0) {
        content.push({ type: 'text', text: runnerError ? `Error: ${runnerError}` : '(no output)' });
      }

      return { content };
    });
  },
);

// ── Tool: resume ───────────────────────────────────────────────────
//
// Resume a paused Runner run after the MCP client resolved a UserAction.
// CAS single-use: second call with the same actionId returns 404 error.
// Process restart → 404: interrupt state is in-memory only.

server.tool(
  'resume',
  'Resume an interrupted Kickstart conversation after completing a required user action.',
  {
    sessionId: z.string().describe('Session ID from the interrupted conversation'),
    actionId: z.string().describe('Action ID from the interrupt block returned by converse'),
    result: z.record(z.string(), z.unknown()).describe(
      'Result payload for the completed user action',
    ),
  },
  async ({ sessionId, actionId, result }) => {
    return withSessionMutex(sessionId, async () => {
      // CAS single-use claim — marks the entry consumed atomically
      const entry = claimInterrupt(sessionId, actionId);
      if (!entry) {
        // 404: entry missing (process restart, already consumed, expired, or wrong ID)
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                type: 'error',
                code: 404,
                message:
                  'No pending interrupt found. It may have been already resumed, expired, ' +
                  'or the server was restarted.',
              }),
            },
          ],
        };
      }

      const oid = connectionId ?? randomUUID();
      let session;
      try {
        session = getOrCreateSession(sessionId, oid);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ type: 'error', code: 404, message: 'Session not found.' }),
            },
          ],
        };
      }

      const textChunks: string[] = [];
      const a2uiMessages: Record<string, unknown>[] = [];
      let runnerError: string | null = null;

      const sseWrite = (event: string, data: unknown): void => {
        if (event === 'chunk') {
          const d = data as { delta?: string };
          if (d.delta) textChunks.push(d.delta);
        } else if (event === 'a2ui') {
          a2uiMessages.push(data as Record<string, unknown>);
        } else if (event === 'error') {
          const d = data as { message?: string; code?: string };
          runnerError = d.message ?? d.code ?? 'Unknown error';
        }
      };

      await runner.resume(session, result, sseWrite, undefined, {});

      const content: McpContentItem[] = [];
      const fullText = textChunks.join('');
      if (fullText) content.push({ type: 'text', text: fullText });
      content.push(...buildA2UIContent(a2uiMessages, false));
      if (content.length === 0) content.push({ type: 'text', text: runnerError ? `Error: ${runnerError}` : '(no output)' });

      return { content };
    });
  },
);

// ── Dynamically registered tools from registry ─────────────────────
//
// Only tools with mcpExposed: true and !requiresSession appear here.
// File-system tools are excluded by name (defence-in-depth).
// UserActions are NEVER registered here — they surface as interrupt blocks.

for (const descriptor of manifestTools) {
  server.tool(
    descriptor.name,
    descriptor.description,
    {},
    async (params: Record<string, unknown>) => {
      const oid = connectionId ?? randomUUID();
      const session = getOrCreateSession(undefined, oid);

      return withSessionMutex(session.sessionId, async () => {
        const textChunks: string[] = [];
        const a2uiMessages: Record<string, unknown>[] = [];

        const sseWrite = (event: string, data: unknown): void => {
          if (event === 'chunk') {
            const d = data as { delta?: string };
            if (d.delta) textChunks.push(d.delta);
          } else if (event === 'a2ui') {
            a2uiMessages.push(data as Record<string, unknown>);
          }
        };

        const toolMessage = `[tool:${descriptor.name}] ${JSON.stringify(params)}`;
        await runner.run(session, toolMessage, sseWrite, undefined, {});

        const content: McpContentItem[] = [];
        const fullText = textChunks.join('');
        if (fullText) content.push({ type: 'text', text: fullText });
        content.push(...buildA2UIContent(a2uiMessages, false));
        if (content.length === 0) content.push({ type: 'text', text: '(no output)' });

        return { content };
      });
    },
  );
}

// ── Resource: MCP App HTML ─────────────────────────────────────────

server.resource(
  'kickstart-app',
  APP_RESOURCE_URI,
  { mimeType: 'text/html', description: 'Kickstart MCP App — IDE-native conversation UI' },
  async () => ({
    contents: [
      {
        uri: APP_RESOURCE_URI,
        mimeType: 'text/html' as const,
        text: appHtml,
      },
    ],
  }),
);

// ── Start ──────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Kickstart MCP server error: ${message}\n`);
  process.exit(1);
});

// Expose for testing
export { connectionId, registry, runner };
