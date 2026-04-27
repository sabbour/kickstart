/**
 * Runner — wraps @openai/agents SDK to drive agent turns and stream SSE events.
 *
 * Design decisions:
 * - One Runner instance is shared across all API invocations (stateless by design).
 * - The Session carries all mutable per-conversation state.
 * - a2uiEmissions are drained IMMEDIATELY per LLM tool_call event (Leela C2).
 * - UserActions interrupt the run: the tool emits user_action_req, aborts the
 *   stream, and stores the pending state in session.pendingUserAction.
 * - On resume, the stored run history is rebuilt and the run continues.
 * - Playground stubs are gated by KICKSTART_PLAYGROUND=true (Zapp Critical 3).
 */

import { randomUUID } from 'node:crypto';
import { Agent, Runner as SDKRunner, handoff, tool, setDefaultModelProvider, OpenAIProvider, setTraceProcessors } from '@openai/agents';
import type { FunctionTool, AgentInputItem, CallModelInputFilter } from '@openai/agents';
import type { GuardrailContribution } from '../types/guardrail.js';
import type { Turn, ToolCallRecord } from '../types/session.js';
import { OtelBridgeTraceProcessor } from './agents-otel-bridge.js';
import type { AgentContribution } from '../types/agent.js';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';
import type { PackRegistry } from './registry.js';
import type { Session } from './session.js';
import type { SSEWriter } from './sse.js';
import { AgentOutput } from '../types/agent-output.js';
import { runGuardrails } from './guardrails.js';
import { resolveModelName } from './model-resolution.js';
import { PlanArtifactMissing, ChainDepthExceeded } from '../errors/index.js';
import { sanitizeError } from './sanitize-error.js';
import { z } from 'zod';
import { buildRunConfig } from './run-config.js';
import type { RunConfig } from './run-config.js';
import { withRetry, CircuitBreaker, CircuitOpenError } from '../utils/retry.js';

// ---------------------------------------------------------------------------
// Retry / circuit-breaker — module-level state (#102)
// ---------------------------------------------------------------------------

/**
 * Module-level circuit breaker for sdkRunner.run() calls.
 * Opens after 5 consecutive failures and prevents further calls until reset
 * by a successful turn. Reset is automatic on success via `recordSuccess()`.
 */
const runnerCircuitBreaker = new CircuitBreaker(5);

// ---------------------------------------------------------------------------
// callModelInputFilter — large tool result summarisation (#103)
// ---------------------------------------------------------------------------

/**
 * Maximum content length (characters) for a tool result item before it is
 * truncated. Results longer than this are trimmed with "[... truncated]" to
 * avoid exhausting context budget.
 */
export const TOOL_RESULT_MAX_CHARS = 2000;

/**
 * Return true when an `AgentInputItem` is a function_call_result whose
 * `output` text content exceeds `TOOL_RESULT_MAX_CHARS`.
 */
export function isLargeToolResult(item: AgentInputItem): boolean {
  if ((item as { type?: string }).type !== 'function_call_result') return false;
  const output = (item as { output?: unknown }).output;
  if (typeof output === 'string') {
    return output.length > TOOL_RESULT_MAX_CHARS;
  }
  // ToolCallOutputContent array — measure total char length.
  if (Array.isArray(output)) {
    const total = (output as Array<{ text?: string }>)
      .map((c) => (typeof c.text === 'string' ? c.text.length : 0))
      .reduce((a, b) => a + b, 0);
    return total > TOOL_RESULT_MAX_CHARS;
  }
  return false;
}

/**
 * Return a copy of a function_call_result item with its output truncated to
 * `TOOL_RESULT_MAX_CHARS` characters. The original item is not mutated.
 */
export function summarizeToolResult(item: AgentInputItem): AgentInputItem {
  const output = (item as { output?: unknown }).output;
  let truncatedOutput: string | Array<{ type: string; text: string }>;

  if (typeof output === 'string') {
    truncatedOutput = `${output.slice(0, TOOL_RESULT_MAX_CHARS)}[... truncated]`;
  } else if (Array.isArray(output)) {
    const joined = (output as Array<{ text?: string }>)
      .map((c) => (typeof c.text === 'string' ? c.text : ''))
      .join('');
    truncatedOutput = [{ type: 'output_text', text: `${joined.slice(0, TOOL_RESULT_MAX_CHARS)}[... truncated]` }];
  } else {
    return item;
  }

  return { ...(item as object), output: truncatedOutput } as AgentInputItem;
}

/**
 * `CallModelInputFilter` implementation (#103).
 *
 * Applied before every model call. Summarises (truncates) any
 * `function_call_result` items whose output exceeds `TOOL_RESULT_MAX_CHARS`.
 * Large results are trimmed with "[... truncated]" rather than dropped so
 * the model retains awareness that the tool ran.
 *
 * Exported for unit-testing.
 */
export const callModelInputFilter: CallModelInputFilter = ({ modelData }) => {
  const filtered = modelData.input.map((item) =>
    isLargeToolResult(item) ? summarizeToolResult(item) : item,
  );
  return { ...modelData, input: filtered };
};

/**
 * Factory contract for harness-provided universal tools that must be bound
 * per turn (they close over current agentName + session + registry). The
 * pack-core `createReadSkillTool` implements this shape. Injecting the
 * factory rather than importing it directly preserves the harness → pack-core
 * no-dependency rule (pack-core imports harness types already).
 */
export interface ReadSkillToolFactoryInput {
  registry: {
    listSkillsForAgent(agentName: string): ReadonlyArray<{ id: string; description: string }>;
    getSkill(id: string): import('../types/skill.js').Skill | undefined;
  };
  agentName: string;
  session: Session;
}
export type ReadSkillToolFactory = (input: ReadSkillToolFactoryInput) => ToolContribution;

export interface RunnerOptions {
  /**
   * Optional factory for the `core.read_skill` tool (#1070). When provided,
   * the runner registers the tool universally on every agent as a harness
   * primitive, bypassing pack `toolAllowlist`. Application wiring passes
   * `createReadSkillTool` from `@aks-kickstart/pack-core`. Tests that don't
   * care about skill pulls omit this — the tool is simply not registered.
   */
  readSkillToolFactory?: ReadSkillToolFactory;
}

// ---------------------------------------------------------------------------
// Feature flag: KICKSTART_USE_RESPONSES
// ---------------------------------------------------------------------------

/**
 * Returns true when the KICKSTART_USE_RESPONSES env var is set to a truthy
 * value ("1", "true", "yes", "on").  Default is false so existing behaviour
 * is unchanged until the flag is explicitly enabled (Phase 2 of #114).
 */
export function isResponsesApiEnabled(): boolean {
  const val = (process.env.KICKSTART_USE_RESPONSES ?? '').toLowerCase().trim();
  return val === '1' || val === 'true' || val === 'yes' || val === 'on';
}

// ---------------------------------------------------------------------------
// runChain / runWithGate — Deterministic sequential agent execution (#119)
// ---------------------------------------------------------------------------

/**
 * Maximum number of steps allowed in a single `runChain()` call.
 * Prevents misconfigured chains from looping indefinitely.
 */
export const CHAIN_MAX_STEPS = 10;

/** A single step in a deterministic agent chain. */
export interface ChainStep {
  agentName: string;
  /**
   * Explicit input for this step. When omitted the previous step's output
   * is forwarded as the input (pass-through chaining).
   */
  input?: string;
}

