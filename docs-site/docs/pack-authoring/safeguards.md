---
title: Safeguards
sidebar_position: 9
---

# Safeguards

Kickstart ships a static-analysis layer for Kubernetes manifests that
detects AKS-Automatic-incompatible patterns and applies deterministic
fixes for the safe ones. The layer is reachable from agents through two
core tools and runs entirely server-side. There is no shell, no Helm
template, no Kustomize build — only safe YAML parsing and pure object
inspection.

This page describes what safeguards exist today, how they are exposed
to agents and packs, and what the security envelope looks like. The
implementation lives in
[`packages/pack-core/src/safeguards/`](https://github.com/azure-management-and-platforms/kickstart/tree/main/packages/pack-core/src/safeguards).

## When safeguards run

Safeguards are agent-driven. They are not invoked automatically on
generated manifests; an agent must call `core.check_safeguards` (and,
optionally, `core.fix_safeguards`) explicitly as part of the
deployment-prep flow.

This is intentional. It keeps the tool surface deterministic from the
agent's point of view — agents that emit manifests own the decision to
validate them — and it prevents the runtime from silently rewriting
content the user has not seen.

## Tool surface

Two `ToolContribution` exports register the surface in the core pack.
Both are defined in
[`packages/pack-core/src/tools/`](https://github.com/azure-management-and-platforms/kickstart/tree/main/packages/pack-core/src/tools):

| Tool                      | File                          | Behaviour                                                                                                                |
|---------------------------|-------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `core.check_safeguards`   | `tools/check_safeguards.ts`   | Parse a YAML manifest, evaluate every rule in `SAFEGUARD_RULES`, return a structured `CheckResult` with severity counts. |
| `core.fix_safeguards`     | `tools/fix_safeguards.ts`     | Accept a manifest plus a list of violation IDs; rewrite only the allowlisted, auto-fixable rules; return the new YAML.   |

Both tools share the same input bounds (see _Security envelope_ below)
and never throw — failures surface as structured fields on the result.

### `core.check_safeguards`

Inputs:

- `manifest` — raw YAML manifest text. Single or multi-document. Must
  be at least one byte and at most `MAX_INPUT_BYTES` (2 MB). Supported
  kinds: `Pod`, `Deployment`, `StatefulSet`, `DaemonSet`, `ReplicaSet`,
  `Job`, `CronJob`.

The tool calls `checkSafeguards(manifest)` from
`packages/pack-core/src/safeguards/check.ts`, which:

1. Parses with the safe loader from the
   [`yaml`](https://www.npmjs.com/package/yaml) package via
   `parseManifest` (`packages/pack-core/src/safeguards/parser.ts`).
2. Walks every parsed document against every rule in `SAFEGUARD_RULES`.
3. Produces a `CheckResult`:

   ```ts
   interface CheckResult {
     ok: boolean;
     violations: SafeguardViolation[];
     summary: { high: number; medium: number; low: number };
     parseError?: string;
   }
   ```

If the manifest fails to parse (bad YAML, exceeds bounds, etc.),
`ok: false` is returned with `parseError` populated and an empty
`violations` array. No partial results are returned.

### `core.fix_safeguards`

Inputs:

- `manifest` — same shape and limits as above.
- `ids` — array of violation IDs the agent wants to fix, capped at
  `MAX_VIOLATION_IDS` (50) per call.

The tool calls `applyFixes(manifest, ids)` from
`packages/pack-core/src/safeguards/fixes.ts`. Only IDs in the
**fix allowlist** are processed; any ID outside the allowlist is
returned in the `skipped` list with the reason `not_in_allowlist`.

The current fix allowlist (see `FIXABLE_IDS` in `fixes.ts`):

```text
privileged-container
hostpath-volume
host-network
host-pid
host-ipc
missing-resource-limits
missing-resource-requests
```

When `missing-resource-limits` or `missing-resource-requests` is fixed,
the rewriter inserts the defaults from `DEFAULT_LIMITS`
(`cpu: 500m`, `memory: 256Mi`) and `DEFAULT_REQUESTS` (`cpu: 100m`,
`memory: 128Mi`). Existing values are never overwritten.

The fixer returns:

```ts
interface FixResult {
  ok: boolean;
  manifest: string;          // YAML (re-stringified by the `yaml` library)
  applied: string[];         // IDs successfully fixed
  skipped: { id: string; reason: string }[];
  remaining: SafeguardViolation[]; // violations still present after the rewrite
  parseError?: string;
}
```

## Rule taxonomy

The runtime ruleset is the array `SAFEGUARD_RULES` in
[`packages/pack-core/src/safeguards/rules.ts`](https://github.com/azure-management-and-platforms/kickstart/blob/main/packages/pack-core/src/safeguards/rules.ts).
Each rule is a `SafeguardRule`:

```ts
interface SafeguardRule {
  id: string;            // stable kebab-case ID
  title: string;         // human-readable title
  severity: 'high' | 'medium' | 'low';
  message: string;       // explanation of the problem
  msprLink: string;      // attribution to the originating Microsoft PR
  autoFixable: boolean;  // whether a deterministic fix exists
  check: (doc: Record<string, unknown>) => string[]; // returns violation paths
}
```

The rule IDs currently shipped are:

| ID                              | Severity | Auto-fixable |
|---------------------------------|----------|--------------|
| `privileged-container`          | high     | yes          |
| `hostpath-volume`               | high     | yes          |
| `host-network`                  | high     | yes          |
| `host-pid`                      | high     | yes          |
| `host-ipc`                      | high     | yes          |
| `missing-resource-limits`       | medium   | yes          |
| `missing-resource-requests`     | medium   | yes          |
| `run-as-root`                   | medium   | no           |
| `mutable-root-filesystem`       | low      | no           |

Severity is informational — the tools do not refuse to return results
based on it. Deployment gating is the agent's responsibility; the
safeguards layer only reports.

The `msprLink` field on each rule attributes the rule to the originating
Microsoft AKS-Copilot pull request (PRs #1837 and #1976) that the
ruleset was ported from. The link is for traceability, not for runtime
behaviour.

### Why not every rule is auto-fixable

Rules like `run-as-root` and `mutable-root-filesystem` are detection-only
because the safe fix is workload-specific. Forcing `runAsNonRoot: true`
on an image whose entrypoint requires UID 0, or mounting `/` read-only
on a container that expects to write to `/tmp`, can break the workload
in ways static analysis cannot predict. Detection without fix gives the
agent enough information to ask the user.

## Security envelope

Every input is bounded by constants in
`packages/pack-core/src/safeguards/parser.ts`:

| Bound                  | Value                | What it prevents                                                  |
|------------------------|----------------------|-------------------------------------------------------------------|
| `MAX_INPUT_BYTES`      | 2 × 1024 × 1024 (2 MB) | Memory exhaustion from oversized manifest text.                  |
| `MAX_DOCUMENT_COUNT`   | 50                   | Multi-doc manifests with adversarial document counts.             |
| `MAX_NESTING_DEPTH`    | 64                   | Stack overflow from deeply nested YAML.                           |
| `MAX_ALIAS_COUNT`      | 100                  | Billion-laughs alias-expansion attacks.                           |
| `MAX_VIOLATION_IDS`    | 50 (`fix_safeguards`) | Adversarial fix-list sizes.                                      |

The parser uses `parseAllDocuments` from the `yaml` package without
custom tags. There is no `eval`, no shell, no template engine. Both
tools wrap their work in try/catch at the contribution boundary and
surface failures as structured fields rather than thrown exceptions.

The fix path is allowlist-only. There is no runtime way for an agent
to request a fix for a rule that is not in `FIXABLE_IDS`. Adding a new
auto-fix is a code change to `fixes.ts` and the allowlist, not a
configuration change.

## Cross-references

- [Extending — guardrails](./guardrails.md) — the request/response
  guardrail layer that runs around every model call. Different surface,
  different concerns; safeguards are about generated artefacts, not
  about model I/O.
- [Architecture — MCP server internals](../architecture/mcp-server-internals.md)
  — for how `mcpExposed` controls whether these tools are reachable
  over MCP. (`core.check_safeguards` and `core.fix_safeguards` follow
  the standard pack opt-in policy.)
