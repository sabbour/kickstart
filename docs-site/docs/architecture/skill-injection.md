---
sidebar_position: 4
---

# Skill Injection Deep-Dive

There are two skill injection mechanisms that run every turn. They are independent, target different parts of the message array, and serve different purposes. This page explains both side-by-side.

> **Sources:**
> - Mechanism A: `packages/core/src/engine/skill-resolver.ts`
> - Mechanism B: `packages/core/src/services/resolveConversationSkills.ts`
> - Wired in: `packages/web/api/src/functions/converse.ts`

---

## Side-by-Side Comparison

| | Mechanism A — Kit Skill Resolver | Mechanism B — Per-Turn Domain Injection |
|-|----------------------------------|----------------------------------------|
| **File** | `engine/skill-resolver.ts` (428 lines) | `services/resolveConversationSkills.ts` (250+ lines) |
| **Fires when** | Every turn (always) | Every turn (always) |
| **What triggers selection** | Current FSM phase | Keywords in the user's current message |
| **Knowledge source** | Registered `IntegrationKit` objects | Hardcoded domain knowledge blocks |
| **Injection point** | System prompt — `## Available Capabilities` | New user message turn before real message |
| **Also injects** | — | `[Current session context]` appended to real user message |
| **Token cost** | Persistent (every turn, all kit prompts for this phase) | Ephemeral (only when domain matched) |
| **Extensible via** | New `IntegrationKit` TypeScript class | Edit `resolveConversationSkills.ts` |

---

## Why Two Mechanisms?

They address different problems:

**Mechanism A** solves: "The LLM needs to know what tools and capabilities are registered, and this changes by phase." This is permanent, phase-scoped context. It lives in the system prompt because the LLM needs it throughout the turn.

**Mechanism B** solves: "When the user asks about Node.js, the LLM needs Node.js-specific deployment knowledge right now, but we don't want to permanently bloat the system prompt with all possible domain knowledge." Injecting as a user turn means it's present for this turn only — not repeated in every subsequent turn.

---

## Mechanism A — How It Works

**File:** `packages/core/src/engine/skill-resolver.ts`

```typescript
// Called every turn in converse.ts
const resolvedSkills = resolveSkills(currentPhase, defaultKitRegistry.getAll());

const freshSystemPrompt = buildSystemPrompt({
  phase: currentPhase,
  kitPrompts: resolvedSkills.prompts,  // ← goes into ## Available Capabilities
  // ...
});
```

### Resolution Steps

1. **Explicit phase prompts** — if a kit has `phasePrompts[currentPhase]`, use those first.
2. **Keyword classification** — if no explicit prompts, each flat `kit.prompts[]` string is classified against keyword groups:

```typescript
const DISCOVER_KEYWORDS = ["discover", "detect", "list", "find", "query", ...];
const DESIGN_KEYWORDS   = ["architecture", "recommend", "design", "database", ...];
const GENERATE_KEYWORDS = ["generat", "dockerfile", "manifest", "workflow", "ci/cd", ...];
const DEPLOYMENT_KEYWORDS = ["deploy", "safeguard", "validation", "cost", "security", ...];
```

3. **Tool listing** — in Discover/Design phases: synthesise a prompt listing all registered tools by name and description.

### Output Format

```
## Available Capabilities

{kit prompt 1 text}

{kit prompt 2 text}
```

This is appended to the system prompt by `buildSystemPrompt()`.

### Adding a New Skill via Mechanism A

1. Implement `IntegrationKit` (`packages/core/src/kits/types.ts`):
```typescript
export interface IntegrationKit {
  name: string;
  tools: ToolDefinition[];
  connectors: ConnectorDefinition[];
  prompts?: string[];                    // flat prompts (heuristic-classified)
  phasePrompts?: Partial<Record<Phase, string[]>>;  // explicit per-phase prompts
}
```
2. Register with `defaultKitRegistry.register(myKit)`.
3. No config files — TypeScript only.

---

## Mechanism B — How It Works

**File:** `packages/core/src/services/resolveConversationSkills.ts`

```typescript
// Called every turn in converse.ts
const { domainKnowledge, currentState } = resolveConversationSkills(
  body.message,        // raw user message text
  currentPhase,        // current FSM phase
  {
    phase: currentPhase,
    appDefinition: state.appDefinition,
    filesGenerated: session.generatedArtifacts.map(a => a.filename),
  },
);

// Inject domain knowledge as a user message BEFORE the real message
if (domainKnowledge) {
  messages.push({ role: "user", content: domainKnowledge });
}

// Append session context snapshot to the real user message
const last = messages[messages.length - 1];
messages[messages.length - 1] = {
  ...last,
  content: `${last.content}\n\n${currentState}`,
};
```

### Domain Detection

```typescript
const DOMAIN_PATTERNS = [
  { domain: "stack-node",    patterns: [/\bnode(\.?js)?\b/i, /\btypescript\b/i, /\bexpress\b/i, ...] },
  { domain: "stack-python",  patterns: [/\bpython\b/i, /\bfastapi\b/i, /\bflask\b/i, ...] },
  { domain: "infra-docker",  patterns: [/\bdocker\b/i, /\bdockerfile\b/i, /\bcontainer\b/i, ...] },
  { domain: "infra-aks",     patterns: [/\baks\b/i, /\bkubernetes\b/i, /\bk8s\b/i, ...] },
  // ... 16 domains total
];
```

All matched domains are combined into a single `domainKnowledge` string injected as one user turn.

### Session Context Block

`currentState` is always built (regardless of domain matches) and appended to the real user message:

```
[Current session context]
Phase: generate
App: my-express-api (node)
Database: postgres
Files generated: Dockerfile, deployment.yaml, github-workflow.yml
```

### Example Turn

User message: `"generate the Dockerfile for my Node app"`

Messages array after Mechanism B injection:
```
[0] { role: "system",    content: "...full system prompt..." }
[1] { role: "user",      content: "Hi, I have a Node.js Express app..." }
[2] { role: "assistant", content: "...previous response..." }
[3] { role: "user",      content: "[Domain knowledge: Docker + Node.js]\n..." }  ← injected
[4] { role: "user",      content: "generate the Dockerfile...\n\n[Current session context]\n..." }  ← real + context
```

### Adding a New Domain via Mechanism B

Edit `packages/core/src/services/resolveConversationSkills.ts`:

1. Add the domain to the `Domain` union type.
2. Add a `{ domain, patterns }` entry to `DOMAIN_PATTERNS`.
3. Add a knowledge block for it in the knowledge assembly section.

There is no config file. This requires a code change.

---

## What Happens When Neither Fires

Mechanism A always runs and always produces a result (even if empty — no `## Available Capabilities` section added if no kit prompts matched).

Mechanism B always appends `currentState` to the real user message. It only skips the user-turn injection if no domains matched (`domainKnowledge === null`).
