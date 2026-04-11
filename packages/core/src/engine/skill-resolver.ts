/**
 * @module @kickstart/core/engine/skill-resolver
 *
 * Skill resolver middleware — injects relevant IntegrationKit knowledge into
 * the system prompt based on the current conversation phase.
 *
 * Layer 1 of the Three-Layer Prompt Architecture: Azure Skills (domain
 * knowledge loaded per-phase from registered IntegrationKits).
 *
 * Phase → knowledge mapping:
 *   Discover  — tool descriptions so the LLM knows what it can query
 *   Design    — architecture and recommendation knowledge
 *   Generate  — code generation templates and file-generation rules
 *   Review / Handoff / Deploy — deployment validation and safeguard knowledge
 *
 * Usage:
 *   const skills = resolveSkills(Phase.Design, defaultKitRegistry.getAll());
 *   const prompt = buildSystemPrompt({ phase, kitPrompts: skills.prompts });
 */

import { Phase } from "./types.js";
import type { Skill, SkillResolverContext } from "./types.js";
import type { IntegrationKit } from "../kits/types.js";

// ---------------------------------------------------------------------------
// Phase groups — used to filter general prompts to relevant phases
// ---------------------------------------------------------------------------

/** Phases where tool-discovery prompts are relevant. */
const DISCOVERY_PHASES = new Set<Phase>([Phase.Discover]);

/** Phases where architecture/recommendation prompts are relevant. */
const DESIGN_PHASES = new Set<Phase>([Phase.Discover, Phase.Design]);

/** Phases where code-generation prompts are relevant. */
const _GENERATE_PHASES = new Set<Phase>([Phase.Generate]);

/** Phases where deployment/validation prompts are relevant. */
const _DEPLOYMENT_PHASES = new Set<Phase>([
  Phase.Review,
  Phase.Handoff,
  Phase.Deploy,
]);

// ---------------------------------------------------------------------------
// Keyword classifiers — used to route flat prompts to phases when
// a kit does not declare explicit phasePrompts
// ---------------------------------------------------------------------------

const DISCOVER_KEYWORDS = [
  "discover", "detect", "list", "find", "existing", "query", "inspect",
  "what language", "what runtime", "repo_info", "resource_list",
];

const DESIGN_KEYWORDS = [
  "architecture", "recommend", "prefer", "design", "database", "service",
  "plan", "default", "unless", "aks automatic", "managed",
];

const GENERATE_KEYWORDS = [
  "generat", "workflow", "dockerfile", "manifest", "artifact", "ci/cd",
  "pipeline", "template", "oidc", "credential",
];

const DEPLOYMENT_KEYWORDS = [
  "deploy", "safeguard", "validation", "cost", "estimate", "security",
  "review", "budget", "production", "push",
];

/**
 * Heuristically classify a prompt string to a set of phases.
 * A prompt may belong to multiple phases.
 */
function classifyPrompt(prompt: string): Set<Phase> {
  const lower = prompt.toLowerCase();
  const matched = new Set<Phase>();

  if (DISCOVER_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Discover);
  }
  if (DESIGN_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Design);
  }
  if (GENERATE_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Generate);
  }
  if (DEPLOYMENT_KEYWORDS.some((kw) => lower.includes(kw))) {
    matched.add(Phase.Review);
    matched.add(Phase.Handoff);
    matched.add(Phase.Deploy);
  }

  // If nothing matched, include for all phases (general knowledge)
  if (matched.size === 0) {
    for (const phase of Object.values(Phase)) {
      matched.add(phase);
    }
  }

  return matched;
}

// ---------------------------------------------------------------------------
// Middleware (#33)
// ---------------------------------------------------------------------------

/**
 * Async middleware function in the skill resolver chain.
 *
 * Each middleware receives the current phase, a mutable context, and a `next`
 * callback.  It may modify `context.activeSkillIds` to control which skills
 * are injected, then call `next()` to run the remaining chain.
 *
 * The signature is async from day one so that future middleware (e.g.
 * TokenBudgetMiddleware with tiktoken) can perform async work without a
 * breaking contract change.
 */
export type SkillResolverMiddleware = (
  phase: Phase,
  context: SkillResolverContext,
  next: () => Promise<ResolvedSkills>,
) => Promise<ResolvedSkills>;

/** All skills extracted from kits, organized for middleware consumption. */
function collectSkills(kits: IntegrationKit[]): Skill[] {
  const skills: Skill[] = [];
  for (const kit of kits) {
    if (kit.skills) {
      skills.push(...kit.skills);
    }
  }
  return skills;
}

