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
  │      │    messages.push({ role: "user", content: domainKnowledge })
  │      └─ Append currentState snapshot to last user message
  │
  └─ 9. Call Azure OpenAI with assembled messages[]
```

---

## Mechanism A — Kit Skill Resolver (`engine/skill-resolver.ts`)

**Purpose:** Injects capabilities from registered IntegrationKits into the system prompt so the LLM knows what tools and domain knowledge are available for the current phase.

**How it works (`resolveSkills`):**
1. **Phase filter** — select kits whose explicit `phasePrompts[currentPhase]` match, OR fall back to heuristic keyword classification of flat `kit.prompts[]`.
2. **Keyword activation** — classify each prompt string against keyword groups:
   - `DISCOVER_KEYWORDS` → `Phase.Discover`
   - `DESIGN_KEYWORDS` → `Phase.Discover, Phase.Design`
   - `GENERATE_KEYWORDS` → `Phase.Generate`
   - `DEPLOYMENT_KEYWORDS` → `Phase.Review, Phase.Handoff, Phase.Deploy`
3. **Priority sort** — explicit `phasePrompts` take priority over heuristically classified flat prompts.

**Output:** `resolvedSkills.prompts[]` — passed to `buildSystemPrompt()` as `kitPrompts`.

**Injection location:** `buildSystemPrompt()` appends a `## Available Capabilities` section at the end of the system prompt.

**Tool listing:** In Discover/Design phases, the resolver also synthesises a prompt listing all registered tool names and descriptions, telling the LLM to call them proactively rather than ask the user.

```typescript
// converse.ts line ~210
const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());
// ...
const freshSystemPrompt = buildSystemPrompt({
  phase: currentPhase,
  appDefinition: state.appDefinition,
  kitPrompts: resolvedSkills.prompts,   // ← A injected here
  artifactSummary: artifactSummary || undefined,
});
```

**To add a new skill via Mechanism A:** Create an `IntegrationKit` class and register it with `defaultKitRegistry`. No config files — TypeScript only.

---

## Mechanism B — Per-Turn Domain Injection (`services/resolveConversationSkills.ts`)

**Purpose:** Detects which technical domains the user's current message touches, then injects targeted domain knowledge as a user turn. Saves 500–1000 tokens compared to always-on system prompt injection.

**How it works:**
1. **Domain detection** — scan the user message against `DOMAIN_PATTERNS` (regex arrays per domain).
2. **Knowledge assembly** — for each matched domain, append the corresponding knowledge block.
3. **Inject as user message** — if any domain matched, insert `{ role: "user", content: domainKnowledge }` BEFORE the real user message.
4. **Session context** — always build and append a `[Current session context]` block to the real user message.

**Detected domains:**
- Stack: `stack-node`, `stack-python`, `stack-dotnet`, `stack-java`, `stack-go`
- Infrastructure: `infra-docker`, `infra-aks`, `infra-cicd`
- Auth: `auth`
- Data: `data-relational`, `data-nosql`, `data-cache`, `data-queue`
- Components: `component-form`, `component-table`, `component-chart`

**Injection location:** User message turn, immediately before the real user message. The `[Current session context]` block (phase, app, runtime, files generated) is appended to the real user message.

**Example:** User says "generate the Dockerfile for my Node app":
- Detected domains: `infra-docker`, `stack-node`
- Injected: `[Domain knowledge: Docker + Node.js]` as user message
- Then real user message: `"generate the Dockerfile for my Node app\n\n[Current session context]\nPhase: generate\nRuntime: node\n..."`

```typescript
// converse.ts
const { domainKnowledge, currentState } = resolveConversationSkills(
  body.message,
  currentPhase,
  { phase: currentPhase, appDefinition: state.appDefinition, filesGenerated }
);
if (domainKnowledge) {
  messages.push({ role: "user", content: domainKnowledge });
}
// Append currentState to last user message
```

**The keyword matching is hardcoded** in `resolveConversationSkills.ts`. There is no config file to add new domains — new domains require editing that file.

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

**Sources:**
- `KICKSTART_SYSTEM_PROMPT` — `packages/core/src/prompts/system-prompt.ts`
- Phase templates — `packages/core/src/engine/phases.ts`
- `BASE_COMPONENT_CATALOG` — `packages/core/src/prompts/component-catalog.ts`

---

## Phase Templates

Phase templates are minimal context injections. The behavioral instructions (K8s terminology rules, ONE concept per turn, etc.) are in the unified system prompt — NOT in each phase template.

| Phase | Template variables injected |
|-------|---------------------------|
| Discover | `{{knownInfo}}` |
| Design | `{{knownInfo}}` |
| Generate | `{{appDefinition}}`, `{{services}}` |
| Review | `{{appDefinition}}`, `{{costContext}}` |
| Handoff | `{{appContext}}`, `{{repoInfo}}` |
| Deploy | `{{appContext}}`, `{{deploymentConfig}}` |

**Exit conditions in `phases.ts` are narrative strings** (e.g., `"user has approved the plan"`). They are human-readable guidance for the LLM — they are NOT checked by code.

---

## Model Routing

Model routing is **trust-based**, not phase-based.

```typescript
// packages/web/api/src/lib/converse-model-router.ts
export function resolveConverseModelRoute(phase, { trustedPhase }): ConverseModelRoute {
  if (trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    // High-quality generate model (AZURE_OPENAI_CODEX_DEPLOYMENT env var)
    return { deployment: getGenerateDeploymentName(), pricingGroup: "generate" };
  }
  // Chat model for everything else (AZURE_OPENAI_CHAT_DEPLOYMENT env var)
  return { deployment: getChatDeploymentName(), pricingGroup: "chat" };
}
```

| Condition | Model tier | Env var |
|-----------|-----------|---------|
| Generate phase + `routingPhaseTrusted = true` | Generate (GPT-5.4) | `AZURE_OPENAI_CODEX_DEPLOYMENT` |
| Any other phase | Chat (GPT-5.4-mini) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |
| Client-rehydrated session (any phase) | Chat (GPT-5.4-mini) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |

**Security:** `session.routingPhaseTrusted` is set to `false` when a session is rehydrated from client-provided message history. The client cannot self-elevate to the generate-tier model by claiming to be in Generate phase.

> ⚠️ **Stale docs note:** The old `docs/prompt-architecture.md` described a future "Layer 1: Azure Skills" that was "not yet implemented". Both skill injection mechanisms are now implemented and live. The old `docs-site/docs/architecture/overview.md` cited GPT-4o/Codex — the current models are GPT-5.4 / GPT-5.4-mini.
