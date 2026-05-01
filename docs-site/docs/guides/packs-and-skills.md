---
sidebar_position: 3
---

# Packs, Skills & Actions

Kickstart's modular architecture splits the harness from product knowledge. The harness in `packages/harness/` is domain-agnostic; **packs** carry every piece of product knowledge — agents, skills, tools, user actions, components, guardrails, and playground scenarios.

This guide is a one-page tour. For each contribution shape there is a dedicated reference page.

---

## The four bundled packs

| Pack | Module | What it owns |
|---|---|---|
| `core` | `packages/pack-core/` | Triage, codesmith, reviewer agents; bundled skills; the 27 basic + 13 rich components; `core.emit_ui`, `core.read_file`, `core.read_skill`, etc.; baseline guardrails (`core/no-credential-leak`, `core/no_pii_in_logs`, `core/no_secrets_in_artifacts`, `core/token_budget`). |
| `azure` | `packages/pack-azure/` | Azure architect & ops agents; ARM tools (`arm-deploy-resource`, `what-if`, `arm-update-resource`, `arm-delete-resource`, `arm-get`); `pricing-lookup`; `validate-bicep`; subscription / location / resource-group selectors. |
| `aks` | `packages/pack-aks-automatic/` | AKS architect & reviewer; KAITO model search; readiness skills; `safeguards.json` (static config — different from the runtime `SAFEGUARD_RULES`). |
| `github` | `packages/pack-github/` | GitHub publisher; OAuth tooling; PR / branch / repo helpers. |

Pack registration order is fixed: `core, azure, aks, github`. The active subset is filtered by the env var `KICKSTART_PACKS`.

---

## Agents

Agents live as Markdown files with frontmatter at `packages/<pack>/src/agents/<name>.agent.md`. The frontmatter shape mirrors `AgentContribution` (`packages/harness/src/types/agent.ts`):

```yaml
---
name: core.triage
description: …
model: { id: gpt-5.4 }
tools: [core.emit_ui, core.read_file, core.search_components]
handoffs:
  - label: AKS architecture
    agent: aks.architect
    prompt: |
      User is asking about AKS clusters; pass the typed handoff briefing.
asTools:
  - agent: aks.architect
    description: Consult mid-task without handing off.
    maxTurns: 3
---
{free-form instructionsBase here — what the agent does, how it talks, what it must never do}
```

Per-agent rules:

- `tools:` is a strict allowlist. `PackRegistry.getToolsForAgent(name)` returns exactly these.
- `handoffs[].agent` must resolve at `seal()` time. Cross-pack handoffs require `dependsOn` or `handoffTargets`.
- `asTools[]` exposes another agent as a bounded callable tool (default cap `AS_TOOL_MAX_TURNS_DEFAULT = 5`).
- `userInvocable` / `modelInvocable` flags separate "user can hand off to this agent" from "another agent can hand off to this agent".

---

## Skills

Skills live at `packages/<pack>/src/skills/<slug>/SKILL.md`. They are **per-agent prompt augmentations** — context the LLM should have when this agent runs.

Frontmatter shape:

```yaml
---
name: teach-then-ask
description: Pattern requiring agents to teach before they ask.
version: 0.1.0
x-kickstart:
  appliesTo: ["*"]            # agent-name globs
  keywords: [interaction, ux]
  priority: 75
---
{markdown body — exactly what the model receives, wrapped as <skill name="...">…</skill>}
```

Resolution rules (`runtime/skill-resolver.ts`, `runtime/skill-matcher.ts`, `runtime/token-budget.ts`):

- `appliesTo` globs must pass `validateGlobPattern` — shell metacharacters (`;|&$\``) are rejected.
- Empty / absent `appliesTo` matches all agents. `*` is a fast-path short-circuit.
- `fitSkillsInBudget` is greedy with **skip-on-overshoot** semantics — a small high-priority skill ranked after a large one still gets included.
- The per-turn skill-pull byte cap is configured via `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN` and enforced inside `core.read_skill`.

