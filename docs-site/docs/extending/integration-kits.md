---
sidebar_position: 4
---

# Packs

A **Pack** is the unit of extensibility in Kickstart. It bundles agents, skills, tools, user actions, components, and guardrails into a single deployable unit. The harness is domain-agnostic; packs carry all product knowledge.

## Pack Interface

Every pack implements the `Pack` interface registered via the `PackRegistry`:

```typescript
interface Pack {
  name: string;          // e.g. "azure", "aks-automatic", "github"
  description: string;
  dependencies?: string[];  // other pack names that must be registered first

  agents?: AgentContribution[];
  skills?: SkillContribution[];
  tools?: ToolContribution[];
  userActions?: UserActionContribution[];
  components?: ComponentContribution[];
  guardrails?: GuardrailContribution[];

  onRegister?: () => Promise<void>;
}
```

## Primitive Naming Conventions

| Primitive | Name format | Example |
|-----------|------------|---------|
| Agent | `pack.agent_name` | `azure.architect`, `core.triage` |
| Tool | `pack.verb_noun` | `azure.arm_get`, `core.write_file` |
| UserAction | `pack:verb_noun` | `azure:login`, `github:oauth` |
| Component | `pack/PascalName` | `azure/Login`, `pack-core/Button` |
| Guardrail | `pack/kebab-name` | `core/token-budget`, `aks/no-privileged-containers` |

## Registering a Pack

```typescript
import { packRegistry } from "@aks-kickstart/harness";
import { azurePack } from "@aks-kickstart/pack-azure";

packRegistry.register(azurePack);
packRegistry.seal();  // called once at server startup; no new registrations after this
```

## Creating a Pack

1. Create a new package under `packages/pack-{name}/`
2. Implement the `Pack` interface in `src/index.ts`
3. Add agents in `src/agents/*.agent.md`
4. Add skills in `src/skills/*.SKILL.md`
5. Add tools in `src/tools/*.ts`
6. Add user actions in `src/user-actions/*.ts` (for browser interactions)
7. Add components in `src/components/` (React renderers)
8. Register the pack in `packages/web/api/src/app.ts`

## Built-in Packs

| Pack | What it contributes |
|------|---------------------|
| `pack-core` | Base agents (triage, codesmith, reviewer), cross-cutting skills, core tools, full A2UI component catalog |
| `pack-azure` | Azure agents, ARM tools, MSAL user actions, Azure UI components |
| `pack-aks-automatic` | AKS deployment agents, manifest generation skills, safeguards |
| `pack-github` | GitHub agent, repo tools, OAuth user actions, GitHub UI components |

## UserActions vs Tools

| | Tool | UserAction |
|--|------|-----------|
| Requires browser? | No | Yes |
| Name sigil | `.` | `:` |
| Runner behavior | Inline result | Pause → browser → resume |
| Example | `azure.arm_get` | `azure:login` |

When a UserAction is called:
1. Runner pauses and emits `user_action_required` SSE event
2. Browser receives the event and renders the appropriate component (MSAL popup, OAuth flow, etc.)
3. Browser POSTs the typed result to `/api/converse/resume`
4. Runner resumes with the result

## Guardrails

Guardrails contributed by packs run at three stages in the Runner lifecycle:

```typescript
interface GuardrailContribution {
  id: string;   // e.g. "core/token-budget"
  stages: ("input" | "output" | "tool")[];
  evaluate(input: GuardrailInput): GuardrailResult;
}
```

Core guardrails run first and fail-closed. Pack guardrails run after core guardrails.

