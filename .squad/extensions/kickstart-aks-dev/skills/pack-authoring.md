# Pack Authoring

**When to use:** you are adding, modifying, or removing a Pack, Agent, Skill, Tool, UserAction, Component, or Guardrail.

## Context

Kickstart v2 is a harness plus packs. The harness never contains domain knowledge. Packs are the only place where domain logic, prompts, and Azure/GitHub/AKS specifics live. This skill defines the rules for authoring them.

See [`docs/v2-implementation-brief.md`](../../../../docs/v2-implementation-brief.md) for full architecture.

## Primitives and their files

| Primitive | File convention | Registration |
|-----------|-----------------|--------------|
| **Pack** | `packages/pack-<name>/src/index.ts` exports `pack` | `harness.register(pack)` at startup |
| **Agent** | `.agent.md` under the pack's `agentsDir` (one per file) | Auto-scanned from `agentsDir`, or listed explicitly in the pack's `agents` array |
| **Skill** | `SKILL.md` under the pack's `skillsDir` (e.g. `packages/pack-<name>/src/skills/<skill-name>/SKILL.md`) | Auto-scanned from `skillsDir`, or listed explicitly in the pack's `skills` array |
| **Tool** | TypeScript function built with `tool({ name, parameters, execute })` | Declared in the pack's `tools` array |
| **UserAction** | TypeScript function built with `userAction({ name, parameters, execute, confirmComponent })` (wraps the SDK's interrupt/resume contract) | Declared in the pack's `userActions` array |
| **Component** | React renderer + `defineComponent({ name, schema, renderer })` | Declared in the pack's `components` array |
| **Guardrail** | TypeScript config object | Declared in the pack's `guardrails` array |

## Naming and sigils

- **Tools** use dot: `azure.list_resource_groups`, `core.emit_ui`, `github.get_workflow_runs`
- **User actions** use colon: `azure:select_subscription`, `aks:confirm_deploy` (wire-transliterated to `pack__verb_noun`)
- **Components** use slash + PascalCase: `core/Card`, `azure/CostSummary`, `aks/ProgressTree`

The pack name is the prefix. Never ship an unprefixed tool, action, or component.

## Agent authoring (`.agent.md`)

- Use the VS Code custom agent front-matter (`---name:`, `---description:`).
- The body is the system prompt plus any skill references.
- Reference skills by path: `.skills/skill-name/SKILL.md`.
- Agents declare which tools they can call. If a tool is not in the allow-list, calling it is a guardrail violation.
- Keep agent prompts short. Domain knowledge lives in the skills the agent composes, not the agent body.

## Skill authoring (`SKILL.md`)

- Use the agentskills.io format: frontmatter with `name`, `description`, and optional `inputs`/`outputs`.
- The body is a runbook: when to use, steps, failure modes.
- Skills are composable. Agents reference skills, skills may reference other skills, but avoid deep chains.
- A skill must be testable. If it cannot be exercised by an automated check, it should be broken into smaller skills.

## Tool authoring

- Every tool has a typed schema. Use `zod` or the SDK's schema helper.
- Tool parameters are the **security surface**. A widening of accepted args requires Zapp review.
- Tools must be idempotent when the underlying operation is idempotent. If not, declare it in the tool description.
- Tools return structured output the agent can reason over. Do not return "success" as a string.
- Long-running tools stream progress through `core.emit_ui`.

## User actions

- A user action is declared via `userAction({ ... })`, which wraps the SDK's interrupt/resume contract. Do not hand-roll `interrupt: true` on a plain `tool()`.
- When invoked, the Runner pauses and the harness emits a `user_action_required` SSE event. The client renders the declared `confirmComponent`, performs the work (MSAL popup, GitHub OAuth, etc.), and POSTs a typed result back to `/api/converse/resume`.
- Resume payloads are typed. Never accept an unvalidated shape back from the client.
- Timeout and cancellation behaviour (default queue, opt-in `cancellation: "supported"`) are declared in the pack.

## Components (A2UI)

- Every component has a manifest describing its props, variants, and accepted data shapes.
- Components render with Fluent UI React v9 primitives only.
- Components are pure: no fetches, no effects that hit the network, no timers beyond animation.
- Data arrives via props emitted by `core.emit_ui`. Actions go out through the A2UI `action.event` contract.

## Guardrails

- Guardrails are declared data, not runtime patches. A pack declares which tools it gates, which output shapes it rejects, and which prompts it injects.
- Guardrails run before and after every agent call. A failed guardrail produces a structured error the harness surfaces as an `error` SSE event.

## Registration rules

- Packs register at harness startup. After startup, the registry is sealed.
- A pack that depends on another pack declares it in `dependencies`. Circular deps are a bug the harness refuses.
- Two packs may not register primitives with the same fully-qualified name. The harness refuses startup.

## Testing

- Every pack has a `src/__tests__/` with at least:
  - A **conformance test** that asserts every declared primitive round-trips through the registry.
  - A **contract test** per tool that pins its schema and a smoke behaviour.
  - A **component test** per component that renders it with sample props.
- Add the pack to the playground's registry fixture so it shows up in local dev.

## Changing a pack's public surface

- Renaming or removing a tool, user action, or component is a **breaking change**. Bump major, add a deprecation note, update `docs-site/docs/extending/<pack>.md`.
- Adding new primitives is a **minor** bump.
- Changing an existing tool's schema in a non-breaking way (adding optional args) is a **patch** bump.

## Checklist before opening a PR

- [ ] New primitives follow the naming sigils.
- [ ] `.agent.md` / `SKILL.md` formats respected.
- [ ] Tool schemas reviewed by Zapp if they widen access.
- [ ] Conformance test added or updated.
- [ ] Pack doc page updated (`docs-site/docs/extending/<pack>.md`).
- [ ] Changeset added describing user impact.