/**
 * Phase-filter middleware — keeps only skills whose `phases` array includes
 * the current phase.
 */
const phaseFilterMiddleware: SkillResolverMiddleware = async (
  phase,
  context,
  next,
) => {
  const allSkills = collectSkills(context.kits);
  const phaseSkills = allSkills.filter((s) => s.phases.includes(phase));
  context.activeSkillIds = new Set(phaseSkills.map((s) => s.id));
  return next();
};

/**
 * Keyword-activation middleware — if conversation history is provided, scans
 * recent messages for skill keywords and activates matching skills.  When no
 * conversation history is available, all phase-eligible skills remain active
 * (safe default).
 *
 * Security note (Zapp): keyword activation only toggles predefined skill IDs.
 * No raw user text is injected into system prompts — only first-party skill
 * content from the `Skill.content` field.
 */
const keywordActivationMiddleware: SkillResolverMiddleware = async (
  _phase,
  context,
  next,
) => {
  const history = context.conversationHistory;
  if (!history || history.length === 0) {
    return next();
  }

  const combined = history.join(" ").toLowerCase();
  const allSkills = collectSkills(context.kits);

  for (const skill of allSkills) {
    if (context.activeSkillIds?.has(skill.id)) continue; // already active
    const match = skill.keywords.some((kw) => combined.includes(kw.toLowerCase()));
    if (match) {
      context.activeSkillIds ??= new Set();
      context.activeSkillIds.add(skill.id);
    }
  }

  return next();
};

/**
 * Priority-order middleware — sorts the final resolved prompts so that
 * higher-priority skills appear first in the system prompt.
 */
const priorityOrderMiddleware: SkillResolverMiddleware = async (
  _phase,
  context,
  next,
) => {
  const result = await next();

  const allSkills = collectSkills(context.kits);
  const activeIds = context.activeSkillIds ?? new Set<string>();

  const activeSkills = allSkills
    .filter((s) => activeIds.has(s.id))
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Prepend skill content before legacy prompts (skills are higher-signal)
  const skillPrompts = activeSkills.map((s) => s.content);
  result.prompts = [...skillPrompts, ...result.prompts];

  return result;
};

/** Default middleware stack. */
const DEFAULT_MIDDLEWARE: SkillResolverMiddleware[] = [
  phaseFilterMiddleware,
  keywordActivationMiddleware,
  priorityOrderMiddleware,
];

/** Custom middleware registered via `registerSkillMiddleware`. */
const customMiddleware: SkillResolverMiddleware[] = [];

/**
 * Register a custom middleware that will be appended to the default stack.
 *
 * Security: only first-party code should call this.  Do not expose to
 * user input or runtime plugin registration.
 */
export function registerSkillMiddleware(
  middleware: SkillResolverMiddleware,
): void {
  customMiddleware.push(middleware);
}

/**
 * Build a middleware chain and execute it, returning resolved skills.
 */
async function runMiddlewareChain(
  phase: Phase,
  context: SkillResolverContext,
  baseFn: () => Promise<ResolvedSkills>,
): Promise<ResolvedSkills> {
  const stack = [...DEFAULT_MIDDLEWARE, ...customMiddleware];

  let idx = 0;
  const runNext = async (): Promise<ResolvedSkills> => {
    if (idx < stack.length) {
      const mw = stack[idx++];
      return mw(phase, context, runNext);
    }
    return baseFn();
  };

  return runNext();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Output of the skill resolver for a given phase. */
export interface ResolvedSkills {
  /** Ordered list of prompt strings to inject into the system prompt. */
  prompts: string[];
  /** Names of tools available in this phase (for transparency/logging). */
  availableTools: string[];
}

/**
 * Resolve all relevant skill prompts for the current phase from a set of
 * registered IntegrationKits.
 *
 * Resolution order (highest priority first):
 *   1. `kit.skills` — typed Skill objects filtered by phase + keywords
 *   2. `kit.phasePrompts[phase]` — explicit per-phase augmentations
 *   3. `kit.prompts` filtered by keyword heuristics — backward compat
 *
 * Additionally, for the Discover phase, a synthetic tool-listing prompt is
 * prepended so the LLM knows which tools it can call.
 *
 * This synchronous facade applies skill resolution inline (phase filter +
 * keyword activation + priority sort).  For the full async middleware chain
 * (including custom middleware), use `resolveSkillsAsync`.
 */
export function resolveSkills(
  phase: Phase,
  kits: IntegrationKit[],
  conversationHistory?: string[],
): ResolvedSkills {
  const legacy = resolveLegacySkills(phase, kits);

  // Inline skill resolution: phase filter → keyword activation → priority sort
  const allSkills = collectSkills(kits);
  const activeSkills = allSkills.filter((s) => s.phases.includes(phase));

  // Keyword activation from conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    const combined = conversationHistory.join(" ").toLowerCase();
    for (const skill of allSkills) {
      if (activeSkills.some((a) => a.id === skill.id)) continue;
      if (skill.keywords.some((kw) => combined.includes(kw.toLowerCase()))) {
        activeSkills.push(skill);
      }
    }
  }

  // Sort by priority (higher first)
  activeSkills.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Prepend skill content before legacy prompts
  const skillPrompts = activeSkills.map((s) => s.content);
  legacy.prompts = [...skillPrompts, ...legacy.prompts];

  return legacy;
}

