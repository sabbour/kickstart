# Prompt Architecture

This document describes the complete LLM prompt pipeline — how every turn assembles its context before calling Azure OpenAI.

> **Source files:**
> - `packages/core/src/prompts/system-prompt.ts` — `buildSystemPrompt()`
> - `packages/core/src/engine/skill-resolver.ts` — Mechanism A
> - `packages/core/src/services/resolveConversationSkills.ts` — Mechanism B
> - `packages/web/api/src/functions/converse.ts` — assembly harness
> - `packages/web/api/src/lib/converse-model-router.ts` — model routing

---

## Overview: Two Skill Mechanisms, One Pipeline

Every turn runs **two independent skill injection mechanisms** before calling OpenAI:

| | Mechanism A | Mechanism B |
|-|-------------|-------------|
| **File** | `engine/skill-resolver.ts` | `services/resolveConversationSkills.ts` |
| **Trigger** | Current FSM phase | Keywords in user message |
| **Source** | Registered IntegrationKits | Hardcoded domain patterns |
| **Injection point** | System prompt (`## Available Capabilities`) | User message turn (before real message) |
| **Also injects** | — | `[Current session context]` appended to real user message |
| **Purpose** | Tool/kit capability discovery | Targeted domain knowledge for this specific request |

They are NOT redundant. A injects permanent per-phase capability context; B injects ephemeral per-request domain context.

---

## Per-Turn Assembly Order

```
converse.ts receives POST /api/converse { sessionId, message }
  │
  ├─ 1. Look up / create session
  ├─ 2. Determine currentPhase from FSM engineState
  │
  ├─ 3. MECHANISM A: resolveSkills(currentPhase, defaultKitRegistry.getAll())
  │      └─ Returns: resolvedSkills.prompts[]
  │
  ├─ 4. resolveConverseModelRoute(currentPhase, { trustedPhase })
  │      └─ Returns: { deployment, model, pricingGroup }
  │
  ├─ 5. buildArtifactSummary(session.generatedArtifacts)
  │      └─ Returns: markdown summary of previously generated files
  │
  ├─ 6. buildSystemPrompt({ phase, appDefinition, kitPrompts, artifactSummary })
  │      └─ Returns: full system prompt string (see structure below)
  │
  ├─ 7. Build messages[] from session history
  │      └─ Replace messages[0] (system) with freshSystemPrompt
  │
  ├─ 8. MECHANISM B: resolveConversationSkills(message, phase, sessionContext)
  │      ├─ If domainKnowledge != null:
  │      │    messages.splice(messages.length - 1, 0, { role: "user", content: domainKnowledge })  // ↑ inserted immediately before the real user message
  │      └─ Append currentState snapshot to last user message
  │
  └─ 9. Call Azure OpenAI with assembled messages[]
```

---

## Mechanism A — Kit Skill Resolver (`engine/skill-resolver.ts`)

**Purpose:** Injects capabilities from registered IntegrationKits into the system prompt so the LLM knows what tools and domain knowledge are available for the current phase.

**How it works (`resolveSkills`):**
1. **Typed skill resolution first** — resolve `kit.skills[]` entries matching the current phase; apply keyword activation rules and priority sorting.
2. **Legacy prompt fallback** — if no typed skills, fall back to `kit.phasePrompts[phase]` (explicit per-phase), then flat `kit.prompts[]` classified by keyword groups:
   - `DISCOVER_KEYWORDS` → `Phase.Discover`
   - `DESIGN_KEYWORDS` → `Phase.Discover, Phase.Design`
   - `GENERATE_KEYWORDS` → `Phase.Generate`
   - `DEPLOYMENT_KEYWORDS` → `Phase.Review, Phase.Handoff, Phase.Deploy`
3. **Phase-specific tool handling** — `resolveLegacySkills()` synthesizes a tool-listing prompt in **Discover** only; in Design it collects `availableTools` but does **not** inject that prompt.

**Output:** `resolvedSkills.prompts[]` — passed to `buildSystemPrompt()` as `kitPrompts`.

**Injection location:** `buildSystemPrompt()` appends a `## Available Capabilities` section at the end of the system prompt.

**To add a new skill via Mechanism A:** Create an `IntegrationKit` class and register it with `defaultKitRegistry`. No config files — TypeScript only.

---

## Mechanism B — Per-Turn Domain Injection (`services/resolveConversationSkills.ts`)

