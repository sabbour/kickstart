---
sidebar_position: 2
---

# Prompt Pipeline

Every conversation turn assembles a fresh prompt from multiple sources before calling Azure OpenAI. This page describes the exact order and the code behind each step.

> **Source files:**
> - `packages/core/src/engine/skill-resolver.ts` — Mechanism A
> - `packages/core/src/services/resolveConversationSkills.ts` — Mechanism B (live in main as of PR #382)
> - `packages/core/src/prompts/system-prompt.ts` — `buildSystemPrompt()`
> - `packages/web/api/src/functions/converse.ts` — assembly harness (~lines 210–300)
> - `packages/web/api/src/lib/converse-model-router.ts` — model routing

## Two Skill Mechanisms

There are two independent skill injection mechanisms running every turn. They target different message positions and serve different purposes.

| | Mechanism A | Mechanism B |
|-|-------------|-------------|
| **File** | `engine/skill-resolver.ts` | `services/resolveConversationSkills.ts` |
| **Trigger** | Current FSM phase | Keywords in user message |
| **Source** | Registered IntegrationKits | Hardcoded domain patterns |
| **Injection point** | System prompt (`## Available Capabilities`) | User message turn before real message |
| **Also injects** | — | `[Current session context]` appended to real user message |

## Assembly Order

```
POST /api/converse arrives
    │
    ├─ 1. Session lookup / rehydration
    ├─ 2. currentPhase = getSafeCurrentPhase(engineState)
    │
    ├─ 3. [MECHANISM A] resolveSkills(currentPhase, defaultKitRegistry.getAll())
    │      returns resolvedSkills.prompts[]
    │
    ├─ 4. resolveConverseModelRoute(currentPhase, { trustedPhase })
    │      returns { deployment, model, pricingGroup }
    │
    ├─ 5. buildArtifactSummary(session.generatedArtifacts)
    │      returns markdown summary of files generated so far
    │
    ├─ 6. buildSystemPrompt({ phase, appDefinition, kitPrompts, artifactSummary })
    │      ┌──────────────────────────────────────────┐
    │      │ KICKSTART_SYSTEM_PROMPT (persona + rules) │
    │      │ ## Current Phase: {label}                 │
    │      │ {phase description}                       │
    │      │ {phase promptTemplate with {{vars}}}      │
    │      │ {artifactSummary — if any}                │
    │      │ ## Available Capabilities                 │  ← Mechanism A here
    │      │ {kit prompts}                             │
    │      └──────────────────────────────────────────┘
    │
    ├─ 7. Build messages[] from session history
    │      messages[0] = { role: "system", content: freshSystemPrompt }
    │
    ├─ 8. [MECHANISM B] resolveConversationSkills(message, phase, sessionContext)
    │      ├─ domainKnowledge != null:
    │      │    messages.splice(messages.length - 1, 0, { role: "user", content: domainKnowledge })  // ↑ inserted immediately before the real user message
    │      └─ Append currentState to messages[last].content
    │
    └─ 9. chatCompletion(messages, { deployment, responseFormat: "json_object" })
```

## Mechanism A — Kit Skill Resolver

**File:** `packages/core/src/engine/skill-resolver.ts`

```typescript
// converse.ts ~line 210
const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());

const freshSystemPrompt = buildSystemPrompt({
  phase: currentPhase,
  appDefinition: state.appDefinition,
  kitPrompts: resolvedSkills.prompts,  // ← appended as ## Available Capabilities
  artifactSummary: artifactSummary || undefined,
});
```

**3-stage resolution:**
1. **Typed skill resolution first** — resolve `kit.skills[]` entries matching the current phase; apply keyword activation rules and priority sorting.
2. **Legacy prompt fallback** — if no typed skills, fall back to `kit.phasePrompts[phase]` (explicit per-phase), then flat `kit.prompts[]` classified by keyword groups.
3. **Phase-specific tool handling** — `resolveLegacySkills()` synthesizes a tool-listing prompt in **Discover** only; in Design it collects `availableTools` but does **not** inject that prompt.

**To add a skill:** Implement `IntegrationKit` and register with `defaultKitRegistry`. No config files.

## Mechanism B — Per-Turn Domain Injection

**File:** `packages/core/src/services/resolveConversationSkills.ts`  
**Status:** Live in main (merged PR #382). Called in `converse.ts` lines ~278–299.

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
const last = messages[messages.length - 1];
messages[messages.length - 1] = {
  ...last,
  content: `${last.content}\n\n${currentState}`,
};
```

**Detected domains:** `stack-node`, `stack-python`, `stack-dotnet`, `stack-java`, `stack-go`, `infra-docker`, `infra-aks`, `infra-cicd`, `auth`, `data-relational`, `data-nosql`, `data-cache`, `data-queue`, `component-form`, `component-table`, `component-chart`

**Example:** User says `"generate the Dockerfile for my Node app"`:
- Matched: `infra-docker`, `stack-node`
- Injected user turn: `[Domain knowledge: Docker + Node.js]`
- Real message becomes: `"generate the Dockerfile...\n\n[Current session context]\nPhase: generate\n..."`

:::note Phase-conditional override in Mechanism B
`resolveConversationSkills.ts` contains a hard-coded guard: when `phase === "generate"`, it unconditionally adds `infra-aks` and `infra-docker` domains regardless of the user message content. This ensures AKS/Docker knowledge is always present in Generate phase — the same goal Mechanism A achieves by routing kit prompts containing `"dockerfile"`/`"manifest"` to Generate phase. **This is overlapping coverage.** See Conflict Analysis below.
:::

## Conflict Analysis — Do the Two Mechanisms Overlap?

**Different targets, shared vocabulary.** Mechanism A classifies *kit prompt text*; Mechanism B classifies *user message text*. They inject to different positions in `messages[]`. The design intent is layered, not redundant.

**However, there is concrete overlap in the Generate phase:**

| What fires | Condition | Content |
|------------|-----------|---------|
| Mechanism A | Kit prompts containing "dockerfile"/"manifest" classified to Generate | Kit generation-phase prompts in system prompt |
| Mechanism B (unconditional) | `phase === "generate"` — always | `infra-aks` + `infra-docker` domain knowledge as user turn |

Both mechanisms activate in Generate phase, both inject AKS/Docker context, through different channels. The channels are different (system prompt vs user turn) but the knowledge overlaps.

**Keyword sets evolved independently.** Mechanism A uses string substring matching; Mechanism B uses regex patterns. No shared file. Overlapping terms: `"dockerfile"`, `"manifest"`, `"pipeline"`, `"deploy"`.

**Recommendation for cleanup:** The unconditional Generate phase injection in Mechanism B should either be made conditional on user message content (matching B's general pattern), or removed and covered by kit prompts alone. The current state works but is not intentionally designed.

## System Prompt Structure

`buildSystemPrompt()` builds:

```
{KICKSTART_SYSTEM_PROMPT}
  - Persona + COLLABORATOR VOICE
  - K8s terminology rules by phase
  - GUARDRAILS (DS001–DS013)

## Current Phase: {label}
{phase description}
{phase promptTemplate}

{artifactSummary — omitted if empty}

## Available Capabilities
{kit prompts — omitted if none}
```

Phase exit conditions in `phases.ts` are human-readable strings. Not code-enforced. See [FSM](./fsm.md).

## Model Routing {#model-routing}

Trust-based, not phase-based:

```typescript
// packages/web/api/src/lib/converse-model-router.ts
export function resolveConverseModelRoute(
  phase: string | null | undefined,
  options: { trustedPhase?: boolean } = {},
): ConverseModelRoute {
  if (options.trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    return { deployment: getGenerateDeploymentName(), pricingGroup: "generate" };
    // Reads AZURE_OPENAI_CODEX_DEPLOYMENT — e.g. "gpt-5.4"
  }
  return { deployment: getChatDeploymentName(), pricingGroup: "chat" };
  // Reads AZURE_OPENAI_CHAT_DEPLOYMENT — e.g. "gpt-5.4-mini"
}
```

| Condition | Model | Env var |
|-----------|-------|---------|
| Generate + server-trusted | GPT-5.4 | `AZURE_OPENAI_CODEX_DEPLOYMENT` |
| Any other phase | GPT-5.4-mini | `AZURE_OPENAI_CHAT_DEPLOYMENT` |
| Client-rehydrated session | GPT-5.4-mini | `AZURE_OPENAI_CHAT_DEPLOYMENT` |

## Code Health Notes

:::warning Exported but uncalled variants
`resolveSkillsAsync()` and `resolveSkillsFromList()` are exported from `@kickstart/core` and tested, but `converse.ts` only calls `resolveSkills()`. These inflate the SDK surface without runtime callers.
:::

:::warning Typed Skill path is dormant
`skill-resolver.ts` has two resolution paths: typed `kit.skills[]` and legacy `kit.prompts[]`. No production kit uses the typed path. The dual-path resolver will confuse Agent SDK implementors.
:::

:::warning Keyword drift risk
Two independent keyword systems. Changes in one are invisible to the other. A new kit whose prompts contain `"manifest"` will activate in AKS-related user turns through Mechanism A, but Mechanism B's `infra-aks` domain block will also activate if the user message contains `/\bmanifest\b/i`. No test exercises the combined behavior.
:::

## What Should Be Cleaned Up

1. **Remove `resolveSkillsAsync` / `resolveSkillsFromList` from public exports** — or document exactly which Agent SDK scenario needs them.
2. **Resolve Generate-phase overlap** — remove the unconditional `infra-aks`/`infra-docker` injection from Mechanism B or document why the system prompt coverage is insufficient.
3. **Consolidate typed `Skill` vs legacy path** — one canonical resolution path before Agent SDK adapters are built.
4. **Create a shared vocabulary file** for terms that must stay in sync between the two mechanisms.

---

## Impact of FSM Removal

:::warning phases.ts is being deleted
`phases.ts` phase templates are confirmed for deletion. `buildSystemPrompt()` will no longer select a template by phase. See [FSM](./fsm.md).
:::

### What Changes

`buildSystemPrompt()` replaces phase-template selection with a single full-sequence prompt using numbered blocks:

```
═══ 1. BEFORE YOU START ═══  [always present]
═══ 2. GATHER REQUIREMENTS ═══  [always present]
═══ 3. GENERATE ═══  [always present]
```

Model routing reads `session.state.currentPhase` (plain string) instead of `session.engineState.currentPhase` (FSM enum).

### What Does NOT Change

Both skill injection mechanisms are unaffected:
- `resolveSkills(phase, kits)` — same signature, same behavior
- `resolveConversationSkills(message, phase, context)` — same signature; `if (phase === "generate")` guard works as plain string comparison

The 6-part per-turn assembly order is unchanged.
