---
sidebar_position: 4
---

# Skill Injection Deep-Dive

Two independent skill injection mechanisms run every turn. This page explains both side-by-side, their conflict zones, and how to extend each.

> **Sources:**
> - Mechanism A: `packages/core/src/engine/skill-resolver.ts`
> - Mechanism B: `packages/core/src/services/resolveConversationSkills.ts`
> - Wired in: `packages/web/api/src/functions/converse.ts`

## Side-by-Side Comparison

| | Mechanism A | Mechanism B |
|-|-------------|-------------|
| **File** | `engine/skill-resolver.ts` | `services/resolveConversationSkills.ts` |
| **Added** | Original codebase | PR #382 |
| **Fires** | Every turn | Every turn |
| **Selection trigger** | Current FSM phase | Keywords in user message |
| **Knowledge source** | Registered IntegrationKits | Hardcoded domain blocks |
| **Injection point** | System prompt — `## Available Capabilities` | User message turn, before real message |
| **Also injects** | — | `[Current session context]` appended to real message |
| **Extensible via** | New `IntegrationKit` TypeScript class | Edit `resolveConversationSkills.ts` |

## Why Two Mechanisms?

**Mechanism A** solves: the LLM needs to know what tools and capabilities are registered, and this varies by phase. This is permanent per-phase context — correct to put in the system prompt.

**Mechanism B** solves: when the user asks about Node.js, the LLM needs Node.js deployment knowledge *for this turn*, but always-on system prompt injection bloats every turn with all possible domain knowledge. Injecting as a user turn makes it one-shot — present now, not repeated in history. Design goal: save 500–1000 tokens per subsequent turn.

## Mechanism A — How It Works

```typescript
// converse.ts
const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());
const freshSystemPrompt = buildSystemPrompt({
  phase: currentPhase,
  kitPrompts: resolvedSkills.prompts,  // ← becomes ## Available Capabilities
  // ...
});
```

### Resolution Paths

`resolveSkills()` uses a **3-stage resolution** for each kit:

1. **Typed skill resolution first** — resolve `kit.skills[]` entries matching the current phase; apply keyword activation rules and priority sorting.
2. **Legacy prompt fallback** — if no typed skills, fall back to `kit.phasePrompts[phase]` (explicit per-phase), then flat `kit.prompts[]` classified by keyword groups.
3. **Phase-specific tool handling** — `resolveLegacySkills()` synthesizes a tool-listing prompt in **Discover** only; in Design it collects `availableTools` but does **not** inject that prompt.

This is backed by **two resolution paths** — a typed `Skill` object path and a legacy `prompts[]` path:

```typescript
// Path 1 — typed Skill objects (kit.skills[])
interface Skill {
  id: string;
  phases: Phase[];       // explicit phase assignment
  keywords?: string[];   // optional keyword boost
  content: string;       // text injected into system prompt
}

// Path 2 — legacy flat prompts (kit.prompts[] / kit.phasePrompts{})
// IntegrationKit (full interface — see packages/core/src/kits/types.ts)
interface IntegrationKit {
  name: string;
  description: string;
  tools: Tool<any>[];
  connectors: APIConnector[];
  prompts?: string[];                              // classified by keyword heuristic
  phasePrompts?: Partial<Record<Phase, string[]>>; // explicit per-phase prompts
  skills?: Skill[];                                // typed skill definitions (Path 1)
}
```

:::warning Typed `Skill` path is dormant
**Neither production kit (`azure-kit.ts`, `github-kit.ts`) uses `kit.skills[]`.** Both use `prompts[]` / `phasePrompts{}`. The typed path is exercised only in tests. In practice, 100% of runtime skill resolution goes through the legacy path. Anyone building an Agent SDK adapter who reads the interface and chooses the typed path will be using the non-production code path.
:::

### Public API

The only supported public entry point for Mechanism A is:

```typescript
resolveSkills(phase: Phase, kits: IntegrationKit[], conversationHistory?: string[]): ResolvedSkills
```

