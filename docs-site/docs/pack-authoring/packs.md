---
sidebar_position: 4
---

# Packs

A **pack** is the unit of extensibility in Kickstart. It bundles agents, skills, tools, user actions, components, guardrails, and playground scenarios into a single deployable module. The harness is domain-agnostic; packs carry every piece of product knowledge.

---

## Bundled packs

| Name | Directory | Owns |
|---|---|---|
| `core` | `packages/pack-core/` | Triage, codesmith, reviewer, the 27 basic + 13 rich components, baseline guardrails, `core.emit_ui` and friends. |
| `azure` | `packages/pack-azure/` | Azure architect & ops agents; ARM tools (`arm-deploy-resource`, `what-if`, `arm-update-resource`, `arm-delete-resource`, `arm-get`); cost estimation; pricing lookup; bicep validation; subscription / location / resource selectors. |
| `aks` | `packages/pack-aks-automatic/` | AKS architect & reviewer; KAITO model search; cluster-readiness skills; safeguards.json (static config — different from the runtime `SAFEGUARD_RULES`). |
| `github` | `packages/pack-github/` | GitHub publisher; repo / branch / PR tooling. |

Pack source declaration is `Pack` from `packages/harness/src/types/pack.ts`:

```ts
export interface Pack {
  name: string;
  version: string;
  dependsOn?: string[];
  handoffTargets?: string[];
  agentsDir?: URL;            // load *.agent.md from disk
  agents?: AgentContribution[];
  skillsDir?: URL;            // load skills/<slug>/SKILL.md from disk
  skills?: Skill[];
  tools?: ToolContribution[];
  userActions?: UserActionContribution[];
  components?: ComponentContribution[];
  guardrails?: GuardrailContribution[];
  playgroundScenarios?: PlaygroundScenario[];
  playgroundStubs?: Record<string, PlaygroundStub>;
}
```

A reference pack assembly lives in `packages/pack-core/src/core-pack.ts`.

---

## Lifecycle

`PackRegistry` (`packages/harness/src/runtime/registry.ts`) drives pack lifetime:

1. `register(pack)` — validates the pack name; normalises tools / user actions / components / guardrails / scenarios; loads agents (`*.agent.md`) and skills (`SKILL.md`) from `agentsDir` / `skillsDir`; performs uniqueness checks; checks `dependsOn` cycles.
2. `enable(names)` — sets the active pack list (filtered by `KICKSTART_PACKS`).
3. `seal()` — validates every handoff target across active packs (#1073, three-token error messages: pack, agent, target); snapshots playground stubs into a frozen object; reserves the `core/` namespace for the core pack.

After `seal()` any further `register()` throws.

---

## Loading order

Pack registration is fixed: **`core, azure, aks, github`**. The order matters because `dependsOn` / `handoffTargets` checks happen at register-time, and core declares `dependsOn: ['aks', 'azure', 'github']` (Phase B hotfix #1113).

Active packs are filtered by the env var `KICKSTART_PACKS` (comma-separated). An empty value enables all four.

---

## Cross-pack handoff & tool reuse

Handoffs to agents in another pack are rejected unless the source pack lists the target in `dependsOn` *or* `handoffTargets`. The two are not equivalent:

- `dependsOn` — full trust: the dependency's tools and user actions are visible to the dependent pack's agents (handoff target trust extended for free).
- `handoffTargets` — narrow: handoffs only. No tool / user-action visibility.

`assertNoCycles()` enforces that `dependsOn` is a DAG.

---

## Adding a pack

1. Create `packages/pack-<yourpack>/` with `src/index.ts` exporting your `Pack` object.
2. Add agents under `src/agents/<name>.agent.md` (markdown front matter + body). See an example like `packages/pack-core/src/agents/triage.agent.md`.
3. Add skills under `src/skills/<slug>/SKILL.md`.
4. Add tools as `ToolContribution` objects — see [LLM tools](./llm-tools.md).
5. Add user actions, components, and guardrails as needed — see [Actions](./actions.md), [Components → Custom catalog](../components/custom-catalog.md), and [Guardrails](./guardrails.md).
6. Register the pack in the API and MCP bootstraps:
   - `packages/web/api/src/startup/packs.ts`
   - `packages/mcp-server/src/startup/packs.ts`
7. Add your pack name to the `KICKSTART_PACKS` env var (or leave empty for all).
8. Run pack tests — `npm test -w packages/pack-<yourpack>` — to validate strict-mode schema conformance and handoff resolution before booting the API.

---

## What's auto-generated

The reference pages [Tools reference](./tools-reference.md) and [Skills reference](./skills-reference.md) are produced by scripts in `docs-site/scripts/` by walking pack source files: `packages/pack-*/src/tools/*.ts` for tools and `packages/pack-*/src/skills/**/SKILL.md` (including `*.SKILL.md`) for skills. Update the source, run `npm --prefix docs-site run build`, and the docs reflect the change.
