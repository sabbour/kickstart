#!/usr/bin/env node
/**
 * scripts/probe.ts — Programmatic harness probe for prompt-flow testing.
 *
 * Reads one input per line from stdin. After each agent turn writes one JSON
 * record to stdout. stderr gets the noisy runner logs.
 *
 * Input formats (one per line):
 *   <text>           — send as a user message
 *   :<n>             — fire pending action number n (e.g.  :2)
 *   :<eventName>     — fire by event name, picks first match (e.g.  :select_inference)
 *   :<event>:<id>    — fire by event name + option id  (e.g.  :select_inference:kaito)
 *
 * Output (one JSON line per turn to stdout):
 * {
 *   turn: number,
 *   agent: string,
 *   text: string,
 *   toolCalls: string[],
 *   a2ui: unknown[],          // raw a2ui payloads
 *   actions: [{
 *     index: number,
 *     event: string,
 *     optionId: string | null,
 *     label: string,
 *     agentInput: string       // exact string sent to runner.run()
 *   }]
 * }
 *
 * Usage:
 *   npm run probe                          # interactive (type inputs manually)
 *   echo "deploy my app\n:2" | npm run probe   # scripted
 *   npm run probe -- --first "deploy my Next.js app"
 */

import * as readline from 'node:readline';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Session } from '@aks-kickstart/harness/runtime/session';
import { Runner } from '@aks-kickstart/harness/runtime/runner';
import { assertCredentials, buildCliRegistry } from '../packages/sim-test/src/harness-bootstrap.js';

const { values: args } = parseArgs({
  options: {
    first:  { type: 'string', short: 'f' },  // first message (sent before stdin loop)
    agent:  { type: 'string', short: 'a', default: 'core.triage' },
  },
  strict: false,
});

// Redirect all console output to stderr so stdout stays pure JSON
console.log   = (...a: unknown[]) => process.stderr.write(a.map(String).join(' ') + '\n');
console.warn  = (...a: unknown[]) => process.stderr.write(a.map(String).join(' ') + '\n');
console.error = (...a: unknown[]) => process.stderr.write(a.map(String).join(' ') + '\n');

assertCredentials();
const registry = buildCliRegistry();

const session = new Session({
  sessionId: randomUUID(),
  user: { oid: 'probe-user', upn: 'probe@localhost' },
  workspaceRoot: process.cwd(),
});

if (args.agent && args.agent !== 'core.triage') session.activeAgent = args.agent;

const runner = new Runner(registry);

// ---------------------------------------------------------------------------
// A2UI surface state
// ---------------------------------------------------------------------------

type Comp = Record<string, unknown>;
const surfaces = new Map<string, Map<string, Comp>>();

function applyA2UI(msg: unknown): void {
  if (!msg || typeof msg !== 'object') return;
  const m = msg as Record<string, unknown>;
  if (m.createSurface) {
    const { surfaceId } = m.createSurface as { surfaceId: string };
    if (!surfaces.has(surfaceId)) surfaces.set(surfaceId, new Map());
  }
  if (m.updateComponents) {
    const { surfaceId, components } = m.updateComponents as { surfaceId: string; components: Comp[] };
    // Replace the surface entirely — stale components from prior turns must not linger
    const s = new Map<string, Comp>();
    surfaces.set(surfaceId, s);
    for (const c of components ?? []) {
      if (typeof c.id === 'string') s.set(c.id, c);
    }
  }
}

// ---------------------------------------------------------------------------
// Action list (rebuilt after every turn)
// ---------------------------------------------------------------------------

