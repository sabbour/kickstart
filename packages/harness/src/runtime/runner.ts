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
import { Agent, Runner as SDKRunner, tool, setDefaultModelProvider, OpenAIProvider } from '@openai/agents';
import type { FunctionTool } from '@openai/agents';
import type { AgentContribution, ModelRef } from '../types/agent.js';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';
import type { PackRegistry } from './registry.js';
import type { Session } from './session.js';
import type { SSEWriter } from './sse.js';
import { AgentOutput } from '../types/agent-output.js';
import { runGuardrails } from './guardrails.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

function resolveModelName(ref: ModelRef): string {
  if ('envVar' in ref) {
    const value = process.env[ref.envVar];
    if (!value) {
      throw new Error(
        `Agent model env var "${ref.envVar}" is not set. ` +
        `Check AZURE_OPENAI_CHAT_DEPLOYMENT or the agent's modelRef config.`,
      );
    }
    return value;
  }
  return ref.id;
}

// ---------------------------------------------------------------------------
// Build model provider (Azure-aware)
// ---------------------------------------------------------------------------

function buildModelProvider(): OpenAIProvider {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (endpoint && apiKey) {
    // Azure OpenAI — use Chat Completions API via baseURL
    const azureBaseUrl = endpoint.endsWith('/')
      ? `${endpoint}openai`
      : `${endpoint}/openai`;
    return new OpenAIProvider({
      apiKey,
      baseURL: azureBaseUrl,
      useResponses: false,
    });
  }

  // Standard OpenAI (dev/test) — reads OPENAI_API_KEY from env automatically
  return new OpenAIProvider({ useResponses: false });
}

// Lazily-initialised shared provider + SDK runner
let _sdkRunner: SDKRunner | null = null;

function getSdkRunner(): SDKRunner {
  if (!_sdkRunner) {
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
// Runner
// ---------------------------------------------------------------------------

export class Runner {
  constructor(private readonly registry: PackRegistry) {}

  async run(
    session: Session,
    userMessage: string,
    sseWrite: SSEWriter,
    signal?: AbortSignal,
  ): Promise<void> {
    sseWrite('start', { sessionId: session.sessionId });
    session.recordTurn({ role: 'user', content: userMessage });

    const agentName = session.activeAgent;
    let agentContrib: AgentContribution;
    try {
      agentContrib = this.registry.getAgent(agentName);
    } catch (err) {
      sseWrite('error', { message: `Unknown agent: ${agentName}` });
      return;
    }

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

    // ── Tool guardrail setup ────────────────────────────────────────────────
    const toolGuardrails = this.registry.getGuardrailsByStage('tool');
    let guardrailHalted = false;
    const isHalted = () => guardrailHalted;
    const setHalted = () => { guardrailHalted = true; };

    // Build tools list
    const toolContribs = this.registry.getToolsForAgent(agentName);
    const tools = toolContribs.map((contrib) => {
      if ('wireName' in contrib) {
        // UserActionContribution
        return wrapUserAction(
          contrib as UserActionContribution,
          session,
          sseWrite,
          abortCtrl,
          this.registry,
        );
      }
      return wrapTool(
        contrib as ToolContribution,
        toolGuardrails,
        agentName,
        sseWrite,
        abortCtrl,
        isHalted,
        setHalted,
      );
    });

    // Build dynamic instructions: base + skills stub + catalog hint
    const skills = this.registry.getSkillsForAgent(agentName);
    const skillsBlock = skills.length > 0
      ? `\n\n## Available Skills\n${skills.map((s) => `- **${s.id}**: ${s.description}`).join('\n')}`
      : '';

    const components = this.registry.components;
    const catalogBlock = components.length > 0
      ? `\n\n## A2UI Component Catalog (${components.length} components available)\n${components.map((c) => c.name).join(', ')}`
      : '';

    const instructions = agentContrib.instructionsBase + skillsBlock + catalogBlock;

    // Build the @openai/agents Agent
    const modelName = resolveModelName(agentContrib.model);

    const agent = new Agent({
      name: agentContrib.name,
      instructions,
      tools,
      model: modelName,
      outputType: AgentOutput,
    });

    let fullText = '';
    // Buffer all text chunks — output guardrails must pass before any chunk is sent to the client.
    const chunkBuffer: string[] = [];

    try {
      const sdkRunner = getSdkRunner();
      const result = await sdkRunner.run(agent, guardedMessage, {
        stream: true,
        context: session,
        signal: abortCtrl.signal,
      });

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

      // Final a2ui drain after stream ends
      const finalA2ui = session.drainA2UIEmissions();
      for (const msg of finalA2ui) {
        sseWrite('a2ui', msg);
      }

      // Extract intent from final output if structured
      let intent: string | undefined;
      let outputText = fullText;
      try {
        const finalOutput = await result.finalOutput;
        if (finalOutput && typeof finalOutput === 'object' && 'intent' in finalOutput) {
          intent = (finalOutput as { intent?: string }).intent;
          if (intent) {
            session.intent = { summary: intent };
          }
        }
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

      sseWrite('end', {
        sessionId: session.sessionId,
        intent,
      });
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
      sseWrite('error', {
        message: err instanceof Error ? err.message : String(err),
      });
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
}