/**
 * Async version of resolveSkills for callers that can await.
 * Runs the full middleware chain including any async custom middleware.
 */
export async function resolveSkillsAsync(
  phase: Phase,
  kits: IntegrationKit[],
  conversationHistory?: string[],
): Promise<ResolvedSkills> {
  const context: SkillResolverContext = {
    kits,
    conversationHistory,
    activeSkillIds: new Set(),
  };

  const baseFn = async (): Promise<ResolvedSkills> =>
    resolveLegacySkills(phase, kits);

  return runMiddlewareChain(phase, context, baseFn);
}

/**
 * Resolve skills directly from a flat list of Skill objects.
 * Useful for testing and tooling without constructing full IntegrationKits.
 */
export function resolveSkillsFromList(
  phase: Phase,
  skills: Skill[],
  conversationHistory?: string[],
): ResolvedSkills {
  const pseudoKit: IntegrationKit = {
    name: "__direct",
    description: "Direct skill resolution",
    tools: [],
    connectors: [],
    skills,
  };
  return resolveSkills(phase, [pseudoKit], conversationHistory);
}

/**
 * Legacy resolution logic — resolves prompts from phasePrompts and flat
 * prompts arrays without the Skill type.
 */
function resolveLegacySkills(
  phase: Phase,
  kits: IntegrationKit[],
): ResolvedSkills {
  const prompts: string[] = [];
  const availableTools: string[] = [];

  // Synthetic tool-listing prompt for Discover phase
  if (phase === Phase.Discover || DESIGN_PHASES.has(phase)) {
    const toolsByKit: string[] = [];
    for (const kit of kits) {
      if (kit.tools.length > 0) {
        const names = kit.tools.map((t) => `\`${t.name}\``).join(", ");
        const descs = kit.tools
          .map((t) => `  - **${t.name}**: ${t.description}`)
          .join("\n");
        toolsByKit.push(`**${kit.name} kit** (${names}):\n${descs}`);
        availableTools.push(...kit.tools.map((t) => t.name));
      }
    }

    if (toolsByKit.length > 0 && DISCOVERY_PHASES.has(phase)) {
      prompts.push(
        `You have access to the following tools. Call them proactively to avoid asking the user for information you can discover yourself:\n\n${toolsByKit.join("\n\n")}`,
      );
    } else if (toolsByKit.length > 0) {
      for (const kit of kits) {
        availableTools.push(...kit.tools.map((t) => t.name));
      }
    }
  } else {
    for (const kit of kits) {
      availableTools.push(...kit.tools.map((t) => t.name));
    }
  }

  for (const kit of kits) {
    // Priority 1: explicit per-phase prompts
    const explicit = kit.phasePrompts?.[phase];
    if (explicit && explicit.length > 0) {
      prompts.push(...explicit);
      continue;
    }

    // Priority 2: heuristic filtering of flat prompts (backward compat)
    if (kit.prompts && kit.prompts.length > 0) {
      for (const p of kit.prompts) {
        const phases = classifyPrompt(p);
        if (phases.has(phase)) {
          prompts.push(p);
        }
      }
    }
  }

  return { prompts, availableTools };
}

/**
 * Format resolved skills into a "## Available Capabilities" markdown section
 * ready for appending to a system prompt.
 *
 * Returns an empty string if there are no prompts to inject.
 */
export function formatSkillsSection(skills: ResolvedSkills): string {
  if (skills.prompts.length === 0) return "";

  const items = skills.prompts.map((p) => p.trim()).join("\n\n");
  return `## Available Capabilities\n\n${items}`;
}
