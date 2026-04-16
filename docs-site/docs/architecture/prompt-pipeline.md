---
sidebar_position: 2
---

# Prompt Pipeline

Every conversation turn assembles a fresh prompt from multiple sources before calling Azure OpenAI. This document describes the exact assembly order and each mechanism.

> **Source files:**
> - `packages/core/src/engine/skill-resolver.ts` — Mechanism A
> - `packages/core/src/services/resolveConversationSkills.ts` — Mechanism B
> - `packages/core/src/prompts/system-prompt.ts` — `buildSystemPrompt()`
> - `packages/web/api/src/functions/converse.ts` — assembly harness (lines ~210–300)
> - `packages/web/api/src/lib/converse-model-router.ts` — model routing

---

## Two Skill Mechanisms

There are two independent skill injection mechanisms that run every turn:

| | Mechanism A | Mechanism B |
|-|-------------|-------------|
| **File** | `engine/skill-resolver.ts` | `services/resolveConversationSkills.ts` |
| **Trigger** | Current FSM phase | Keywords in user message |
| **Source** | Registered IntegrationKits | Hardcoded domain patterns |
| **Injection point** | System prompt (`## Available Capabilities`) | User message turn before real message |
| **Also injects** | — | `[Current session context]` appended to real user message |

They target different points in the message array and serve different purposes. Neither is redundant.

---

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
    │      │ ## Available Capabilities                 │  ← Mechanism A injected here
    │      │ {kit prompts}                             │
    │      └──────────────────────────────────────────┘
    │
    ├─ 7. Build messages[] from session history
    │      messages[0] = { role: "system", content: freshSystemPrompt }
    │      messages[1..n] = stored conversation turns
    │
    ├─ 8. [MECHANISM B] resolveConversationSkills(message, phase, sessionContext)
    │      ├─ If domainKnowledge != null:
    │      │    messages.push({ role: "user", content: domainKnowledge })  ← inserted here
    │      └─ Append currentState to messages[last].content
    │             messages[last].content += "\n\n[Current session context]\n..."
    │
    └─ 9. chatCompletion(messages, { deployment, responseFormat: "json_object" })
```

---

## Mechanism A — Kit Skill Resolver

**File:** `packages/core/src/engine/skill-resolver.ts`

Resolves prompts from registered `IntegrationKit` objects based on the current phase. The result is appended to the system prompt as `## Available Capabilities`.

```typescript
// converse.ts ~line 210
const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());

const freshSystemPrompt = buildSystemPrompt({
  phase: currentPhase,
  appDefinition: state.appDefinition,
  kitPrompts: resolvedSkills.prompts,  // ← injected into system prompt
  artifactSummary: artifactSummary || undefined,
});
```

**3-stage resolution:**
1. **Phase filter** — explicit `kit.phasePrompts[phase]` takes priority.
2. **Keyword classification** — if no explicit prompts, classify flat `kit.prompts[]` via keyword groups (DISCOVER_KEYWORDS, DESIGN_KEYWORDS, GENERATE_KEYWORDS, DEPLOYMENT_KEYWORDS).
3. **Tool listing** — in Discover/Design phases, synthesise a prompt listing all registered tools so the LLM calls them proactively.

**Adding a new skill via Mechanism A:** Implement `IntegrationKit` (TypeScript interface in `packages/core/src/kits/types.ts`) and register with `defaultKitRegistry`. No config files.

---

## Mechanism B — Per-Turn Domain Injection

**File:** `packages/core/src/services/resolveConversationSkills.ts`

Detects domains in the user message, injects targeted knowledge as a user message turn, and always appends a session context snapshot.

```typescript
// converse.ts ~line 278
const { domainKnowledge, currentState } = resolveConversationSkills(
  body.message,
  currentPhase,
  { phase: currentPhase, appDefinition: state.appDefinition, filesGenerated },
);
if (domainKnowledge) {
  messages.push({ role: "user", content: domainKnowledge });
}
// Append currentState to last user message
const last = messages[messages.length - 1];
messages[messages.length - 1] = {
  ...last,
  content: `${last.content}\n\n${currentState}`,
};
```

