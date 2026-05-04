---
sidebar_position: 8
---

# Guardrails

Kickstart enforces content safety through a guardrail pipeline that runs at three stages on every turn — `input` (before the LLM sees user text), `tool` (before each tool call), and `output` (before assistant text leaves the runner). The engine lives in `packages/harness/src/runtime/guardrails.ts`. Pack-contributed rules implement the `GuardrailContribution` interface from `packages/harness/src/types/guardrail.ts`.

For deployment-time YAML safeguards (the AKS Automatic linter), see [Safeguards](./safeguards.md). The two systems are deliberately separate.

---

## Contribution shape

```ts
// packages/harness/src/types/guardrail.ts
export interface GuardrailContribution {
  id: string;                      // "{packId}/{guardrailId}", e.g. "core/no-credential-leak"
  appliesTo: string[];             // agent-name globs ("*" = all)
  stages: Array<'input' | 'output' | 'tool'>;
  evaluate(input: GuardrailInput): Promise<GuardrailResult>;
}

export interface GuardrailResult {
  verdict: 'pass' | 'block' | 'redact';
  reason?: string;                 // server-side only — NEVER emitted in SSE
  redacted?: unknown;              // for redact verdict (replaces stage payload)
  redactedArgs?: Record<string, unknown>; // structured tool-arg replacement
}
```

`appliesTo` patterns are validated at registration; shell metacharacters (`;|&$\``) are rejected by the same `validateGlobPattern` used for skill `appliesTo`.

---

## Bundled rules

| Pack | Rule id | Stages |
|---|---|---|
| `core` | `core/no-credential-leak` | `output` |
| `core` | `core/no_pii_in_logs` | `output` |
| `core` | `core/no_secrets_in_artifacts` | `output` |
| `core` | `core/token_budget` | `input`, `output` |
| `azure` | `azure/no-hardcoded-credentials` | `output`, `tool` |
| `azure` | `azure/no-subscription-scoped-owner` | `tool` |
| `azure` | `azure/no-privileged-operations` | `tool` |
| `azure` | `azure/require-subscription-scope` | `tool` |
| `aks` | `aks/no-hostpath-volumes` | `output` |
| `aks` | `aks/no-latest-tag` | `output` |
| `aks` | `aks/no-privileged-containers` | `output` |
| `aks` | `aks/require-resource-limits` | `output` |
| `github` | `github/no-secret-exposure` | `output`, `tool` |

Rule sources: `packages/pack-core/src/guardrails/`, `packages/pack-azure/src/guardrails/`, `packages/pack-aks-automatic/src/guardrails/`, `packages/pack-github/src/guardrails/`.

---

## Engine semantics

The header comment of `guardrails.ts` lists the security invariants the engine guarantees:

- **`core/` always wins** — `core/` rules run first and a `block` verdict is non-overridable.
- **Fail-closed** — every thrown `evaluate()` becomes a `block`.
- **Payload coercion errors block** — if `applyRedact()` cannot apply the proposed redaction, the engine blocks.
- **Opaque SSE** — `error` frames look like `{ code: 'GUARDRAIL_BLOCK', message: '…' }`. The id, reason, pattern, and stage never leak.
- **Tool-stage block stops the turn** — a single tool-stage block halts all remaining tool calls in the turn.
- **Dual-eval chaining** — each guardrail runs against the current (possibly already-redacted) payload so downstream rules see the cleaned form.

### Parallel SDK adapters (input + output)

The runner wraps `GuardrailContribution`s with `toSdkInputGuardrail()` / `toSdkOutputGuardrail()` so input and output rules execute concurrently inside the SDK pipeline (`Promise.all`). Behaviour:

- `block` → `tripwireTriggered: true` (SDK throws `InputGuardrailTripwireTriggered`).
- `redact` → `tripwireTriggered: false` + emits `guardrail_warn` SSE + the redacted text is stored in `outputInfo` so the runner can update `session.recentTurns` after the SDK run completes.
- Dual-eval chaining is intentionally relaxed inside the parallel adapters in exchange for latency (DP #116 trade-off).

### Sequential pipeline (tool stage)

`runGuardrails()` is the sequential pipeline used at tool stage because `@openai/agents` has no tool-arg hook. It returns `RunGuardrailsResult = { blocked, mutatedInput }`. `redactedArgs` lets a tool-stage rule replace structured args; `applyRedact()` does the in-place mutation.

---

## Glob matching

The engine uses a tiny glob (no external dep) that supports `*`, `?`, and exact strings. `appliesTo: ["*"]` is the universal match. Glob errors at registration time include the offending pack id and rule id so a grep on either surfaces the offender.

---

## SSE events

| Event | Trigger | Payload |
|---|---|---|
| `error` | `block` verdict (any stage) | `{ code: 'GUARDRAIL_BLOCK', message }` — opaque |
| `guardrail_warn` | `redact` verdict (input or output) | `{ stage }` — no rule id |

These are the only two SSE event types guardrails emit. Tool-stage blocks halt the turn and surface as a generic `error`.

---

## Authoring a custom rule

```ts
import type { GuardrailContribution } from '@aks-kickstart/harness';

export const noClusterDestroy: GuardrailContribution = {
  id: 'mypack/no-cluster-destroy',
  appliesTo: ['aks.*'],
  stages: ['tool'],
  async evaluate(input) {
    if (input.toolName === 'aks.delete_cluster') {
      return { verdict: 'block', reason: 'Hard-deny on cluster delete' };
    }
    return { verdict: 'pass' };
  },
};
```

Add it to `pack.guardrails[]`. Pack registration validates that:

- The id namespace matches the pack name (the `core/` namespace is reserved for the core pack — registry rejects others at `register()`).
- Every `appliesTo` pattern passes `validateGlobPattern`.

---

## Dev override

`KICKSTART_GUARDRAILS_DISABLED=true` bypasses guardrail evaluation (the current runtime short-circuits guardrail rules to `pass` when set). **Development only** — there is no startup hard block today, so production environments must leave this env var unset.

---

## Telemetry

Guardrail decisions are emitted as App Insights custom events (rule id + verdict + stage), but never as part of any SSE frame the browser sees. Use the OTel bridge channel for live debugging — see [Observability](../operations/observability.md).
