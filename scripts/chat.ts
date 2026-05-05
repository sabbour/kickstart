#!/usr/bin/env node
/**
 * scripts/chat.ts  —  Live conversation CLI for the AKS Kickstart harness.
 *
 * Drives a multi-turn conversation against the harness and records the SSE
 * event stream as an `ActualOutput` JSON file. The output can be fed straight
 * into `npm run sim-test` to score the run against a golden fixture.
 *
 * Usage
 * ──────
 *   # Single turn, print to stdout
 *   npm run chat -- --message "deploy my Next.js app to AKS"
 *
 *   # Single turn + save ActualOutput for scoring
 *   npm run chat -- --message "deploy my Next.js app to AKS" --output out.json
 *
 *   # Multi-turn interactive session
 *   npm run chat -- --interactive
 *
 *   # Non-interactive with multiple messages piped in (one per line)
 *   echo -e "deploy my app\nuse KEDA" | npm run chat -- --interactive
 *
 *   # Auto-score after run
 *   npm run chat -- --message "deploy my app" --output out.json --sim sims/sim-01-sam-nextjs.md
 *
 * Environment variables
 * ──────────────────────
 *   AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY  — Azure provider
 *   OPENAI_API_KEY                                — OpenAI fallback
 *   KICKSTART_PACKS                               — comma-separated pack IDs
 */

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { Session } from '@aks-kickstart/harness/runtime/session';
import { Runner } from '@aks-kickstart/harness/runtime/runner';
import { assertCredentials, buildCliRegistry } from '../packages/sim-test/src/harness-bootstrap.js';
import { SimRecorder } from '../packages/sim-test/src/recorder.js';
import { parseSimTranscriptFile } from '../packages/sim-test/src/parser.js';
import { scoreSimRun } from '../packages/sim-test/src/scorer.js';

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    message:     { type: 'string',  short: 'm' },
    interactive: { type: 'boolean', short: 'i', default: false },
    output:      { type: 'string',  short: 'o' },
    transcript:  { type: 'string',  short: 't' },
    sim:         { type: 'string',  short: 's' },
    agent:       { type: 'string',  short: 'a', default: 'core.triage' },
    workspace:   { type: 'string',  short: 'w' },
    'max-turns': { type: 'string',  default: '20' },
    quiet:       { type: 'boolean', short: 'q', default: false },
    help:        { type: 'boolean', short: 'h', default: false },
  },
  strict: false,
});

if (args.help) {
  console.log(`
Usage: npm run chat -- [options]

Options:
  -m, --message <text>      First message to send (optional with --interactive)
  -i, --interactive         Enter interactive multi-turn loop (reads from stdin)
  -o, --output <file>       Write ActualOutput JSON to file
  -t, --transcript <file>   Write full SSE event transcript to file
  -s, --sim <file>          Auto-score against sim fixture after the run
  -a, --agent <name>        Starting agent (default: core.triage)
  -w, --workspace <path>    Workspace root for the session
      --max-turns <n>       Max turns for non-interactive single-message (default: 20)
  -q, --quiet               Suppress streaming output (still writes to --output)
  -h, --help                Show this help
`.trim());
  process.exit(0);
}