Bundled core skills include `a2ui-media-discipline`, `a2ui-output-discipline`, `collaborator-voice`, `file-generation-batching`, `gen-gha-workflow`, `phase-acceleration`, `teach-then-ask`. The full inventory is the auto-generated [Skills reference](../extending/skills-reference.md).

---

## Tools

`ToolContribution` (`packages/harness/src/types/tool.ts`) — full reference: [LLM tools](../extending/llm-tools.md).

```ts
export interface ToolContribution {
  name: string;            // "<pack>.<tool>"
  tool: SDKTool;           // @openai/agents tool() output
  mcpExposed?: boolean;    // appears in MCP manifest. Default: false.
  requiresSession?: boolean; // requires an active browser session — excluded from MCP entirely
}
```

Tools are *per-pack*, *per-agent-allowlist*. There is no global tool registry. Schema-strictness is enforced by `assertStrictlyConformant()` (see [Schema conformance](../architecture/schema-conformance.md)).

The full inventory with MCP/session flags is the auto-generated [Tools reference](../extending/tools-reference.md).

---

## User actions

`UserActionContribution` (`packages/harness/src/types/user-action.ts`) — full reference: [User actions](../extending/actions.md).

```ts
{
  name, wireName, description,
  parameters: ZodSchema,    // what the agent passes
  resultSchema: ZodSchema,  // what the client returns
  confirmComponent?: { component, props? },
  scopes?: string[],
  cancellation?: 'supported' | 'not-supported',
  mcpExposed?: boolean,
}
```

The runner pauses on `user_action_req`, the SPA / MCP client collects input, and `/api/converse/resume` validates the result against `resultSchema` (the resume schema-validation gate). Compare-and-swap on `pendingUserAction` makes duplicate replay safe.

---

## Components

`ComponentContribution` (`packages/harness/src/types/component.ts`) — full guide: [Custom catalog](../components/custom-catalog.md) and [Extending the A2UI component system](../components/extending-a2ui.md).

```ts
{
  name: string,            // "<pack>/<ComponentName>"
  propertySchema: ZodSchema,
  renderer: unknown,       // SPA-side React renderer
  llmHint?: string,        // injected into the system prompt (#1130)
}
```

---

## Guardrails

`GuardrailContribution` (`packages/harness/src/types/guardrail.ts`) — full reference: [Guardrails](../extending/guardrails.md).

```ts
{
  id: '<pack>/<rule>',     // 'core/' is reserved for the core pack
  appliesTo: string[],     // agent-name globs
  stages: ['input' | 'tool' | 'output'],
  evaluate(input): Promise<{ verdict: 'pass' | 'block' | 'redact', ... }>,
}
```

Engine invariants: fail-closed on throw, opaque SSE codes, `core/` always wins, tool-stage block halts the turn. `KICKSTART_GUARDRAILS_DISABLED=true` is dev-only.

---

## Playground scenarios

Pack-contributed via `pack.playgroundScenarios[]` and `pack.playgroundStubs`. Surfaced to the SPA through `/api/packs` (`PlaygroundScenarioDTO`). Stubs only resolve when `KICKSTART_PLAYGROUND=true`. See [Playground scenarios](../extending/playground-scenarios.md).

---

## Lifecycle

`PackRegistry`:

1. `register(pack)` — normalise contributions, load agents (`*.agent.md`) and skills (`SKILL.md`), validate uniqueness, cycle-check `dependsOn`.
2. `enable(names)` — pick active packs (filtered by `KICKSTART_PACKS`).
3. `seal()` — validate every handoff target, snapshot+freeze playground stubs, reserve `core/` namespace.

After `seal()` any further `register()` throws.

---

## Adding a pack

1. Scaffold `packages/pack-<yourpack>/src/index.ts` exporting your `Pack`.
2. Author agents (`agents/*.agent.md`), skills (`skills/<slug>/SKILL.md`), and contributions.
3. Add the pack to the API and MCP bootstraps (`packages/web/api/src/startup/packs.ts`, `packages/mcp-server/src/startup/packs.ts`).
4. Add it to `KICKSTART_PACKS` (or leave the env var empty for all).
5. Run `npm test -w packages/pack-<yourpack>` — strict-mode schema conformance and handoff resolution must pass before boot.
