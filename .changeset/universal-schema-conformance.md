---
"@aks-kickstart/harness": minor
"@aks-kickstart/pack-core": patch
"@aks-kickstart/pack-azure": patch
"@aks-kickstart/pack-aks-automatic": patch
"@aks-kickstart/pack-github": patch
"@aks-kickstart/api": patch
---

Make OpenAI strict-mode schema conformance universal across every pack.

Promotes the per-pack `tool-strict-mode-conformance` /
`tool-strict-required-conformance` / `tool-schema-validation` walkers
that previously only covered pack-core into a single shared helper at
`@aks-kickstart/harness/runtime/schema-conformance` (also re-exported
from the harness barrel). The walker validates the four OpenAI
strict-mode invariants in one place:

  I1 — every `{ type: "object" }` node carries a `properties` key.
  I2 — every property declared on an object node appears in `required`.
  I3 — every `{ type: "object" }` node sets `additionalProperties: false`.
  I4 — every property schema has a `type` key or a recognised combinator
       (`oneOf`/`anyOf`/`allOf`/`$ref`/`const`/`enum`).

`PackRegistry` now exposes public `tools` and `userActions` accessors so
tests can enumerate the active set without hand-maintaining rosters. A
new universal test at
`packages/web/api/src/startup/schema-conformance.test.ts` loads packs
through the real `getRegistry()` startup path and runs the helper
against every discovered tool and user action — picking up new
contributions from any pack automatically.

The per-pack hand-rostered conformance suites in pack-core have been
collapsed into a single `emit-ui-strict-mode.test.ts` that retains only
the regression-specific assertions (#998 `sendDataModel` discriminated
branch; #1032 nullable `payload` wrapper; T4 negative control proving
the walker still flags `z.record(...)` shapes).

Surfaced strict-mode violations have been fixed in the offending
schemas:

* `core.inspect_repo` — `remoteUrl` / `localPath` are now
  `.nullable().optional()` (I2).
* `aks.build_architecture_diagram` — every optional plan field on
  `PlanNodePool` / `PlanWorkload` / `PlanIngress` / `PlanStorage` /
  `PlanKaito` / `PlanFoundry` / `PlanCiCd` and the top-level `plan`
  shape is now `.nullable().optional()` (I2).
* `azure.arm_deploy_resource.body`, `azure.arm_update_resource.patch`,
  `azure.what_if.template` / `.parameters`, `github.api_get.params`,
  `azure:deploy-resource.body`, `azure:update-resource.patch`,
  `azure:deploy.template` / `.parameters` — moved from
  `z.record(z.string(), …)` to `z.string()` (JSON-encoded object) and
  parsed inside `execute()`. This is the OpenAI-recommended pattern for
  free-form objects under strict-mode (I1, I3).
* All remaining `.optional()` parameters across pack-azure /
  pack-aks-automatic / pack-github user actions
  (`select_subscription.reason` / `.preferredSubscriptionId`,
  `aks:deploy.namespace` / `.manifests` / `.deploymentSummary` /
  `.safeguardReport`, `github:login.reason`, `pick_org.reason`,
  `pick_repo.reason`, `create_repo.suggestedName` / `.private`,
  `create_pr.prBody`, `set_secret.hint`) gained `.nullable()` (I2).

For the LLM, the migration to JSON-string `body` / `patch` / `template`
/ `parameters` / `params` is the only behavioural change: the model is
now expected to pass these as JSON-encoded strings instead of inline
objects. Inline objects are no longer part of the contract for these
fields; the affected tools' `execute()` paths parse the provided JSON
strings (and reject non-object decodings with a tool-level error).
