/**
 * @module @kickstart/api/lib/agents-runner
 *
 * Main entry point for the @openai/agents SDK runtime adapter.
 *
 * Creates an `Agent` per turn (stateless config), runs it via the SDK `Runner`,
 * and returns an `AdaptedRunResponse` via the SSE adapter. Session persistence
 * goes through `KickstartSessionAdapter`.
 *
 * Feature flag: `KICKSTART_AGENTS_SDK=true` must be set for this path to be used.
 * When unset, `converse.ts` falls back to the existing direct-fetch path.
 *
 * Security conditions (Zapp):
 * - Tracing disabled globally (see agents-azure-provider.ts)
 * - No raw SDK run items forwarded to browser (see agents-sse-adapter.ts)
 * - Principal ownership checked before session is passed to the adapter
 * - TTL semantics preserved via KickstartSessionAdapter
 * - Approval-gated tools remain gated server-side (requireApproval check)
 * - Workspace/file emission path unchanged (#326 contract)
 */

import { Agent, Runner, tool } from "@openai/agents";
import {
  Phase,
  buildSystemPrompt,
  resolveSkills,
  resolveConversationSkills,
  defaultKitRegistry,
  defaultRegistry,
  InMemoryArtifactStore,
} from "@kickstart/core";
import type { ToolContext, ConversationSkillsContext } from "@kickstart/core";
import { createAzureModelProvider, getAgentsDeployment, getAgentsGenerateDeployment } from "./agents-azure-provider.js";
import { KickstartSessionAdapter } from "./agents-session-adapter.js";
import { adaptRunResult, adaptedUsageToChatUsage } from "./agents-sse-adapter.js";
import type { AdaptedRunResponse } from "./agents-sse-adapter.js";
import { planRoute, applyRoutePlan, toSafePhase } from "./agents-route-planner.js";
import type { ApiSession } from "./session-store.js";
import { recordUsage, extractArtifactsFromA2UI, upsertArtifact } from "./session-store.js";
import { sanitizeToolOutput } from "./sanitize-tool-output.js";
import { buildTurnUsage } from "./usage-tracking.js";

/** Return true if the agents SDK feature flag is enabled. */
export function isAgentsSdkEnabled(): boolean {
  return process.env.KICKSTART_AGENTS_SDK === "true";
}

// ---------------------------------------------------------------------------
// Tool bridge: IntegrationKit tools → SDK FunctionTool
// ---------------------------------------------------------------------------

/**
 * Build SDK `FunctionTool[]` from the existing tool registry.
 * Approval-gated tools are included but their executor enforces the gate
 * server-side (returns an error result rather than executing).
 */