/** Combined result returned after a full `runChain()` execution. */
export interface ChainResult {
  /** Per-step outputs in execution order. */
  steps: Array<{ agentName: string; output: string }>;
  /** Output of the final step (empty string when the chain was aborted). */
  finalOutput: string;
  /** `true` when the chain was stopped early (e.g. reviewer rejection). */
  aborted: boolean;
  /** Human-readable reason supplied by the step that triggered the abort. */
  abortReason?: string;
}

/** Structured verdict emitted by the gate reviewer. */
export interface GateResult {
  approved: boolean;
  feedback?: string;
}

/**
 * Parse a reviewer's raw text output for a binary APPROVED / REJECTED verdict.
 *
 * **Conservative by design**: any ambiguous output is treated as a rejection
 * so the chain never silently passes without an explicit approval signal.
 *
 * Exported for unit-testing.
 */
export function parseGateVerdict(output: string): GateResult {
  const APPROVED_RE = /\bAPPROVED\b/i;
  const REJECTED_RE = /\bREJECTED\b/i;

  if (APPROVED_RE.test(output)) {
    // An explicit REJECTED keyword beats APPROVED when both appear in the
    // same response (e.g. "not REJECTED, APPROVED") — parse positionally:
    // find the last occurrence of each keyword; approve only when APPROVED
    // appears after REJECTED (or REJECTED is absent).
    const allApproved = [...output.matchAll(/\bAPPROVED\b/gi)];
    const allRejected = [...output.matchAll(/\bREJECTED\b/gi)];
    const lastApproved = allApproved.length ? allApproved[allApproved.length - 1].index! : -1;
    const lastRejected = allRejected.length ? allRejected[allRejected.length - 1].index! : -1;
    if (lastRejected === -1 || lastApproved > lastRejected) {
      return { approved: true };
    }
  }
  if (REJECTED_RE.test(output)) {
    return { approved: false, feedback: output };
  }
  // Ambiguous → conservative rejection
  return { approved: false, feedback: 'Reviewer did not produce a clear verdict.' };
}

// ---------------------------------------------------------------------------
// Build model provider (Azure-aware)
// ---------------------------------------------------------------------------


/**
 * Build the Azure OpenAI baseURL for use with the OpenAI-compatible SDK.
 *
 * Uses the new Azure OpenAI v1 endpoint shape:
 *   https://{resource}.openai.azure.com/openai/v1
 *
 * The SDK will then append `/chat/completions`, producing the correct
 * `/openai/v1/chat/completions` path. The previous shape (`/openai`) resolved
 * to `/openai/chat/completions`, which does not exist on Azure OpenAI and
 * returned HTTP 404 "Resource not found" for every /api/converse call (see #932).
 *
 * Azure OpenAI only serves chat completions under two shapes:
 *   - legacy: /openai/deployments/{name}/chat/completions?api-version=...
 *   - v1:     /openai/v1/chat/completions
 * We target v1 because it matches the OpenAI-compatible surface the SDK uses.
 */
export function buildAzureBaseUrl(endpoint: string): string {
  const trimmed = endpoint.replace(/\/$/, '');
  return `${trimmed}/openai/v1`;
}

export function buildModelProvider(): OpenAIProvider {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const useResponses = isResponsesApiEnabled();

  if (endpoint && apiKey) {
    // Azure OpenAI — use the v1 OpenAI-compatible surface (see #932).
    const azureBaseUrl = buildAzureBaseUrl(endpoint);
    console.log('[runner] Building model provider: Azure OpenAI');
    return new OpenAIProvider({
      apiKey,
      baseURL: azureBaseUrl,
      useResponses,
    });
  }

  // Standard OpenAI (dev/test) — reads OPENAI_API_KEY from env automatically
  console.log('[runner] Building model provider: Standard OpenAI (or dev/test fallback)');
  return new OpenAIProvider({ useResponses });
}

// Lazily-initialised shared provider + SDK runner
let _sdkRunner: SDKRunner | null = null;
let _otelBridgeInstalled = false;

/**
 * Install the OpenTelemetry bridge as the sole `@openai/agents` trace
 * processor. Replacing (rather than adding to) the default processors
 * means:
 *   - No outbound to OpenAI's traces dashboard (no OPENAI_API_KEY needed,
 *     no unintended data egress to a third-party endpoint).
 *   - Every AgentSpan / GenerationSpan / FunctionSpan / GuardrailSpan /
 *     HandoffSpan is mirrored into an OTel span and flows through the
 *     Azure Monitor OpenTelemetry distro already bootstrapped in the API
 *     layer. Outbound HTTP deps captured by the undici OTel
 *     instrumentation become children of the matching generation span,
 *     giving full workflow → agent → generation → HTTPS request nesting
 *     in Application Insights.
 *
 * Idempotent: guarded so repeated Runner instantiations do not clobber
 * the processor list on every API invocation.
 */
function installOtelBridgeOnce(): void {
  if (_otelBridgeInstalled) return;
  try {
    setTraceProcessors([new OtelBridgeTraceProcessor()]);
    _otelBridgeInstalled = true;
  } catch (err) {
    // Never fail the runner because of telemetry wiring.
    console.warn('[runner] Failed to install OTel trace bridge:', err);
  }
}

function getSdkRunner(): SDKRunner {
  if (!_sdkRunner) {
    installOtelBridgeOnce();
    const provider = buildModelProvider();
    setDefaultModelProvider(provider);
    _sdkRunner = new SDKRunner({ modelProvider: provider });
  }
  return _sdkRunner;
}

// ---------------------------------------------------------------------------
// Tool wrapping
// ---------------------------------------------------------------------------

/** Opaque SSE payload emitted on any guardrail block — never includes details. */
const GUARDRAIL_BLOCK_EVENT = { code: 'GUARDRAIL_BLOCK', message: 'Request could not be completed' } as const;

/**
 * Wrap a ToolContribution as an @openai/agents function tool, injecting
 * guardrail checks before each execution.
 *
 * Only FunctionTool types are wrapped — other tool types (ShellTool etc.)
 * are returned as-is since they lack the execute/invoke surface.
 *
 * On a tool-stage block: emits opaque GUARDRAIL_BLOCK SSE, sets the
 * haltedByGuardrail flag, and aborts the run so no further tools execute.
 */
function wrapTool(
  contrib: ToolContribution,
  guardrails: ReturnType<PackRegistry['getGuardrailsByStage']>,
  agentName: string,
  sseWrite: SSEWriter,
  abortCtrl: AbortController,
  isHalted: () => boolean,
  setHalted: () => void,
) {
  const inner = contrib.tool;

  // Only FunctionTool has description/parameters/invoke
  if (inner.type !== 'function') {
    return inner;
  }

  const fnTool = inner as FunctionTool;

  // Create a wrapped FunctionTool object directly (bypasses tool() overload complexity)
  const wrapped: FunctionTool = {
    type: 'function',
    name: fnTool.name,
    description: fnTool.description ?? '',
    parameters: fnTool.parameters,
    strict: fnTool.strict,
    invoke: async (runContext, input, details) => {
      const typedArgs = (() => {
        try { return JSON.parse(input) as Record<string, unknown>; } catch { return {} as Record<string, unknown>; }
      })();
      // If a prior guardrail already halted the turn, skip execution silently
      if (isHalted()) {
        return '[tool blocked — guardrail halted this turn]';
      }

      const guardInput = {
        stage: 'tool' as const,
        toolName: fnTool.name,
        toolArgs: typedArgs,
      };

      let guardResult;
      try {
        guardResult = await runGuardrails('tool', guardInput, guardrails, agentName);
      } catch {
        // Fail-closed: runGuardrails itself threw — treat as block
        setHalted();
        sseWrite('error', GUARDRAIL_BLOCK_EVENT);
        abortCtrl.abort();
        return '[tool blocked — guardrail error]';
      }

      if (guardResult.blocked) {
        setHalted();
        sseWrite('error', GUARDRAIL_BLOCK_EVENT);
        abortCtrl.abort();
        return '[tool blocked by guardrail]';
      }

      // Use possibly-redacted args from the guardrail result
      const finalArgs = guardResult.mutatedInput.toolArgs ?? typedArgs;

      // Delegate to the inner FunctionTool via its invoke() using the real run context
      return fnTool.invoke(runContext, JSON.stringify(finalArgs), details) as Promise<string>;
    },
    needsApproval: fnTool.needsApproval,
    isEnabled: fnTool.isEnabled,
    inputGuardrails: fnTool.inputGuardrails,
    outputGuardrails: fnTool.outputGuardrails,
  };
  return wrapped;
}

