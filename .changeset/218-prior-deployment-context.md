---
"@aks-kickstart/pack-core": patch
---

Add `priorDeploymentContext` session-state mechanism for iteration scenarios (#218).

- **Schema**: `PriorDeploymentContextSchema` added to `handoff-schema.ts` with fields
  `lastRecipe`, `lastHandoffTarget`, `workspaceStateFile`, `summary`. The `IterationContext`
  block gains an optional `priorDeploymentContext` slot for downstream agents to consume.
- **Tool**: `core.priorDeploymentContext` reads `.kickstart/state.json` and returns
  `{ found: true, context }` when a prior deployment exists, or `{ found: false }` on first
  run. Path is hard-coded (no caller-supplied path) — no new traversal surface.
- **Triage agent**: `core.priorDeploymentContext` added to frontmatter. Mode-1 (iteration)
  now calls the tool first; when `found: true`, it populates `iteration.priorDeploymentContext`
  directly and skips onboarding questions.
- **Tests**: Unit tests for schema shape, `extractPriorDeploymentContext` helper, and the
  tool `execute` path (found/not-found/missing-fields/invalid-JSON).

Closes #218.