**Detected domains:**

| Domain | Trigger keywords |
|--------|-----------------|
| `stack-node` | node, nodejs, typescript, express, nestjs, npm |
| `stack-python` | python, fastapi, flask, django, pip, uvicorn |
| `stack-dotnet` | .net, c#, asp.net, dotnet, nuget |
| `stack-java` | java, spring, maven, gradle, quarkus |
| `stack-go` | go (language), golang |
| `infra-docker` | docker, dockerfile, container, image |
| `infra-aks` | aks, kubernetes, k8s, helm, cluster |
| `infra-cicd` | github actions, workflow, ci/cd, pipeline |
| `auth` | authentication, oauth, jwt, identity |
| `data-relational` | postgres, mysql, sql server, database |
| `data-nosql` | mongodb, cosmos, dynamodb |
| `data-cache` | redis, cache |
| `data-queue` | service bus, event hubs, queue |
| `component-form` | form, input, validation |
| `component-table` | table, grid, list |
| `component-chart` | chart, graph, dashboard |

**Example:** User message `"generate the Dockerfile for my Node app"`:
- Matched: `infra-docker`, `stack-node`
- Injected: `[Domain knowledge: Docker + Node.js]` user turn
- Real message becomes: `"generate the Dockerfile...\n\n[Current session context]\nPhase: generate\n..."`

**Keyword matching is hardcoded** in `resolveConversationSkills.ts`. Adding new domains requires editing that file.

---

## System Prompt Structure

`buildSystemPrompt()` (`packages/core/src/prompts/system-prompt.ts`) builds:

```
{KICKSTART_SYSTEM_PROMPT}
  - Persona ("You are Kickstart, a friendly AI guide...")
  - COLLABORATOR VOICE rules (one concept per turn, progressive disclosure, etc.)
  - K8s terminology rules by phase
  - GUARDRAILS — 13 deployment safeguards (DS001–DS013)

## Current Phase: {phaseLabel}
{phase.description}

{phase.promptTemplate — with {{vars}} interpolated}
  Discover:  {{knownInfo}}
  Design:    {{knownInfo}}
  Generate:  {{appDefinition}}, {{services}}
  Review:    {{appDefinition}}, {{costContext}}
  Handoff:   {{appContext}}, {{repoInfo}}
  Deploy:    {{appContext}}, {{deploymentConfig}}

{artifactSummary — omitted if no files generated yet}

## Available Capabilities
{kit prompts — omitted if no kits matched for this phase}
```

**Phase exit conditions** in `phases.ts` (e.g., `"user has approved the plan"`) are human-readable narrative strings. They are NOT checked by code. See [FSM](./fsm.md).

---

## Model Routing

Model routing is **trust-based**, not phase-based.

```typescript
// packages/web/api/src/lib/converse-model-router.ts
export function resolveConverseModelRoute(
  phase: string | null | undefined,
  options: { trustedPhase?: boolean } = {},
): ConverseModelRoute {
  if (options.trustedPhase && normalizeConversePhase(phase) === Phase.Generate) {
    // Generate tier — AZURE_OPENAI_CODEX_DEPLOYMENT
    return { deployment: getGenerateDeploymentName(), pricingGroup: "generate" };
  }
  // Chat tier — AZURE_OPENAI_CHAT_DEPLOYMENT
  return { deployment: getChatDeploymentName(), pricingGroup: "chat" };
}
```

| Condition | Model | Env var |
|-----------|-------|---------|
| Generate phase + server-trusted | GPT-5.4 (generate) | `AZURE_OPENAI_CODEX_DEPLOYMENT` |
| Any other phase | GPT-5.4-mini (chat) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |
| Client-rehydrated session | GPT-5.4-mini (chat) | `AZURE_OPENAI_CHAT_DEPLOYMENT` |

`session.routingPhaseTrusted` is set to `false` during `hydrateSession()`. The client cannot elevate itself to the generate-tier model by claiming to be in Generate phase.
