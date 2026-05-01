---
sidebar_position: 7
---

# Agent Coordination

How agents coordinate via handoff patterns, `asTools` wiring, question budgets, and the coordinator (triage) role.

## Overview

Kickstart uses a multi-agent architecture where a **coordinator agent** (the triage agent) routes conversations to specialist agents. Coordination happens through two mechanisms:

1. **Handoffs** — full ownership transfer from one agent to another.
2. **`asTools` consultation** — bounded, stateless queries to a specialist without transferring ownership.

## The Coordinator Role (Triage)

The triage agent (`core.triage`) is the entry point for all user conversations. Its responsibilities:

- **Mode recognition** — classify the user's intent into a fixed enum (`iteration`, `handover`, `bulk`, `paas-migration`, `migration-readiness`, `greenfield`) using the typed `TriageModeSchema`.
- **Routing** — hand off to the appropriate specialist based on the recognized mode.
- **Consultation** — use `asTools` to ask specialists quick questions without relinquishing control.

```
User message
    │
    ▼
┌──────────────┐    asTools (bounded)     ┌─────────────────┐
│ core.triage  │◄────────────────────────►│ aks.architect   │
│ (coordinator)│                          │ azure.architect │
│              │                          │ core.codesmith  │
│              │──── handoff (transfer) ──►│ specialist      │
└──────────────┘                          └─────────────────┘
```

## Handoff Patterns

A handoff transfers full conversation ownership from one agent to another. Handoffs are declared in agent frontmatter:

```yaml
---
name: core.triage
handoffs:
  - label: Deploy to AKS
    agent: aks.architect
    send: true
  - label: Code generation
    agent: core.codesmith
    send: true
---
```

### Typed Handoff Briefing

When handing off, the coordinator constructs a **Handoff Briefing** — a typed payload (not free prose) validated by `TriageHandoffBriefingSchema` (parsed via `parseTriageHandoffBriefing`) in `packages/pack-core/src/triage/handoff-schema.ts`. This ensures:

- **Z1**: Constraint-spec version pin is carried as structured data.
- **Z2**: Downstream agents reference the typed slot, never raw user text.
- **Z3**: The recognized mode is a fixed enum, not raw prose.

```typescript
// Handoff briefing carries structured metadata
{
  version: 'triage-handoff/v1',         // schema version
  mode: 'migration-readiness',          // Z3: enum, not prose
  constraintSpec: {                     // Z1: typed slot
    safeguardSpecVersion: 'v1.1.1',
    aksVersion: '2026-03-15',
  },
  sourceSignals: [...],                 // evidence trail
  skillIdsLoaded: ['azure/arm-basics', ...],  // required skills
}
```

### Handoff vs `asTool` Decision

| Situation | Mechanism |
|-----------|-----------|
| Specialist should **own the conversation** going forward | Handoff |
| You need a specialist's answer to **continue your own task** | `asTool` |

**Rule of thumb:** If you will act on the answer and keep responding to the user, use `asTool`. If the specialist takes over, use handoff.

## `asTools` Wiring

The `asTool()` harness wrapper exposes any agent as a callable tool for bounded, stateless consultation. Declare in frontmatter:

```yaml
---
name: aks.architect
asTools:
  - agent: azure.architect
    description: Consult for cross-domain VNET/DNS questions.
    maxTurns: 3
  - agent: core.codesmith
    description: Generate infrastructure code mid-diagnosis.
    maxTurns: 5
---
```

Each entry generates a tool named `ask_<sanitised_agent_name>` (e.g., `ask_azure_architect`).

### Current Wired Pairs

| Caller | Specialist | Tool name | Use case |
|--------|-----------|-----------|----------|
| `core.triage` | `aks.architect` | `ask_aks_architect` | AKS design questions during triage |
| `core.triage` | `azure.architect` | `ask_azure_architect` | Azure infra questions during triage |
| `aks.architect` | `azure.architect` | `ask_azure_architect` | Cross-domain VNET/DNS/Private Link |
| `aks.architect` | `core.codesmith` | `ask_core_codesmith` | Generate infra code mid-diagnosis |
| `core.codesmith` | `core.reviewer` | `ask_core_reviewer` | Immediate review of generated code |

### Behaviour

- **Bounded** — capped at `maxTurns` (default 5) to prevent runaway chains.
- **Stateless** — no conversation history passes to the specialist; each call starts fresh.
- **Non-mutating** — the original agent object is never modified (cloned internally).
- **Text extraction** — returns plain string to the parent LLM.

## Question Budgets

To prevent infinite consultation loops and control cost, each agent-to-agent interaction is bounded by a **question budget**:

- `asTools` calls are capped by `maxTurns` per consultation (configurable per wired pair).
- The default cap is `AS_TOOL_MAX_TURNS_DEFAULT = 5` turns per invocation.
- The runner enforces a global turn limit across the entire conversation chain.

These budgets ensure:
1. Specialist consultations are focused and concise.
2. Costs remain predictable (each turn = one LLM call).
3. Runaway loops are impossible — the harness hard-stops at the budget limit.

## CI Enforcement

The handoff schema is enforced at CI time:

- **`triage-handoff-ci-enforcement.test.ts`** — verifies every downstream agent prompt references the typed handoff slot (not raw user text).
- **`triage-handoff-schema.test.ts`** — validates briefing payloads against `TriageHandoffBriefingSchema`.
- **`triage-mode-recognition.test.ts`** — confirms mode classification produces valid enum values.

## Related

- [Agent as Tool (`asTool`)](../extending/agent-as-tool.md) — API reference and detailed usage.
- [Runner Chain](../extending/runner-chain.md) — for stateful multi-turn specialist interaction.
- [Conversation Phases](../extending/conversation-phases.md) — lifecycle of a multi-agent conversation.
