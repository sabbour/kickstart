#!/usr/bin/env node
/**
 * scripts/repl.ts — Prompt-flow debug REPL for the AKS Kickstart harness.
 *
 * Continuous multi-turn session. After each turn shows:
 *   - Tool calls made
 *   - Agent text response
 *   - A2UI actions available (numbered) — type a number to fire one
 *   - Raw A2UI JSON dumped to --log file for inspection
 *
 * When you type a number it composes the exact message that the real frontend
 * sends: `<label>\n\n[A2UI event] name=<event> payload=<json>`
 *
 * Usage:
 *   npm run repl
 *   npm run repl -- --message "deploy my Next.js app to AKS Automatic"
 *   npm run repl -- --log /tmp/session.jsonl
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Session } from '@aks-kickstart/harness/runtime/session';
import { Runner } from '@aks-kickstart/harness/runtime/runner';
import { assertCredentials, buildCliRegistry } from '../packages/sim-test/src/harness-bootstrap.js';

const { values: args } = parseArgs({
  options: {
    message: { type: 'string', short: 'm' },
    agent:   { type: 'string', short: 'a', default: 'core.triage' },
    log:     { type: 'string', short: 'l' },
    help:    { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log('Usage: npm run repl -- [-m <message>] [-a <agent>] [-l <logfile>]');
  process.exit(0);
}

assertCredentials();
const registry = buildCliRegistry();

const session = new Session({
  sessionId: randomUUID(),
  user: { oid: 'repl-user', upn: 'repl@localhost' },
  workspaceRoot: process.cwd(),
});
if (args.agent && args.agent !== 'core.triage') session.activeAgent = args.agent;

const runner = new Runner(registry);
const logStream = args.log
  ? fs.createWriteStream(path.resolve(args.log), { flags: 'a' })
  : null;

// ---------------------------------------------------------------------------
// A2UI surface state — track updateComponents events per surface
// ---------------------------------------------------------------------------

type Comp = Record<string, unknown>;
const surfaces = new Map<string, Map<string, Comp>>(); // surfaceId → componentId → comp

function applyA2UI(msg: unknown): void {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as Record<string, unknown>;
  if (m.createSurface) {
    const { surfaceId } = m.createSurface as { surfaceId: string };
    if (!surfaces.has(surfaceId)) surfaces.set(surfaceId, new Map());
  }
  if (m.updateComponents) {
    const { surfaceId, components } = m.updateComponents as { surfaceId: string; components: Comp[] };
    if (!surfaces.has(surfaceId)) surfaces.set(surfaceId, new Map());
    const s = surfaces.get(surfaceId)!;
    for (const c of components ?? []) {
      if (typeof c.id === 'string') s.set(c.id, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Action collection — mirrors frontend actionToMessage + composeAgentInput
// ---------------------------------------------------------------------------

interface Action {
  index: number;
  display: string;           // what to print to the user
  agentInput: string;        // what to send to runner.run()
}

let pendingActions: Action[] = [];

function composeAgentInput(label: string, eventName: string, payload: Record<string, unknown>): string {
  return `${label}\n\n[A2UI event] name=${eventName} payload=${JSON.stringify(payload)}`;
}

function rebuildActions(): void {
  const items: Action[] = [];
  let i = 1;
  for (const [, surface] of surfaces) {
    for (const [, comp] of surface) {
      const type = comp.component as string;

      if (type === 'RadioGroup') {
        const eventName = (comp.action as any)?.event?.name ?? '';
        for (const opt of (comp.options as any[]) ?? []) {
          const label: string = opt.label;
          items.push({
            index: i++,
            display: `${label}${opt.recommended ? ' [recommended]' : ''}${opt.description ? ` — ${opt.description}` : ''}`,
            agentInput: eventName
              ? composeAgentInput(label, eventName, { value: opt.id, selectedLabel: label })
              : label,
          });
        }
      }

      if (type === 'Button') {
        const label = String(comp.label ?? comp.text ?? 'Button');
        const eventName = (comp.action as any)?.event?.name ?? '';
        items.push({
          index: i++,
          display: `[Button] ${label}`,
          agentInput: eventName
            ? composeAgentInput(label, eventName, { label })
            : label,
        });
      }
    }
  }
  pendingActions = items;
}

// ---------------------------------------------------------------------------
// Turn runner
// ---------------------------------------------------------------------------

async function runTurn(userInput: string): Promise<void> {
  const toolsThisTurn: string[] = [];
  const a2uiThisTurn: unknown[] = [];
  let textBuffer = '';

  const sseWrite = (event: string, data: unknown) => {
    if (logStream) logStream.write(JSON.stringify({ ts: Date.now(), event, data }) + '\n');

    switch (event) {
      case 'chunk': {
        const d = data as { delta?: string; content?: string };
        const t = d.delta ?? d.content ?? (typeof data === 'string' ? data : '');
        process.stdout.write(t);
        textBuffer += t;
        break;
      }
      case 'tool_start': {
        const d = data as { toolName?: string; name?: string };
        const name = d.toolName ?? d.name ?? '?';
        toolsThisTurn.push(name);
        process.stderr.write(`  [tool] ${name}\n`);
        break;
      }
      case 'a2ui':
        a2uiThisTurn.push(data);
        applyA2UI(data);
        break;
      case 'end':
        if (!textBuffer.endsWith('\n')) process.stdout.write('\n');
        break;
      case 'error':
        process.stderr.write(`[error] ${(data as any)?.message ?? data}\n`);
        break;
    }
  };

  await runner.run(session, userInput, sseWrite as any);

  rebuildActions();

  if (a2uiThisTurn.length > 0) {
    process.stderr.write(`\n[a2ui] ${a2uiThisTurn.length} message(s) emitted\n`);
  }

  if (pendingActions.length > 0) {
    process.stderr.write('\nActions:\n');
    for (const a of pendingActions) {
      process.stderr.write(`  [${a.index}] ${a.display}\n`);
    }
  }

  process.stderr.write('\n');
}

function resolveInput(raw: string): string {
  const n = parseInt(raw.trim(), 10);
  if (!isNaN(n) && n >= 1 && n <= pendingActions.length) {
    const a = pendingActions[n - 1];
    process.stderr.write(`→ firing action [${n}]: ${a.display}\n   input: ${a.agentInput.replace(/\n/g, '\\n')}\n\n`);
    return a.agentInput;
  }
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  process.stderr.write(`[repl] session=${session.sessionId} agent=${args.agent}\n\n`);

  const rl = readline.createInterface({ input: process.stdin, terminal: process.stdin.isTTY });

  if (args.message) {
    process.stderr.write(`> ${args.message}\n`);
    await runTurn(args.message);
  }

  if (process.stdin.isTTY) process.stderr.write('> ');
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'exit' || trimmed === 'quit') break;
    const input = resolveInput(trimmed);
    if (process.stdin.isTTY) process.stderr.write(`> ${trimmed}\n`);
    await runTurn(input);
    if (process.stdin.isTTY) process.stderr.write('> ');
  }

  rl.close();
  logStream?.end();
}

main().catch(err => {
  process.stderr.write(`[repl] fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