/**
 * Wrap a UserActionContribution as an @openai/agents function tool.
 *
 * When the LLM calls this tool:
 * 1. Emit user_action_req SSE event immediately.
 * 2. Store the pending action on the session.
 * 3. Signal the abort controller so the outer run loop terminates.
 * 4. Return a sentinel string to the LLM (not used — run is aborted).
 *
 * Zapp Critical 3: Playground stubs are only invoked when KICKSTART_PLAYGROUND=true.
 */
function wrapUserAction(
  contrib: UserActionContribution,
  session: Session,
  sseWrite: SSEWriter,
  abortCtrl: AbortController,
  registry: PackRegistry,
): ReturnType<typeof tool> {
  return tool({
    name: contrib.wireName,
    description: contrib.description,
    parameters: z.object({ input: contrib.parameters }).passthrough(),
    execute: async (args) => {
      const runId = randomUUID();

      // Zapp Critical 3: gate playground stubs
      const isPlayground = process.env.KICKSTART_PLAYGROUND === 'true';
      if (isPlayground) {
        const stubs = registry.playgroundStubs;
        const stub = stubs[contrib.name] ?? stubs[contrib.wireName];
        if (stub) {
          // Invoke the stub in playground mode
          try {
            const stubResult = typeof stub === 'function'
              ? await (stub as (args: unknown) => Promise<unknown>)(args)
              : stub;
            return JSON.stringify(stubResult);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return JSON.stringify({ error: msg });
          }
        }
        // If no stub found in playground mode, fall through to interrupt
      }

      // Store pending action on session including resultSchema for API-layer validation (Zapp Crit2b)
      session.pendingUserAction = {
        name: contrib.name,
        runId,
        issuedAt: new Date().toISOString(),
        resultSchema: contrib.resultSchema,
      };

      // Emit user_action_req SSE event — browser will dispatch and call /resume
      sseWrite('user_action_req', {
        sessionId: session.sessionId,
        actionId: runId,
        toolName: contrib.name,
        wireName: contrib.wireName,
        parameters: contrib.parameters,
        confirmComponent: contrib.confirmComponent,
        scopes: contrib.scopes ?? [],
      });

      // Drain any pending a2ui emissions before aborting (Leela C2)
      const a2uiMessages = session.drainA2UIEmissions();
      for (const msg of a2uiMessages) {
        sseWrite('a2ui', msg);
      }

      // Abort the run — the runner will catch the AbortError and write 'end'
      abortCtrl.abort();

      // This string is never sent to the LLM (run is aborted)
      return `[UserAction ${contrib.name} pending — waiting for browser result]`;
    },
  });
}

// ---------------------------------------------------------------------------
// Output text resolution — exported for unit-testing (#937)
// ---------------------------------------------------------------------------

/**
 * Extract the prose display text from a structured AgentOutput finalOutput.
 *
 * When the SDK runs with an `outputType`, the model emits JSON-encoded tokens
 * as the raw stream text (fullText).  The SDK also parses the final JSON and
 * exposes it via `result.finalOutput`.  This helper pulls `finalOutput.message`
 * so callers send clean prose to the client instead of the raw JSON token stream.
 *
 * Falls back to `fullText` when finalOutput is null, not an object, or has no
 * string `message` field (e.g. interrupted runs, plain-text agents without
 * structured output).
 */
export function resolveOutputText(finalOutput: unknown, fullText: string): string {
  if (
    finalOutput !== null &&
    typeof finalOutput === 'object' &&
    'message' in finalOutput &&
    typeof (finalOutput as { message?: unknown }).message === 'string'
  ) {
    return (finalOutput as { message: string }).message;
  }
  // AgentOutput.message is strictOptional (#90 + #1130) — the model sets it to
  // null (strict-mode) or omits it entirely (legacy) for surface-only turns.
  // Return empty string so no chat bubble is emitted.
  if (
    finalOutput !== null &&
    typeof finalOutput === 'object' &&
    (!('message' in finalOutput) ||
      (finalOutput as { message?: unknown }).message === null)
  ) {
    return '';
  }
  return fullText;
}

// ---------------------------------------------------------------------------
// Conversation history threading (#1062 Layer 0)
// ---------------------------------------------------------------------------

/**
 * Convert a bounded list of `session.recentTurns` into the SDK's
 * `AgentInputItem[]` shape expected by `Runner.run()`.
 *
 * **Role filter (Z1):** Only `user` and `assistant` turns are replayed. Any
 * `system`/`tool` turns in `recentTurns` are dropped — the SDK re-injects
 * system instructions from the `Agent` on every call, and we never record
 * raw tool-call/tool-result items in `recentTurns` today (runner only records
 * `role: 'user' | 'assistant'` Turn rows). Dropping them keeps the replay
 * shape clean and avoids leaking tool outputs that predate the current
 * guardrail policy.
 *
 * **Empty-content guard:** Turns with no string content are dropped — an
 * empty assistant message is not a useful replay item and the SDK requires
 * a non-empty string for user items and at least one content block for
 * assistant items.
 *
 * **Trust marker (#1074 M3):** Turns with `trust === 'client-hydrated'` are
 * wrapped in an explicit, delimited untrusted-context block so the LLM (and
 * any auditor reading a trace) can tell client-replayed context from
 * server-authored context. Delimiters are plain ASCII markers — no templating
 * engine, no user-controlled strings in the marker itself.
 *
 * Exported for unit-testing (Z1, regression guard for #1062; #1074 M3).
 */
const UNTRUSTED_BEGIN = '[BEGIN UNTRUSTED CONTEXT — client-hydrated, unverified]';
const UNTRUSTED_END = '[END UNTRUSTED CONTEXT]';