**Status: Live in main as of PR #382.** Wired into `converse.ts` at lines ~278–299.

**Purpose:** Detects which technical domains the user's current message touches, then injects targeted domain knowledge as a user turn. Saves 500–1000 tokens compared to always-on system prompt injection.

**How it works:**
1. **Domain detection** — scan the user message against `DOMAIN_PATTERNS` (regex arrays per domain).
2. **Knowledge assembly** — for each matched domain, append the corresponding knowledge block.
3. **Inject as user message** — if any domain matched, insert `{ role: "user", content: domainKnowledge }` BEFORE the real user message.
4. **Session context** — always build and append a `[Current session context]` block to the real user message.

**Detected domains:** `stack-node`, `stack-python`, `stack-dotnet`, `stack-java`, `stack-go`, `infra-docker`, `infra-aks`, `infra-cicd`, `auth`, `data-relational`, `data-nosql`, `data-cache`, `data-queue`, `component-form`, `component-table`, `component-chart`

**Example:** User says "generate the Dockerfile for my Node app":
- Detected domains: `infra-docker`, `stack-node`
- Injected: `[Domain knowledge: Docker + Node.js]` as user message
- Then real user message: `"generate the Dockerfile for my Node app\n\n[Current session context]\nPhase: generate\nRuntime: node\n..."`

**The keyword matching is hardcoded** in `resolveConversationSkills.ts`. There is no config file to add new domains — new domains require editing that file.

---

## Conflict Analysis: Do the Two Mechanisms Overlap?

**They classify different things** — Mechanism A classifies *kit prompt strings*; Mechanism B classifies *user messages*. They do not directly interact.

**But they share trigger vocabulary.** Mechanism A `GENERATE_KEYWORDS` includes `"dockerfile"`, `"manifest"`, `"pipeline"`. Mechanism B's `infra-docker` matches `/\bdocker(file)?\b/i` and `infra-aks` matches `/\bmanifest\b/i`. When a user says "generate a Dockerfile", both fire:
- A adds the kit's generate-phase prompts to the system prompt.
- B adds Docker + AKS domain knowledge as a user turn.

This is intentional in the current design (different audiences — system prompt vs user turn context), but the keyword sets evolved independently. There is no shared vocabulary file. If someone adds a new kit whose prompts trigger on "manifest", it will activate in phases that now also receive Mechanism B's infra-aks domain block. The combined injection is not tested end-to-end.

**The `resolveConversationSkills.ts` also has phase-conditional logic:**
```typescript
if (phase === "generate") {
  matchedDomains.add("infra-aks");
  matchedDomains.add("infra-docker");
}
```
This hard-codes Generate phase as always receiving AKS + Docker knowledge — regardless of what the user message says. This duplicates what Mechanism A's `GENERATE_KEYWORDS` heuristic was already doing: ensuring the LLM has AKS/Docker context during Generate. There is genuine overlap here.

---

## System Prompt Structure

`buildSystemPrompt()` assembles the prompt in this order:

```
[KICKSTART_SYSTEM_PROMPT]
  Persona: "You are Kickstart, a friendly AI guide..."
  COLLABORATOR VOICE rules
  K8s terminology rules (by phase)
  GUARDRAILS (13 deployment safeguards DS001–DS013)

## Current Phase: {phaseLabel}
{phase.description}

[Phase template — from phases.ts promptTemplate]
  {{knownInfo}} or {{appDefinition}} or {{appContext}} etc.

[Artifact summary — files generated in previous turns]
  (omitted if none)

## Available Capabilities
[Kit prompts from Mechanism A]
  (omitted if no kits matched)
```

---

## Phase Templates

Phase templates are minimal context injections. Behavioral instructions live in the unified system prompt, NOT in each phase template.

| Phase | Template variables injected |
|-------|---------------------------|
| Discover | `{{knownInfo}}` |
| Design | `{{knownInfo}}` |
| Generate | `{{appDefinition}}`, `{{services}}` |
| Review | `{{appDefinition}}`, `{{costContext}}` |
| Handoff | `{{appContext}}`, `{{repoInfo}}` |
| Deploy | `{{appContext}}`, `{{deploymentConfig}}` |

**Exit conditions in `phases.ts` are narrative strings.** They are human-readable guidance for the LLM — not checked by code.

---

## Model Routing

Model routing is **trust-based**, not phase-based.