All other resolver functions (`resolveSkillsAsync`, `resolveSkillsFromList`, `formatSkillsSection`, `registerSkillMiddleware`) have been removed — they had zero non-test production callers and the entire resolver surface is being redesigned in the Agents SDK migration (#330).

### Keyword Classification (Legacy Path)

```typescript
const GENERATE_KEYWORDS = ["generat", "workflow", "dockerfile", "manifest", "artifact", "ci/cd", ...];
const DEPLOYMENT_KEYWORDS = ["deploy", "safeguard", "validation", "cost", "estimate", ...];
```

Each kit prompt string is lowercased and checked for substring membership. A match routes the prompt to the corresponding phase(s).

### Adding a New Skill via Mechanism A

1. Implement `IntegrationKit` (`packages/core/src/kits/types.ts`)
2. Add your prompts to `phasePrompts[Phase.X]` (preferred) or `prompts[]` (heuristic-classified)
3. Register: `defaultKitRegistry.register(myKit)`

No config files. TypeScript only.

## Mechanism B — How It Works

```typescript
// converse.ts ~line 278
const { domainKnowledge, currentState } = resolveConversationSkills(
  body.message,
  currentPhase,
  { phase: currentPhase, appDefinition: state.appDefinition, filesGenerated },
);
if (domainKnowledge) {
  messages.splice(messages.length - 1, 0, { role: "user", content: domainKnowledge });  // ↑ inserted immediately before the real user message
}
messages[last] = { ...messages[last], content: `${messages[last].content}\n\n${currentState}` };
```

### Domain Detection

```typescript
const DOMAIN_PATTERNS = [
  { domain: "stack-node",   patterns: [/\bnode(\.?js)?\b/i, /\btypescript\b/i, /\bexpress\b/i, ...] },
  { domain: "infra-docker", patterns: [/\bdocker(file)?\b/i, /\bcontainer\b/i, ...] },
  { domain: "infra-aks",    patterns: [/\baks\b/i, /\bkubernetes\b/i, /\bmanifest\b/i, ...] },
  // ... 16 domains total
];
```

All matched domains are combined into one `domainKnowledge` string.

### Phase Override (the Problematic Part)

```typescript
// resolveConversationSkills.ts — hard-coded phase guard
if (phase === "generate") {
  matchedDomains.add("infra-aks");
  matchedDomains.add("infra-docker");
}
```

When `phase === "generate"`, AKS and Docker knowledge is injected regardless of user message content. This is not keyword-driven — it's unconditional. See Conflict Analysis below.

### Session Context Block

`currentState` is always built and appended:
```
[Current session context]
Phase: generate
App: my-express-api (node)
Database: postgres
Files generated: Dockerfile, deployment.yaml, github-workflow.yml
```

### Adding a New Domain via Mechanism B

Edit `packages/core/src/services/resolveConversationSkills.ts`:
1. Add to `Domain` union type
2. Add `{ domain, patterns }` to `DOMAIN_PATTERNS`
3. Add knowledge block to the assembly section

No config file. Code change required.

## Conflict Analysis

### Are they redundant?

In general, **no**. They inject different content to different positions:
- A → system prompt (permanent per-phase context)
- B → user turn before real message (ephemeral per-request context)

### But Generate phase has concrete overlap

When `phase === "generate"`:

| Mechanism | What fires | What it injects | Where |
|-----------|------------|-----------------|-------|
| A | Kit prompts containing "dockerfile"/"manifest" classified to Generate | Kit-defined generation prompts | System prompt `## Available Capabilities` |
| B (unconditional) | Always when `phase === "generate"` | AKS Automatic deployment knowledge + Docker best practices | User message turn |

Both inject AKS/Docker context. The content differs (A provides kit prompts, B provides hardcoded domain knowledge), but the coverage goal is the same: ensure the LLM has AKS/Docker context in Generate phase.

### Keyword overlap table

| Trigger word | A activates | B activates |
|--------------|-------------|-------------|
| "dockerfile" | Generate phase (GENERATE_KEYWORDS) | `infra-docker` domain |
| "manifest" | Generate phase (GENERATE_KEYWORDS) | `infra-aks` domain |
| "pipeline" | Generate phase (GENERATE_KEYWORDS) | `infra-cicd` domain |
| "deploy" | Deployment phases (DEPLOYMENT_KEYWORDS) | `infra-aks` or `infra-cicd` domain |

### The maintenance risk

Changes to either keyword set are invisible to the other. A new kit whose prompts trigger on `"manifest"` will activate in Generate phase (A), but if the user message also contains `"manifest"`, Mechanism B's `infra-aks` block fires too. The combined injection is not tested end-to-end.

## Code Health Notes

:::danger Two independent keyword systems with no shared vocabulary
`GENERATE_KEYWORDS` in `skill-resolver.ts` and `DOMAIN_PATTERNS` in `resolveConversationSkills.ts` cover overlapping semantic territory with no shared file. Drift is inevitable and invisible.
:::

:::warning Unconditional Generate-phase injection in Mechanism B
The `if (phase === "generate")` guard in `resolveConversationSkills.ts` is not consistent with the rest of Mechanism B's design (keyword-driven detection). It hard-codes a specific phase's behavior rather than detecting intent from message content. This is the most likely source of future confusion.
:::

:::warning Dead Skill API in Mechanism A
`resolveSkillsAsync()` and `resolveSkillsFromList()` were exported but never called in production. They have been removed in #402. Only `resolveSkills()` remains as the public entry point.
:::

## What Should Be Cleaned Up

1. **Resolve the Generate-phase unconditional injection** — make it keyword-driven (consistent with B's design) or remove it and rely on Mechanism A's kit prompts for AKS/Docker coverage in Generate. The current implementation mixes two patterns in one function.

2. **Create a shared vocabulary module** — a single `src/engine/domain-vocab.ts` (or similar) exporting the keyword/domain taxonomy used by both mechanisms. This prevents divergence and makes the combined behavior testable.

3. **Consolidate the typed `Skill` vs legacy path in Mechanism A** — pick one canonical resolution API. Currently the typed path exists, is exported, and is tested but used by no production kit. This is the highest-risk surface area for Agent SDK integration confusion.

4. ~~**Remove `resolveSkillsAsync` / `resolveSkillsFromList` from public exports**~~ — **Done in #402.** Only `resolveSkills()` is now exported.

5. **After FSM removal** — both `resolveSkills(phase, kits)` and `resolveConversationSkills(message, phase, context)` accept a phase string. Neither needs code changes when the FSM is removed. The `if (phase === "generate")` guard in Mechanism B continues to work as a plain string comparison. The source of the phase string changes (was `engineState.currentPhase`, becomes `session.state.currentPhase`) but the function signatures and behavior are identical.
