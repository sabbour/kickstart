---
sidebar_position: 3
---

# ADR-0003: SDK-Native Parallel Guardrail Pipeline

**Date:** 2026-04-27  
**Status:** Accepted  
**Deciders:** Ahmed Sabbour (Lead), Squad  
**Affects:** `packages/harness/src/runtime/runner.ts`, `packages/harness/src/runtime/guardrails.ts`

## Context

Kickstart's guardrail pipeline intercepts every conversation turn to detect PII and credential leaks (see [Guardrails guide](../../extending/guardrails.md)). Before this ADR, guardrails ran **sequentially** inside `Runner.run()`:

```
→ runGuardrails('input')   ← sequential, blocks LLM start
→ LLM run
→ runGuardrails('output')  ← sequential, blocks response delivery
```

This worked correctly but had two drawbacks:

1. **Latency:** Sequential guardrail checks added serial overhead before and after every LLM call.
2. **Framework mismatch:** The OpenAI Agents SDK has a native `InputGuardrail` / `OutputGuardrail` pipeline that runs guardrails in parallel. Using the SDK's pipeline lets the SDK manage execution, error propagation, and future optimisations.

## Decision

**Migrate guardrail execution to the SDK's native parallel pipeline via adapter factories.**

The new `toSdkInputGuardrail()` and `toSdkOutputGuardrail()` adapters wrap any `GuardrailContribution` as an SDK `InputGuardrail` or `OutputGuardrail`. The runner attaches them to the `Agent` instance at `buildAgentInstance()` time and removes the manual `runGuardrails()` calls.

```typescript
// guardrails.ts
export function toSdkInputGuardrail(contrib: GuardrailContribution): InputGuardrail { ... }
export function toSdkOutputGuardrail(contrib: GuardrailContribution): OutputGuardrail { ... }
```

Verdict mapping:
- `block` → SDK tripwire triggered (throws `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`)
- `redact` → emits `guardrail_warn` SSE event + records in `outputInfo`; execution continues
- `pass` → no-op
- throw → fail-closed (treated as `block`)

`runInParallel: false` is set on input guardrails to ensure all checks complete before the LLM starts (security invariant preserved).

## Tradeoff: Input Redaction vs. LLM Visibility

**This is the key behavioural tradeoff accepted with this ADR.**

With the SDK parallel pipeline, **the LLM receives the original (unredacted) user message**. The session's `recentTurns` is updated after the run by inspecting `result.inputGuardrailResults`.

| Behaviour | Sequential (before) | SDK-native (after) |
|-----------|--------------------|--------------------|
| LLM sees | Redacted input | Original input |
| `recentTurns` stored | Redacted | Redacted (post-run) |
| PII blocked entirely | `verdict: block` | `verdict: block` ✅ |
| PII redacted from logs | ✅ | ✅ (post-run) |
| Latency | Serial overhead | Parallel overhead |

**Implication for guardrail authors:** If you need to prevent the LLM from ever seeing a value, use `verdict: 'block'`. A `verdict: 'redact'` on input will remove the value from stored history but not from the live LLM context.

## Alternatives Considered

### Keep sequential pipeline
Rejected: misses the SDK's parallel execution model and future SDK optimisations. Also creates maintenance burden as SDK evolves.

### Hybrid: SDK output guardrails + sequential input guardrails
Rejected: inconsistency makes the mental model harder. The accepted tradeoff (documented above) is manageable and acceptable given the existing `block` escape hatch.

## Consequences

- **Positive:** Guardrails now benefit from SDK parallel execution and error propagation.
- **Positive:** No manual `runGuardrails()` calls in `runner.ts` — cleaner, fewer failure modes.
- **Positive:** Tool-stage guardrails (`runGuardrails('tool')`) are unchanged — SDK has no tool-arg hook.
- **Neutral → Accepted:** Input `redact` verdicts no longer prevent LLM from seeing the original message. Documented and accepted.
- **Negative (mitigated):** Existing tests for `history-threading` required updating to reflect the post-run redaction timing.