```typescript
// packages/web/api/src/lib/converse-model-router.ts
export function resolveConverseModelRoute(phase, { trustedPhase }): ConverseModelRoute {
  if (trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    // AZURE_OPENAI_CODEX_DEPLOYMENT (e.g. gpt-5.4)
    return { deployment: getGenerateDeploymentName(), pricingGroup: "generate" };
  }
  // AZURE_OPENAI_CHAT_DEPLOYMENT (e.g. gpt-5.4-mini)
  return { deployment: getChatDeploymentName(), pricingGroup: "chat" };
}
```

| Condition | Model tier | Env var |
|-----------|-----------|---------|
| Generate phase + `routingPhaseTrusted = true` | Generate (GPT-5.4) | `AZURE_OPENAI_CODEX_DEPLOYMENT` |
| Any other phase | Chat (GPT-5.4-mini) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |
| Client-rehydrated session (any phase) | Chat (GPT-5.4-mini) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |

---

## Code Health Notes

**`resolveSkillsAsync` and `resolveSkillsFromList` are exported but never called in production:**
Both are exported from `@kickstart/core`, tested in `skill-resolver.test.ts`, but `converse.ts` only calls `resolveSkills()`. They add SDK surface area without a runtime caller.

**Mechanism B has a hard-coded phase guard that duplicates Mechanism A's intent:**
The generate-phase branch in `resolveConversationSkills.ts` unconditionally adds `infra-aks` and `infra-docker` domains regardless of user message content. This is the same coverage Mechanism A achieves by classifying kit prompts containing `"dockerfile"` or `"manifest"` into Generate phase. The overlap is functional but untested as a combined behavior.

**Two independent keyword systems with no shared vocabulary:**
Mechanism A uses plain string arrays (`GENERATE_KEYWORDS = ["generat", "dockerfile", ...]`); Mechanism B uses regex arrays per domain. They will drift independently as both files evolve.

---

## What Should Be Cleaned Up

1. **Remove or internalize `resolveSkillsAsync` / `resolveSkillsFromList`** — they're not needed by the current runtime and shouldn't be part of the Agent SDK public API without a defined use case.

2. **Resolve the generate-phase overlap between Mechanisms A and B** — either the unconditional generate-phase injection in Mechanism B should be removed (let Mechanism A cover it via kit prompts), or document explicitly that they're intentionally layered.

3. **Extract a shared keyword/domain vocabulary** — a single `DOMAIN_VOCAB` module referenced by both mechanisms would prevent silent divergence and make it obvious when a new kit keyword should also have a Mechanism B domain block.

4. **Decide on typed `Skill` vs legacy path** — `skill-resolver.ts` has two code paths and zero production kits on the new path. Before the Agent SDK integration, decide which is canonical and delete the other.

---

## Impact of FSM Removal on the Prompt Pipeline

`machine.ts` and `phases.ts` are scheduled for deletion. Here is exactly what changes and what does not.

### What Changes

**`buildSystemPrompt()` — phase template selection is removed:**

Before FSM removal, `buildSystemPrompt()` accepted a `phase` parameter and selected one of several phase-specific prompt templates defined in `phases.ts`. After FSM removal, the full phase sequence lives in the prompt itself as numbered `═══ N. SECTION ═══` blocks. No template selection is needed — the LLM reads the numbered blocks and knows where it is:

```
═══ 1. BEFORE YOU START ═══
...
═══ 2. GATHER REQUIREMENTS ═══
...
═══ 3. GENERATE ═══
...
```

**`converse-model-router.ts` — phase source changes:**

```typescript
// Before: reads FSM-managed enum value
const phase = session.engineState.currentPhase;

// After: reads plain string from LLM JSON envelope
const phase = session.state.currentPhase;
```

The routing logic (trust check + phase string comparison) is unchanged.

### What Does NOT Change

- **Mechanism A** (`resolveSkills(phase, kits)`) — accepts a phase string, returns kit prompts for that phase. Interface unchanged. Only the source of the phase string changes.
- **Mechanism B** (`resolveConversationSkills(message, phase, context)`) — accepts a phase string, runs domain detection. Interface unchanged. The `if (phase === "generate")` guard continues to work as a plain string comparison.
- **Assembly order** — persona → COLLABORATOR VOICE → GUARDRAILS → phase blocks → kit prompts. The per-turn assembly sequence is the same; only the phase block generation changes.