export function toAgentInputItems(turns: readonly Turn[], toolCallItems?: readonly ToolCallRecord[]): AgentInputItem[] {
  const items: AgentInputItem[] = [];
  for (const turn of turns) {
    const rawText = typeof turn.content === 'string' ? turn.content : '';
    if (!rawText) continue;
    const text = turn.trust === 'client-hydrated'
      ? `${UNTRUSTED_BEGIN}\n${rawText}\n${UNTRUSTED_END}`
      : rawText;
    if (turn.role === 'user') {
      items.push({ role: 'user', content: text } as AgentInputItem);
    } else if (turn.role === 'assistant') {
      items.push({
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text }],
      } as AgentInputItem);
    }
    // system / tool turns intentionally dropped — see doc-comment.
  }

  // Append stored tool call + result items from previous turns (#103).
  // These give the model context about prior tool actions. They are appended
  // at the end so any client-hydrated history comes first, followed by
  // server-authoritative tool context.
  if (toolCallItems && toolCallItems.length > 0) {
    for (const record of toolCallItems) {
      items.push(record.callItem);
      if (record.resultItem) {
        items.push(record.resultItem);
      }
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Runner turn budget (#1073, Zapp Z2)
// ---------------------------------------------------------------------------

/**
 * Default per-turn cap on SDK agent loop iterations. Each iteration is one
 * model call plus any tool-invocation round, so 10 is a generous ceiling
 * for the expected triage → specialist → triage chain while still acting
 * as a runtime circuit-breaker against mutual-handoff ping-pong (per
 * Zapp Z2 on #1073). Can be overridden via `KICKSTART_RUNNER_MAX_TURNS`.
 */
export const RUNNER_MAX_TURNS_DEFAULT = 10;

/**
 * Resolve the per-run `maxTurns` cap passed to `sdkRunner.run()`.
 *
 * Honors `KICKSTART_RUNNER_MAX_TURNS` when set to a positive integer; any
 * invalid / non-positive value falls back to the default. Exported for
 * unit-testing.
 */
export function resolveMaxTurns(): number {
  const raw = process.env.KICKSTART_RUNNER_MAX_TURNS;
  if (!raw) return RUNNER_MAX_TURNS_DEFAULT;
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n <= 0) return RUNNER_MAX_TURNS_DEFAULT;
  return n;
}

function normalizeComponentHint(hint: string | undefined): string | undefined {
  if (typeof hint !== 'string') return undefined;
  const cleaned = hint
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return undefined;
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
}

// ---------------------------------------------------------------------------
// Phase E: Plan artifact validation (PlanArtifactMissing / HARNESS_E001)
// ---------------------------------------------------------------------------

/**
 * Agents that require a `plan` artifact in the session before they can run.
 * If the artifact is missing, the runner surfaces a fixed-copy error Card
 * instead of calling the LLM.
 */
const PLAN_REQUIRED_AGENTS = new Set(['core.architect', 'core.codesmith']);

/**
 * Emit a fixed-copy A2UI Card surfacing HARNESS_E001 (PlanArtifactMissing).
 *
 * Security constraints (Zapp-approved):
 * - Title copy is FIXED — never derived from user or LLM input.
 * - errorCode is STABLE — enum-bounded stable code, never free-form.
 * - Recovery action schema is enum-bounded — targetPhase + reason only.
 * - Raw error details go to telemetry/console ONLY, never in this payload.
 */
function emitPlanArtifactMissingCard(sseWrite: SSEWriter): void {
  const surfaceId = 'error-plan-artifact-missing';
  sseWrite('a2ui', {
    version: 'v0.9',
    createSurface: { surfaceId, catalogId: 'kickstart' },
  });
  sseWrite('a2ui', {
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components: [
        {
          type: 'Card',
          id: 'plan-artifact-missing-card',
          title: 'Plan artifact is missing — please re-approve',
          errorCode: 'HARNESS_E001',
          actions: [
            {
              label: 'Re-approve',
              action: {
                targetPhase: 'architect',
                reason: 'plan_artifact_missing',
              },
            },
          ],
        },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export class Runner {
  private readonly readSkillToolFactory?: ReadSkillToolFactory;

  constructor(private readonly registry: PackRegistry, opts: RunnerOptions = {}) {
    this.readSkillToolFactory = opts.readSkillToolFactory;
  }

  /**
   * Build an SDK `Agent` instance for the given agent id, recursively
   * resolving frontmatter `handoffs[]` into SDK `handoff()` calls.
   *
   * ### Per-turn cache invariant (cycle safety — Leela DP §B, #1073)
   *
   * A `Map<agentId, Agent>` is passed in and shared across every recursive
   * call inside one turn. The caller MUST pass a fresh empty Map per turn
   * so tool closures (`session`, `sseWrite`, `abortCtrl`) are rebuilt and
   * don't leak across turns (Nibbler N1/N2).
   *
   * The cycle-safety trick: an Agent with an empty `handoffs: []` array is
   * constructed and inserted into the cache BEFORE we recurse into its
   * declared targets. This way, if target B's handoffs include A again
   * (A↔B cycle), the recursive `buildAgentInstance(A)` returns the
   * already-cached A placeholder instead of recursing forever. Handoff
   * instances are then pushed onto `agent.handoffs` after the recursion
   * returns — the SDK exposes `handoffs` as a mutable array, so late-push
   * is safe.
   *
   * Do not reorder: cache MUST be populated before the recursion into
   * targets, otherwise A↔B blows the stack.
   */
  private buildAgentInstance(
    agentName: string,
    cache: Map<string, Agent<any, any>>,
    ctx: {
      session: Session;
      sseWrite: SSEWriter;
      abortCtrl: AbortController;
      toolGuardrails: GuardrailContribution[];
      isHalted: () => boolean;
      setHalted: () => void;
      handoffInputFilter?: import('./run-config.js').HandoffInputFilter;
    },
  ): Agent<any, any> {
    const cached = cache.get(agentName);
    if (cached) return cached;

    const agentContrib = this.registry.getAgent(agentName);

    // Build tools list
    const toolContribs = this.registry.getToolsForAgent(agentName);
    const tools = toolContribs.map((contrib) => {
      if ('wireName' in contrib) {
        return wrapUserAction(
          contrib as UserActionContribution,
          ctx.session,
          ctx.sseWrite,
          ctx.abortCtrl,
          this.registry,
        );
      }
      return wrapTool(
        contrib as ToolContribution,
        ctx.toolGuardrails,
        agentName,
        ctx.sseWrite,
        ctx.abortCtrl,
        ctx.isHalted,
        ctx.setHalted,
      );
    });

    // ── #1070 D5 — register `core.read_skill` universally ───────────────────
    // Harness-provided universal tool. DELIBERATELY bypasses pack
    // `toolAllowlist` (policy exception): the tool's own fail-closed
    // `matchesSkill`-based allowlist is the access control, and adding it
    // to every pack's allowlist would be redundant churn for a harness
    // primitive. When `readSkillToolFactory` is not supplied (some tests),
    // the tool is simply not registered — byte-identical to pre-#1070.
    if (this.readSkillToolFactory) {
      const readSkillContrib = this.readSkillToolFactory({
        registry: {
          listSkillsForAgent: (name) => this.registry.listSkillsForAgent(name),
          getSkill: (id) => this.registry.getSkill(id),
        },
        agentName,
        session: ctx.session,
      });
      tools.push(
        wrapTool(
          readSkillContrib,
          ctx.toolGuardrails,
          agentName,
          ctx.sseWrite,
          ctx.abortCtrl,
          ctx.isHalted,
          ctx.setHalted,
        ) as FunctionTool,
      );
    }

    // Build dynamic instructions: base + skills stub + catalog hint
    const skills = this.registry.getSkillsForAgent(agentName);
    const skillsBlock = skills.length > 0
      ? `\n\n## Available Skills (call core.read_skill(id) to load the full body)\n${skills.map((s) => `- **${s.id}**: ${s.description}`).join('\n')}`
      : '';

    const components = this.registry.components;
    const catalogBlock = components.length > 0
      ? `\n\n## A2UI Component Catalog (${components.length} components available)\n${components.map((c) => {
          const hint = normalizeComponentHint(c.llmHint);
          return hint ? `- **${c.name}** — ${hint}` : `- ${c.name}`;
        }).join('\n')}`
      : '';

    const instructions = agentContrib.instructionsBase + skillsBlock + catalogBlock;
    const modelName = resolveModelName(agentContrib.model);

    // Construct with empty handoffs; insert into cache BEFORE recursing so
    // A↔B cycles terminate on the second visit. See doc-comment invariant.
    const agent = new Agent({
      name: agentContrib.name,
      instructions,
      tools,
      model: modelName,
      outputType: AgentOutput,
      handoffs: [],
    });
    cache.set(agentName, agent);

    // Resolve each frontmatter handoff recursively. PackRegistry.seal()
    // guarantees every target exists and belongs to the same pack (#1073
    // Z1), so a missing target here is a programmer error, not user input.
    for (const h of agentContrib.handoffs ?? []) {
      const target = this.buildAgentInstance(h.agent, cache, ctx);
      const description = h.prompt ? `${h.label}. ${h.prompt}` : h.label;
      agent.handoffs.push(handoff(target, {
        toolDescriptionOverride: description,
        // #104: apply default handoff input filter (strips A2UI outputs, compresses old turns).
        inputFilter: ctx.handoffInputFilter,
      }));
    }

    return agent;
  }

  async run(
    session: Session,
    userMessage: string,
    sseWrite: SSEWriter,
    signal?: AbortSignal,
    runConfig?: RunConfig,
  ): Promise<void> {
    sseWrite('start', { sessionId: session.sessionId });

    const agentName = session.activeAgent;

    // Plan artifact guard: agents that require a plan artifact throw before
    // any LLM call if the artifact is absent. Surfaces as a fixed-copy Card
    // via emitPlanArtifactMissingCard — raw error details go to TELEMETRY ONLY.
    if (PLAN_REQUIRED_AGENTS.has(agentName)) {
      if (!session.artifacts.has('plan')) {
        const phase: 'triage-to-architect' | 'architect-to-codesmith' =
          agentName === 'core.codesmith' ? 'architect-to-codesmith' : 'triage-to-architect';
        emitPlanArtifactMissingCard(sseWrite);
        sseWrite('end', {
          sessionId: session.sessionId,
          intent: undefined,
          model: 'unknown',
          agentName,
          skillsExecuted: [],
          skillsPulledBytes: 0,
          skillsPulledTokens: 0,
          toolsExecuted: [],
        });
        // Log phase to telemetry only — never expose in SSE payload.
        console.warn(`[runner] PlanArtifactMissing: phase=${phase} agent=${agentName}`);
        return;
      }
    }

    // NOTE(#1062 Z2): the user turn is recorded AFTER input guardrails run so
    // sanitized text lands in `recentTurns` (guardrail-on-capture). Recording
    // the raw userMessage here would persist pre-guardrail PII/credentials and
    // replay them on every subsequent turn when history threading is enabled.

    let agentContrib: AgentContribution;
    try {
      agentContrib = this.registry.getAgent(agentName);
    } catch (err) {
      sseWrite('error', { message: `Unknown agent: ${agentName}` });
      return;
    }

    // ── #1070 D5 — per-turn skill-pull counters (Zapp M1 HARD REQUIREMENT) ──
    // Reset at turn entry and in a try/finally at the bottom so counters
    // never leak across turns on thrown errors, abort, or guardrail halt.
    // Sourced by the `end` event (D12) and read by `core.read_skill` to
    // enforce the per-turn byte cap.
    session.skillsPulled = new Set<string>();
    session.skillsPulledBytes = 0;
    session.skillsPulledTokens = 0;

    try {

    const abortCtrl = new AbortController();
    // B2: forward external client-disconnect signal into the runner's abort controller
    if (signal) {
      signal.addEventListener('abort', () => abortCtrl.abort(signal.reason), { once: true });
    }

    // ── Input guardrail hook ────────────────────────────────────────────────
    const inputGuardrails = this.registry.getGuardrailsByStage('input');
    const guardInput = { stage: 'input' as const, userMessage };
    let guardedMessage = userMessage;
    try {
      const inputResult = await runGuardrails('input', guardInput, inputGuardrails, agentName);
      if (inputResult.blocked) {
        sseWrite('error', { code: 'GUARDRAIL_BLOCK', message: 'Request could not be completed' });
        return;
      }
      guardedMessage = inputResult.mutatedInput.userMessage ?? guardedMessage;
    } catch {
      // Fail-closed: unexpected throw from engine
      sseWrite('error', { code: 'GUARDRAIL_BLOCK', message: 'Request could not be completed' });
      return;
    }

    // Record the SANITIZED user turn (Z2: guardrail-on-capture). The 50-turn
    // sliding window in Session.recordTurn keeps recentTurns bounded.
    session.recordTurn({ role: 'user', content: guardedMessage });

    // ── Tool guardrail setup ────────────────────────────────────────────────
    const toolGuardrails = this.registry.getGuardrailsByStage('tool');
    let guardrailHalted = false;
    const isHalted = () => guardrailHalted;
    const setHalted = () => { guardrailHalted = true; };

    // #105: resolve run options through RunConfig so every call site is consistent.
    // #104/#108: wire default handoff filter and onHandoff callback.
    const resolvedRunConfig = buildRunConfig(runConfig ?? {});
    const { onHandoff: onHandoffCallback } = resolvedRunConfig;
    // Track the handoff turn count for the onHandoff callback (#108).
    let handoffTurnCount = 0;

    // Build tools list + agent tree (with recursively-resolved handoffs).
    // Per-turn cache: MUST be a fresh Map so closures bind to this turn's
    // session / sseWrite / abortCtrl (Nibbler N1/N2, #1073).
    //
    // #1070 D5: `buildAgentInstance` also wires `core.read_skill` into every
    // agent it constructs (scoped via `agentName`/`session` captured in the
    // tool factory) so handoff targets get the same pull-based skill access.
    const agentBuildCache = new Map<string, Agent<any, any>>();
    const buildCtx = {
      session,
      sseWrite,
      abortCtrl,
      toolGuardrails,
      isHalted,
      setHalted,
      // #104: thread handoff input filter into every handoff() call in the agent tree.
      handoffInputFilter: resolvedRunConfig.handoffInputFilter,
    };
    const agent = this.buildAgentInstance(agentName, agentBuildCache, buildCtx);
    const modelName = resolveModelName(agentContrib.model);

    let fullText = '';
    // Buffer all text chunks — output guardrails must pass before any chunk is sent to the client.
    const chunkBuffer: string[] = [];

    // Debug telemetry — track tool calls for the `end` event.
    const toolsExecuted: Array<{ name: string; status: 'ok' | 'error' }> = [];
    const pendingToolNames = new Map<string, number>(); // toolName → index in toolsExecuted
    const pendingWriteFileArgs = new Map<string, { path: string; content: string }>(); // write_file args stash
    // #103: track pending tool_call rawItems by callId so we can pair them with tool_output.
    const pendingToolCallItemsByCallId = new Map<string, AgentInputItem>(); // callId → function_call item
    // #1070 D12 — skillsExecuted is now sourced from session.skillsPulled
    // (ids the model actually pulled via core.read_skill), not the naive
    // registry catalog. Empty if the model never called the tool this turn.
    const getSkillsExecuted = (): string[] => Array.from(session.skillsPulled ?? []);

    try {
      const sdkRunner = getSdkRunner();

      // #102: Guard against open circuit breaker before attempting the SDK call.
      if (runnerCircuitBreaker.isOpen) {
        throw new CircuitOpenError();
      }

      // #1062 Layer 0: thread conversation history across turns (unconditional
      // since #1098 rollout). `session.recentTurns` already contains the
      // sanitized current user turn (appended after input guardrails above);
      // passing the whole history as `AgentInputItem[]` gives the model full
      // context of the conversation.
      // #103: also include tool call/result items from prior turns.
      const runInput: AgentInputItem[] = toAgentInputItems(session.recentTurns, session.toolCallItems);

      // #102: withRetry wraps the sdkRunner.run() call so transient 429/500/503
      // errors are retried with exponential backoff + jitter. 4xx codes outside
      // the list (401, 403, 400) fail immediately without retrying.
      const result = await withRetry(
        () => sdkRunner.run(agent, runInput, {
          stream: true,
          context: session,
          signal: abortCtrl.signal,
          // #1073 Zapp Z2: explicit circuit-breaker so mutual handoffs can't
          // ping-pong until token exhaustion. See resolveMaxTurns().
          maxTurns: resolvedRunConfig.maxTurns ?? resolveMaxTurns(),
          // #103: trim large tool results before they reach the model.
          callModelInputFilter,
        }),
        {
          retryOn: [429, 500, 503],
          maxAttempts: 3,
          backoff: 'exponential',
          jitter: true,
          onRetry: (attempt, err) => {
            console.warn('[runner] Retrying sdkRunner.run()', { attempt, err: err instanceof Error ? err.message : String(err) });
          },
        },
      );

      for await (const event of result) {
        // Drain a2uiEmissions immediately on every event (Leela C2)
        const a2uiMessages = session.drainA2UIEmissions();
        for (const msg of a2uiMessages) {
          sseWrite('a2ui', msg);
        }

        if (event.type === 'raw_model_stream_event') {
          const data = event.data;
          if (data.type === 'output_text_delta') {
            const delta = (data as { delta: string }).delta;
            fullText += delta;
            // Buffer instead of writing live — output guardrails run after the
            // full stream, so no chunk leaves the server until they pass.
            chunkBuffer.push(delta);
          }
        } else if (event.type === 'run_item_stream_event') {
          const { name, item } = event;
          if (name === 'tool_called') {
            const toolName = (item as { rawItem?: { name?: string } }).rawItem?.name ?? 'unknown';
            sseWrite('tool_start', { toolName });
            // Record a pending entry; will be updated to 'ok' on tool_output.
            const idx = toolsExecuted.push({ name: toolName, status: 'ok' }) - 1;
            pendingToolNames.set(toolName, idx);

            // #103: stash the function_call rawItem by callId for later pairing.
            const callRawItem = (item as { rawItem?: AgentInputItem }).rawItem;
            const callId = callRawItem ? (callRawItem as { callId?: string }).callId : undefined;
            if (callRawItem && callId) {
              pendingToolCallItemsByCallId.set(callId, callRawItem);
            }

            // Stash write_file arguments so tool_done can forward path+content to the client.
            if (toolName === 'core.write_file') {
              const rawArgs = (item as { rawItem?: { arguments?: string } }).rawItem?.arguments;
              if (typeof rawArgs === 'string') {
                try {
                  const parsed = JSON.parse(rawArgs) as { path?: string; content?: string };
                  if (parsed.path && typeof parsed.content === 'string') {
                    pendingWriteFileArgs.set(toolName, { path: parsed.path, content: parsed.content });
                  }
                } catch { /* malformed arguments — skip */ }
              }
            }
          } else if (name === 'tool_output') {
            const toolName = (item as { rawItem?: { name?: string } }).rawItem?.name ?? 'unknown';

            // #103: pair the result item with its pending call item and persist to session.
            const resultRawItem = (item as { rawItem?: AgentInputItem }).rawItem;
            const resultCallId = resultRawItem ? (resultRawItem as { callId?: string }).callId : undefined;
            if (resultRawItem && resultCallId) {
              const callItem = pendingToolCallItemsByCallId.get(resultCallId);
              if (callItem) {
                session.recordToolCallRecord({ callItem, resultItem: resultRawItem });
                pendingToolCallItemsByCallId.delete(resultCallId);
              }
            }

            // For write_file, forward path + content so the client can route files to the editor pane.
            const writeFileArgs = pendingWriteFileArgs.get(toolName);
            if (writeFileArgs) {
              sseWrite('tool_done', { toolName, path: writeFileArgs.path, content: writeFileArgs.content });
              pendingWriteFileArgs.delete(toolName);
            } else {
              sseWrite('tool_done', { toolName });
            }
            // Mark the matching pending entry as ok (already defaulted to 'ok').
            pendingToolNames.delete(toolName);
          } else if (name === 'handoff_occurred') {
            const newAgentName = (item as { agent?: { name?: string } }).agent?.name;
            if (newAgentName) {
              // #108: fire onHandoff callback before updating session.activeAgent
              // so `from` still reflects the handing-off agent.
              handoffTurnCount += 1;
              if (onHandoffCallback) {
                try {
                  await onHandoffCallback(session.activeAgent, newAgentName, {
                    turn: handoffTurnCount,
                    sessionId: session.sessionId,
                  });
                } catch (cbErr) {
                  // Never let a callback error abort the run — log and continue.
                  console.warn('[runner] onHandoff callback threw:', cbErr);
                }
              }
              session.activeAgent = newAgentName;
              sseWrite('phase', { agent: newAgentName });
            }
          }
        } else if (event.type === 'agent_updated_stream_event') {
          const newAgentName = event.agent?.name;
          if (newAgentName && newAgentName !== agentName) {
            session.activeAgent = newAgentName;
            sseWrite('phase', { agent: newAgentName });
          }
        }
      }

      // Final a2ui drain after stream ends
      const finalA2ui = session.drainA2UIEmissions();
      for (const msg of finalA2ui) {
        sseWrite('a2ui', msg);
      }

      // Extract intent and prose message from structured final output.
      // AgentOutput forces the model to emit JSON tokens as the raw stream text, so
      // fullText is the JSON-encoded object (e.g. '{"message":"...","intent":"continue"}').
      // resolveOutputText() pulls finalOutput.message so clean prose reaches the client
      // and prevents the double-encoded JSON from reaching useStreaming.ts (#937).
      let intent: string | undefined;
      let outputText = fullText;
      try {
        const finalOutput = await result.finalOutput;
        if (finalOutput && typeof finalOutput === 'object') {
          if ('intent' in finalOutput) {
            intent = (finalOutput as { intent?: string }).intent;
            if (intent) {
              session.intent = { summary: intent };
            }
          }
        }
        outputText = resolveOutputText(finalOutput, fullText);
      } catch { /* finalOutput not available when interrupted */ }

      // ── Output guardrail hook (runs BEFORE any chunk is sent to the client) ─
      if (!guardrailHalted) {
        const outputGuardrails = this.registry.getGuardrailsByStage('output');
        const outGuardInput = { stage: 'output' as const, proposedOutput: outputText };
        try {
          const outResult = await runGuardrails('output', outGuardInput, outputGuardrails, agentName);
          if (outResult.blocked) {
            sseWrite('error', { code: 'GUARDRAIL_BLOCK', message: 'Request could not be completed' });
            return;
          }
          outputText = outResult.mutatedInput.proposedOutput ?? outputText;
        } catch {
          sseWrite('error', { code: 'GUARDRAIL_BLOCK', message: 'Request could not be completed' });
          return;
        }
      }

      // Record assistant turn AFTER guardrails — persist only the guardrail-approved
      // (possibly redacted) output, never raw LLM content that may contain PII/credentials.
      if (outputText) {
        session.recordTurn({ role: 'assistant', content: outputText });
      }

      // ── Flush buffered chunks now that output guardrails have passed ────────
      if (chunkBuffer.length > 0) {
        if (outputText !== fullText) {
          // Output was redacted — send the redacted version as a single chunk
          sseWrite('chunk', { delta: outputText });
        } else {
          // No redaction — replay original buffered chunks preserving granularity
          for (const delta of chunkBuffer) {
            sseWrite('chunk', { delta });
          }
        }
      }

      // ── Deterministic codesmith→reviewer chain (#119) ─────────────────────
      // When codesmith completes a generation turn, automatically run the
      // reviewer as a deterministic gate instead of relying on the model to
      // call the voluntary handoff. The reviewer receives both the codesmith
      // output and the gate prompt so it evaluates the actual generated content.
      if (agentName === 'core.codesmith' && !guardrailHalted) {
        const reviewerGatePrompt =
          'Review the generated files in the workspace. ' +
          'Respond with APPROVED or REJECTED: <reason>.';
        // Pass codesmith output into reviewer input (mirrors runWithGate logic)
        // so the reviewer evaluates the actual generated content, not just
        // the static gate prompt in isolation.
        const reviewInput = outputText
          ? `${outputText}\n\n${reviewerGatePrompt}`
          : reviewerGatePrompt;
        sseWrite('chain_step', { step: 1, agentName: 'core.reviewer' });
        const reviewerResult = await this.runStep(
          'core.reviewer',
          reviewInput,
          session,
          sseWrite,
          signal,
        );
        if (!reviewerResult.aborted) {
          const verdict = parseGateVerdict(reviewerResult.output);
          if (!verdict.approved) {
            sseWrite('error', {
              code: 'CHAIN_REJECTED',
              message: verdict.feedback ?? 'Reviewer rejected the generated output.',
            });
          }
        }
      }

      sseWrite('end', {
        sessionId: session.sessionId,
        intent,
        model: modelName,
        agentName,
        skillsExecuted: getSkillsExecuted(),
        skillsPulledBytes: session.skillsPulledBytes ?? 0,
        skillsPulledTokens: session.skillsPulledTokens ?? 0,
        toolsExecuted,
      });
      // #102: successful run — reset circuit breaker consecutive-failure counter.
      runnerCircuitBreaker.recordSuccess();
    } catch (err: unknown) {
      // AbortError: may be a UserAction interrupt OR a guardrail halt
      if (err instanceof Error && err.name === 'AbortError') {
        if (guardrailHalted) {
          // Already emitted GUARDRAIL_BLOCK error in the tool wrapper
          return;
        }
        // UserAction interrupt — user_action_req was already written by the tool wrapper.
        return;
      }
      // #102: record failure against circuit breaker. AbortError and guardrail
      // halts are intentional — don't count them as infrastructure failures.
      runnerCircuitBreaker.recordFailure();
      sseWrite('error', {
        message: sanitizeError(err),
      });
      // Emit `end` even on hard failure so the Debug panel can surface
      // agentName and model. skillsExecuted/toolsExecuted may be partial.
      sseWrite('end', {
        sessionId: session.sessionId,
        intent: undefined,
        model: modelName,
        agentName,
        skillsExecuted: getSkillsExecuted(),
        skillsPulledBytes: session.skillsPulledBytes ?? 0,
        skillsPulledTokens: session.skillsPulledTokens ?? 0,
        toolsExecuted,
      });
    }
    } finally {
      // Zapp M1 — unconditional per-turn reset. Guarantees counters do not
      // bleed across turns regardless of exit path (success, AbortError,
      // guardrail halt, unexpected throw, early return via `return` inside
      // the SDK loop — all are covered because the SDK stream is awaited
      // inside the inner try above).
      session.skillsPulled = new Set<string>();
      session.skillsPulledBytes = 0;
      session.skillsPulledTokens = 0;
    }
  }

  async resume(
    session: Session,
    actionResult: unknown,
    sseWrite: SSEWriter,
  ): Promise<void> {
    const pending = session.pendingUserAction;
    if (!pending) {
      sseWrite('error', { message: 'No pending UserAction on this session.' });
      return;
    }

    // Clear pending state
    session.pendingUserAction = null;

    // Build a synthetic continuation message injecting the action result
    const resultSummary = typeof actionResult === 'object' && actionResult !== null
      ? JSON.stringify(actionResult)
      : String(actionResult);

    const continuationMessage =
      `[UserAction ${pending.name} result]: ${resultSummary}`;

    // Continue the conversation with the result
    await this.run(session, continuationMessage, sseWrite);
  }

  // ---------------------------------------------------------------------------
  // runStep — shared inner primitive for runChain / runWithGate (#119)
  // ---------------------------------------------------------------------------

  /**
   * Run a single agent step within a deterministic chain.
   *
   * Unlike `run()`, this method:
   * - Does NOT emit `start` / `end` SSE events (caller owns those).
   * - Does NOT run input guardrails (chain inputs are harness-generated,
   *   not raw user input).
   * - DOES run output guardrails before emitting chunks.
   * - Records the input as a user turn and the output as an assistant turn.
   * - Emits `chunk`, `tool_start`, `tool_done`, `a2ui`, and `phase` SSE events
   *   so the client sees full streaming output for each chain step.
   *
   * Exported as `public` for testability; treat as an internal primitive.
   */
  async runStep(
    agentName: string,
    input: string,
    session: Session,
    sseWrite: SSEWriter,
    signal?: AbortSignal,
  ): Promise<{ output: string; aborted: boolean; abortReason?: string }> {
    let agentContrib: AgentContribution;
    try {
      agentContrib = this.registry.getAgent(agentName);
    } catch {
      return { output: '', aborted: true, abortReason: `Unknown agent: ${agentName}` };
    }

    // Update active agent so session state is consistent
    const savedAgent = session.activeAgent;
    session.activeAgent = agentName;

    // Record input as user turn so the agent has conversation context
    if (input) {
      session.recordTurn({ role: 'user', content: input });
    }

    const abortCtrl = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => abortCtrl.abort(signal.reason), { once: true });
    }

    const toolGuardrails = this.registry.getGuardrailsByStage('tool');
    let guardrailHalted = false;
    const isHalted = () => guardrailHalted;
    const setHalted = () => { guardrailHalted = true; };

    const agentBuildCache = new Map<string, Agent<any, any>>();
    const buildCtx = { session, sseWrite, abortCtrl, toolGuardrails, isHalted, setHalted };
    const agent = this.buildAgentInstance(agentName, agentBuildCache, buildCtx);
    const modelName = resolveModelName(agentContrib.model);

    let fullText = '';
    const chunkBuffer: string[] = [];

    try {
      const sdkRunner = getSdkRunner();
      const runInput: AgentInputItem[] = toAgentInputItems(session.recentTurns);

      const result = await sdkRunner.run(agent, runInput, {
        stream: true,
        context: session,
        signal: abortCtrl.signal,
        maxTurns: resolveMaxTurns(),
      });

      for await (const event of result) {
        const a2uiMessages = session.drainA2UIEmissions();
        for (const msg of a2uiMessages) {
          sseWrite('a2ui', msg);
        }

        if (event.type === 'raw_model_stream_event') {
          const data = event.data;
          if (data.type === 'output_text_delta') {
            const delta = (data as { delta: string }).delta;
            fullText += delta;
            chunkBuffer.push(delta);
          }
        } else if (event.type === 'run_item_stream_event') {
          const { name, item } = event;
          if (name === 'tool_called') {
            const toolName = (item as { rawItem?: { name?: string } }).rawItem?.name ?? 'unknown';
            sseWrite('tool_start', { toolName });
          } else if (name === 'tool_output') {
            const toolName = (item as { rawItem?: { name?: string } }).rawItem?.name ?? 'unknown';
            sseWrite('tool_done', { toolName });
          } else if (name === 'handoff_occurred') {
            const newAgentName = (item as { agent?: { name?: string } }).agent?.name;
            if (newAgentName) {
              session.activeAgent = newAgentName;
              sseWrite('phase', { agent: newAgentName });
            }
          }
        } else if (event.type === 'agent_updated_stream_event') {
          const newAgentName = event.agent?.name;
          if (newAgentName && newAgentName !== agentName) {
            session.activeAgent = newAgentName;
            sseWrite('phase', { agent: newAgentName });
          }
        }
      }

      // Final a2ui drain
      for (const msg of session.drainA2UIEmissions()) {
        sseWrite('a2ui', msg);
      }

      let outputText = fullText;
      try {
        const finalOutput = await result.finalOutput;
        outputText = resolveOutputText(finalOutput, fullText);
      } catch { /* not available when interrupted */ }

      // Output guardrails
      if (!guardrailHalted) {
        const outputGuardrails = this.registry.getGuardrailsByStage('output');
        const outGuardInput = { stage: 'output' as const, proposedOutput: outputText };
        try {
          const outResult = await runGuardrails('output', outGuardInput, outputGuardrails, agentName);
          if (outResult.blocked) {
            sseWrite('error', GUARDRAIL_BLOCK_EVENT);
            session.activeAgent = savedAgent;
            return { output: '', aborted: true, abortReason: 'Guardrail blocked step output' };
          }
          outputText = outResult.mutatedInput.proposedOutput ?? outputText;
        } catch {
          sseWrite('error', GUARDRAIL_BLOCK_EVENT);
          session.activeAgent = savedAgent;
          return { output: '', aborted: true, abortReason: 'Guardrail error on step output' };
        }
      }

      // Record assistant turn
      if (outputText) {
        session.recordTurn({ role: 'assistant', content: outputText });
      }

      // Flush buffered chunks
      if (chunkBuffer.length > 0) {
        if (outputText !== fullText) {
          sseWrite('chunk', { delta: outputText });
        } else {
          for (const delta of chunkBuffer) {
            sseWrite('chunk', { delta });
          }
        }
      }

      return { output: outputText, aborted: false };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (guardrailHalted) {
          return { output: '', aborted: true, abortReason: 'Guardrail halted step' };
        }
        return { output: '', aborted: true, abortReason: 'Step aborted' };
      }
      const msg = err instanceof Error ? err.message : String(err);
      sseWrite('error', { message: msg });
      return { output: '', aborted: true, abortReason: msg };
    } finally {
      // Restore active agent to what it was before the step if we haven't
      // already updated it via a handoff event inside the step.
      // (Only restore when still pointing at this step's agent — handoff
      // events update session.activeAgent to the handoff target, which
      // we want to preserve.)
      if (session.activeAgent === agentName) {
        session.activeAgent = savedAgent;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // runChain — deterministic N-step sequential execution (#119)
  // ---------------------------------------------------------------------------

  /**
   * Run a deterministic chain of agent steps in order.
   *
   * - Output from step N becomes the implicit input to step N+1 unless an
   *   explicit `input` is provided on the step.
   * - Emits `chain_step` SSE event before each step (step index is 0-based).
   * - Aborts and returns early if any step is aborted or returns empty output.
   * - Throws `ChainDepthExceeded` when the number of steps exceeds
   *   `CHAIN_MAX_STEPS` (security circuit-breaker).
   */
  async runChain(
    steps: ChainStep[],
    session: Session,
    sseWrite: SSEWriter,
    signal?: AbortSignal,
  ): Promise<ChainResult> {
    if (steps.length > CHAIN_MAX_STEPS) {
      throw new ChainDepthExceeded(CHAIN_MAX_STEPS);
    }

    const results: ChainResult['steps'] = [];
    let previousOutput = '';

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!;
      const input = step.input !== undefined ? step.input : previousOutput;
      sseWrite('chain_step', { step: i, agentName: step.agentName });

      const stepResult = await this.runStep(step.agentName, input, session, sseWrite, signal);
      results.push({ agentName: step.agentName, output: stepResult.output });

      if (stepResult.aborted) {
        return {
          steps: results,
          finalOutput: '',
          aborted: true,
          abortReason: stepResult.abortReason,
        };
      }

      previousOutput = stepResult.output;
    }

    return { steps: results, finalOutput: previousOutput, aborted: false };
  }

  // ---------------------------------------------------------------------------
  // runWithGate — gated two-step chain: generator → reviewer (#119)
  // ---------------------------------------------------------------------------

  /**
   * Run a gated chain: `generator` produces output, then `reviewer` evaluates
   * it.  The reviewer's verdict is parsed for an explicit `APPROVED` or
   * `REJECTED` keyword.  Ambiguous output is treated as a rejection
   * (conservative by design — see `parseGateVerdict()`).
   *
   * `reviewer.gatePrompt` is appended to the generator's output before being
   * passed as the reviewer's input so the reviewer always has both context and
   * explicit instructions.
   *
   * Returns:
   * - `aborted: false, finalOutput: generatorOutput` on approval.
   * - `aborted: true, abortReason: reviewerFeedback` on rejection.
   */
  async runWithGate(
    generator: ChainStep,
    reviewer: ChainStep & { gatePrompt: string },
    session: Session,
    sseWrite: SSEWriter,
    signal?: AbortSignal,
  ): Promise<ChainResult> {
    // Step 0 — generator
    sseWrite('chain_step', { step: 0, agentName: generator.agentName });
    const genResult = await this.runStep(
      generator.agentName,
      generator.input ?? '',
      session,
      sseWrite,
      signal,
    );
    const genStep = { agentName: generator.agentName, output: genResult.output };

    if (genResult.aborted) {
      return { steps: [genStep], finalOutput: '', aborted: true, abortReason: genResult.abortReason };
    }

    // Step 1 — gated reviewer
    sseWrite('chain_step', { step: 1, agentName: reviewer.agentName });
    const reviewInput = genResult.output
      ? `${genResult.output}\n\n${reviewer.gatePrompt}`
      : reviewer.gatePrompt;
    const reviewResult = await this.runStep(
      reviewer.agentName,
      reviewInput,
      session,
      sseWrite,
      signal,
    );
    const reviewStep = { agentName: reviewer.agentName, output: reviewResult.output };

    if (reviewResult.aborted) {
      return {
        steps: [genStep, reviewStep],
        finalOutput: '',
        aborted: true,
        abortReason: reviewResult.abortReason,
      };
    }

    const verdict = parseGateVerdict(reviewResult.output);
    if (!verdict.approved) {
      return {
        steps: [genStep, reviewStep],
        finalOutput: '',
        aborted: true,
        abortReason: verdict.feedback,
      };
    }

    return { steps: [genStep, reviewStep], finalOutput: genResult.output, aborted: false };
  }
}