interface Action {
  index: number;
  event: string;
  optionId: string | null;
  label: string;
  agentInput: string;
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
            event: eventName,
            optionId: opt.id,
            label,
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
          event: eventName,
          optionId: null,
          label,
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
// Run one turn, return structured result
// ---------------------------------------------------------------------------

let turnIndex = 0;

// Routing turns (transfer_to_* agent handoffs) can take > 90s because the target
// agent generates its full first response within the same runner.run() call.
// Use a longer timeout to accommodate that. If the timeout fires, we mark the
// session as poisoned — subsequent runTurn() calls skip runner.run() so a stale
// background run cannot corrupt the shared session object.
const RUNNER_TIMEOUT_MS      = 180_000; // 3 min per turn — routing turns can be slow
let sessionPoisoned = false;

async function runTurn(userInput: string): Promise<void> {
  turnIndex++;
  const toolCalls: string[] = [];
  const a2uiEvents: unknown[] = [];
  let text = '';

  if (sessionPoisoned) {
    text = '[probe] session poisoned by prior timeout — cannot continue';
    process.stderr.write(`[probe] ⚠️  Skipping turn ${turnIndex} — session is poisoned\n`);
    process.stdout.write(JSON.stringify({
      turn: turnIndex, agent: session.activeAgent ?? 'unknown',
      text, toolCalls, a2ui: [], actions: [],
    }) + '\n');
    return;
  }

  const sseWrite = (event: string, data: unknown) => {
    switch (event) {
      case 'chunk': {
        const d = data as { delta?: string; content?: string };
        const delta = d.delta ?? d.content ?? (typeof data === 'string' ? data : '');
        text += delta;
        if (delta) process.stdout.write(JSON.stringify({ stream: 'chunk', delta }) + '\n');
        break;
      }
      case 'tool_start': {
        const d = data as { toolName?: string; name?: string };
        const name = d.toolName ?? d.name ?? '?';
        toolCalls.push(name);
        process.stdout.write(JSON.stringify({ stream: 'tool', name }) + '\n');
        break;
      }
      case 'a2ui':
        a2uiEvents.push(data);
        applyA2UI(data);
        break;
      case 'user_action_req': {
        const d = data as { actionName?: string };
        process.stderr.write(`[probe] ⚡ UserAction: ${d.actionName ?? '?'} — not auto-resolved in sim\n`);
        break;
      }
      case 'error':
        process.stderr.write(`[error] ${(data as any)?.message ?? data}\n`);
        // Forward to stdout so persona-sim can capture it per-turn
        process.stdout.write(JSON.stringify({ stream: 'log', level: 'error', msg: (data as any)?.message ?? String(data) }) + '\n');
        break;
    }
  };

  // Race runner against a timeout so a hung tool call doesn't freeze the whole sim.
  // On timeout we poison the session — the background runner.run() is still live
  // and sharing the session object, so any further calls would corrupt state.
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`runner timed out after ${RUNNER_TIMEOUT_MS / 1000}s`)), RUNNER_TIMEOUT_MS),
  );

  try {
    await Promise.race([
      runner.run(session, userInput, sseWrite as any),
      timeoutPromise,
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[probe] ⚠️  runner error: ${msg}\n`);
    if (!text) text = `[runner error: ${msg}]`;
    if (msg.includes('timed out')) {
      sessionPoisoned = true;
      process.stderr.write(`[probe] 🔴 session poisoned — probe will not accept further turns\n`);
    }
  }

  rebuildActions();

  // Emit a diagnostic when the agent produced no text — helps persona-sim detect dead ends
  if (!text.trim()) {
    const tools = toolCalls.join(', ') || 'none';
    process.stdout.write(JSON.stringify({
      stream: 'log', level: 'warn',
      msg: `silent turn — tools: [${tools}], a2ui: ${a2uiEvents.length} event(s), actions: ${pendingActions.length}`,
    }) + '\n');
  }

  const record = {
    turn: turnIndex,
    agent: session.activeAgent,
    text: text.trim(),
    toolCalls,
    a2ui: a2uiEvents,
    actions: pendingActions.map(a => ({
      index: a.index,
      event: a.event,
      optionId: a.optionId,
      label: a.label,
      agentInput: a.agentInput,
    })),
  };

  // One JSON line per turn to stdout — easy to parse with jq or node
  process.stdout.write(JSON.stringify(record) + '\n');
}

// ---------------------------------------------------------------------------
// Input resolution
// ---------------------------------------------------------------------------

function resolveInput(raw: string): string {
  const trimmed = raw.trim();

  // :N  — action by index
  if (/^:\d+$/.test(trimmed)) {
    const n = parseInt(trimmed.slice(1), 10);
    const a = pendingActions.find(x => x.index === n);
    if (a) return a.agentInput;
    process.stderr.write(`[probe] no action at index ${n}\n`);
    return trimmed.slice(1);
  }

  // :eventName  or  :eventName:optionId
  if (trimmed.startsWith(':')) {
    const [, eventName, optionId] = trimmed.split(':');
    const a = pendingActions.find(x =>
      x.event === eventName && (optionId == null || x.optionId === optionId),
    );
    if (a) return a.agentInput;
    process.stderr.write(`[probe] no action matching event="${eventName}" optionId="${optionId ?? '*'}"\n`);
    return eventName;
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  process.stderr.write(`[probe] session=${session.sessionId} agent=${args.agent}\n`);

  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  if (args.first) {
    await runTurn(args.first);
  }

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'exit' || trimmed === 'quit') break;
    const input = resolveInput(trimmed);
    await runTurn(input);
  }

  rl.close();
}

main().catch(err => {
  process.stderr.write(`[probe] fatal: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