function buildSdkTools(toolContext: ToolContext): import("@openai/agents").FunctionTool[] {
  const kitTools = defaultRegistry.toOpenAIFormat();
  return kitTools.map((def: { type: string; function: { name: string; description: string; parameters: unknown } }) => {
    const toolName = def.function.name;
    return tool({
      name: toolName,
      description: def.function.description,
      // JSON Schema from the registry — cast to any to satisfy the SDK union type
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parameters: def.function.parameters as any,
      strict: false,
      execute: async (rawInput: unknown) => {
        const registered = defaultRegistry.get(toolName);
        if (!registered) {
          return JSON.stringify({ error: `Unknown tool: ${toolName}` });
        }
        // Approval gate: never execute approval-gated tools without human sign-off
        if (registered.requireApproval) {
          return JSON.stringify({
            error: `Tool "${toolName}" requires user approval before execution.`,
            requiresApproval: true,
          });
        }
        try {
          const result = await registered.execute(
            rawInput as Record<string, unknown>,
            toolContext,
          );
          return sanitizeToolOutput(result);
        } catch (err) {
          return JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export interface AgentRunInput {
  userMessage: string;
  session: ApiSession;
}

export interface AgentRunOutput {
  adapted: AdaptedRunResponse;
  /** Phase after this turn (may have advanced). */
  currentPhase: Phase;
}

/**
 * Run a single conversation turn through the agents SDK.
 *
 * This is the non-streaming path. Returns a fully resolved `AgentRunOutput`.
 */
export async function runAgentTurn(input: AgentRunInput): Promise<AgentRunOutput> {
  const { userMessage, session } = input;
  const currentPhase = toSafePhase(session.state.currentPhase);

  // Build system prompt (same as existing converse.ts path)
  const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());
  const artifactSummary = buildArtifactSummary(session.generatedArtifacts);
  const systemPrompt = buildSystemPrompt({
    phase: currentPhase,
    appDefinition: session.state.appDefinition,
    kitPrompts: resolvedSkills.prompts,
    artifactSummary: artifactSummary || undefined,
  });

  // Per-turn domain skill injection (same as existing path)
  const skillsCtx: ConversationSkillsContext = {
    phase: currentPhase,
    appDefinition: session.state.appDefinition
      ? {
          runtime: (session.state.appDefinition as Record<string, unknown>).runtime as string | undefined,
          appType: (session.state.appDefinition as Record<string, unknown>).appType as string | undefined,
          name: (session.state.appDefinition as Record<string, unknown>).name as string | undefined,
          databaseType: (session.state.appDefinition as Record<string, unknown>).databaseType as string | undefined,
          needsIngress: (session.state.appDefinition as Record<string, unknown>).needsIngress as boolean | undefined,
          resourceTier: (session.state.appDefinition as Record<string, unknown>).resourceTier as string | undefined,
        }
      : undefined,
    filesGenerated: session.generatedArtifacts.map((a) => a.filename),
  };
  const { domainKnowledge, currentState } = resolveConversationSkills(
    userMessage,
    currentPhase,
    skillsCtx,
  );

  // Compose effective user message (domain knowledge + state snapshot)
  const effectiveMessage = buildEffectiveMessage(userMessage, domainKnowledge ?? undefined, currentState ?? "");

  // Deployment routing
  const provider = createAzureModelProvider();
  const chatDeployment = getAgentsDeployment();
  const generateDeployment = getAgentsGenerateDeployment();

  // Initial route — we don't have llmFlags yet; use advisory=false for planning
  // Phase advancement is applied after we have the response
  const preliminaryPlan = planRoute(
    session,
    { phaseComplete: false, filesComplete: null },
    { chat: chatDeployment, generate: generateDeployment },
  );

  // Build tools
  const toolContext: ToolContext = {
    artifactStore: new InMemoryArtifactStore(),
  };
  const sdkTools = buildSdkTools(toolContext);

  // Create agent for this turn
  const agent = new Agent({
    name: "kickstart-assistant",
    instructions: systemPrompt,
    model: preliminaryPlan.deployment,
    tools: sdkTools,
  });

  // Session adapter
  const sessionAdapter = new KickstartSessionAdapter(session);

  // Run the agent
  const runner = new Runner({ modelProvider: provider });
  const result = await runner.run(agent, effectiveMessage, {
    session: sessionAdapter,
  });

  // Adapt output — allowlist enforced here
  const adapted = adaptRunResult(result as Parameters<typeof adaptRunResult>[0]);

  // Apply advisory flags to route plan
  const finalPlan = planRoute(
    session,
    { phaseComplete: adapted.phaseComplete, filesComplete: adapted.filesComplete },
    { chat: chatDeployment, generate: generateDeployment },
  );

  // Track generated artifacts
  const newArtifacts = extractArtifactsFromA2UI(adapted.a2uiMessages);
  for (const art of newArtifacts) {
    upsertArtifact(session.generatedArtifacts, art);
  }

  // NOTE: do NOT call addMessage("assistant", ...) here.
  // KickstartSessionAdapter.addItems() is called by the SDK after run completion
  // and is the authoritative persistence path for SDK-generated assistant messages.
  // A manual call here would duplicate the write on every turn.

  // Apply route plan (phase advancement)
  applyRoutePlan(session, finalPlan);

  // Track usage
  const chatUsage = adaptedUsageToChatUsage(adapted.usage);
  const turnUsage = buildTurnUsage(finalPlan.deployment, chatUsage, {
    pricingGroup: finalPlan.pricingGroup,
  });
  if (turnUsage) {
    recordUsage(session.state.sessionId, turnUsage);
  }

  return {
    adapted,
    currentPhase: toSafePhase(session.state.currentPhase),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEffectiveMessage(
  userMessage: string,
  domainKnowledge: string | undefined,
  currentState: string,
): string {
  const parts: string[] = [];
  if (domainKnowledge) parts.push(domainKnowledge);
  parts.push(`${userMessage}\n\n${currentState}`);
  return parts.join("\n\n");
}

function buildArtifactSummary(artifacts: import("./session-store.js").GeneratedArtifact[]): string {
  if (artifacts.length === 0) return "";
  const lines: string[] = [
    "Files generated so far: " + artifacts.map((a) => a.filename).join(", "),
  ];
  const bicepResources = artifacts.flatMap((a) => a.bicepResources);
  if (bicepResources.length > 0) {
    lines.push("Azure resources declared: " + bicepResources.join(", "));
  }
  const k8sResources = artifacts.flatMap((a) => a.k8sResources);
  if (k8sResources.length > 0) {
    lines.push("Kubernetes resources declared: " + k8sResources.join(", "));
  }
  return lines.join("\n");
}