if (!args.message && !args.interactive) {
  console.error('Error: provide --message "..." or --interactive');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

assertCredentials();

console.error('[chat] Loading pack registry…');
const registry = buildCliRegistry();
console.error('[chat] Registry ready.');

const session = new Session({
  sessionId: randomUUID(),
  user: { oid: 'cli-user', upn: 'cli@localhost' },
  workspaceRoot: args.workspace ?? process.cwd(),
});

if (args.agent && args.agent !== 'core.triage') {
  session.activeAgent = args.agent;
}

const runner = new Runner(registry);
const recorder = new SimRecorder();

// ---------------------------------------------------------------------------
// SSE display helpers
// ---------------------------------------------------------------------------

let currentLineText = '';

function displayChunk(text: string): void {
  if (args.quiet) return;
  process.stdout.write(text);
  currentLineText += text;
}

function displayEndTurn(): void {
  if (args.quiet) return;
  if (!currentLineText.endsWith('\n')) process.stdout.write('\n');
  currentLineText = '';
}

function displayToolEvent(type: 'start' | 'done', name: string): void {
  if (args.quiet) return;
  const icon = type === 'start' ? '⚙' : '✓';
  console.error(`\n${icon} ${name}`);
}

function displayA2UI(data: unknown): void {
  if (args.quiet) return;
  // Show a compact one-liner so the operator knows a component was emitted
  try {
    const summary = JSON.stringify(data).slice(0, 120);
    console.error(`\n[a2ui] ${summary}${summary.length >= 120 ? '…' : ''}`);
  } catch {
    console.error('\n[a2ui] <non-serialisable payload>');
  }
}

// ---------------------------------------------------------------------------
// Single turn runner
// ---------------------------------------------------------------------------

async function runTurn(message: string): Promise<void> {
  const writer = recorder.writer();
  const sseWrite = (event: string, data: unknown) => {
    writer(event as any, data);

    switch (event) {
      case 'chunk': {
        const d = data as { delta?: string; content?: string };
        displayChunk(d.delta ?? d.content ?? (typeof data === 'string' ? data : ''));
        break;
      }
      case 'tool_start': {
        const d = data as { toolName?: string; name?: string };
        displayToolEvent('start', d.toolName ?? d.name ?? '?');
        break;
      }
      case 'tool_done': {
        const d = data as { toolName?: string; name?: string };
        displayToolEvent('done', d.toolName ?? d.name ?? '?');
        break;
      }
      case 'a2ui':
        displayA2UI(data);
        break;
      case 'end':
        displayEndTurn();
        break;
      case 'error': {
        const msg = (data as { message?: string })?.message ?? String(data);
        console.error(`\n[error] ${msg}`);
        break;
      }
    }
  };

  await runner.run(session, message, sseWrite as any);
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const maxTurns = parseInt(String(args['max-turns'] ?? '20'), 10);

  if (args.interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

    if (!args.quiet) {
      console.error('\n=== AKS Kickstart — interactive chat ===');
      console.error('Type your message and press Enter. Use Ctrl-D or "exit" to quit.\n');
    }

    // Send the initial --message first if provided
    if (args.message) {
      if (!args.quiet) console.error(`\n> ${args.message}`);
      await runTurn(args.message);
    }

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'exit' || trimmed === 'quit') break;
      if (!args.quiet) process.stderr.write('\n');
      await runTurn(trimmed);
    }

    rl.close();
  } else {
    // Single message mode — run one turn (the runner itself may do multiple
    // internal LLM/tool cycles, but the top-level conversation is one message)
    if (!args.quiet) console.error(`\n> ${args.message}`);
    let turns = 0;
    do {
      await runTurn(args.message!);
      turns++;
    } while (false); // One outer turn; internal chaining handled by runner
    void turns; // suppress lint
  }

  // ---------------------------------------------------------------------------
  // Finalise output
  // ---------------------------------------------------------------------------

  const actual = recorder.toActualOutput();

  if (args.output) {
    const outPath = path.resolve(args.output);
    fs.writeFileSync(outPath, JSON.stringify(actual, null, 2) + '\n', 'utf-8');
    console.error(`\n[chat] ActualOutput saved → ${outPath}`);
  }

  if (args.transcript) {
    const tPath = path.resolve(args.transcript);
    fs.writeFileSync(
      tPath,
      JSON.stringify({ events: recorder.allEvents() }, null, 2) + '\n',
      'utf-8',
    );
    console.error(`[chat] Transcript saved → ${tPath}`);
  }

  // Auto-score if --sim provided
  if (args.sim) {
    const simPath = path.resolve(args.sim);
    try {
      const transcript = parseSimTranscriptFile(simPath);
      const score = scoreSimRun(transcript, actual);

      console.error('\n── Sim Score ──────────────────────────────');
      console.error(`Sim:    ${transcript.title}`);
      console.error(`Score:  ${score.overallScore}/100 — ${score.pass ? '✅ PASS' : '❌ FAIL'}`);
      for (const c of score.criteria) {
        const icon = c.pass ? '✓' : '✗';
        console.error(`  ${icon} ${c.name}: ${c.score}/${c.weight}pts  ${c.details ?? ''}`);
      }
      console.error('───────────────────────────────────────────\n');

      if (!score.pass) process.exit(1);
    } catch (err) {
      console.error(`[chat] Could not score against '${args.sim}': ${(err as Error).message}`);
      process.exit(2);
    }
  }
}

main().catch((err) => {
  console.error('[chat] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
