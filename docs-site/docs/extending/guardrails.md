---
sidebar_position: 8
---

# Guardrails

Kickstart enforces content safety through a **guardrail pipeline** that runs on every turn — before the LLM sees user input and after the LLM produces output. This guide covers the built-in rules, the SSE events guardrails emit, the dev kill-switch, and how to add custom rules.

## Built-in Rules

### `core/no-pii`

Detects and **redacts** personally identifiable information. Applies to both input (user messages) and output (assistant messages and tool results).

Patterns covered:

| Pattern | Example | Notes |
|---------|---------|-------|
| Email address | `user@example.com` | RFC-style local@domain |
| Phone number | `+1-800-555-0100` | US/international formats |
| US SSN | `123-45-6789` | `NNN-NN-NNNN` pattern |
| Azure Subscription ID | `12345678-1234-1234-1234-123456789abc` | GUID gated by 60-char keyword window |
| AAD Object ID | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` | GUID gated by 60-char keyword window |

**GUID context gating:** Azure Subscription ID and AAD Object ID patterns require a context keyword (e.g., `subscriptionId`, `tenantId`, `objectId`) within 60 characters of the GUID to reduce false positives on non-sensitive GUIDs.

#### Backward-compatibility alias

`noPiiInLogsGuardrail` remains exported as an alias for the new `core/no-pii` rule. Existing code that registers `noPiiInLogsGuardrail` continues to work unchanged.

---

### `core/no-credential-leak`

Detects and **redacts** secrets and credentials. Applies to both input and output.

Patterns covered:

| Pattern | Example |
|---------|---------|
| API key header | `api-key: sk-abc123...` |
| Connection string | `AccountKey=base64==` |
| SAS token | `SharedAccessSignature sig=...` |
| Azure Subscription Key | `SubscriptionKey=abcdef...` |
| Azure Client Secret | `ClientSecret=abc123...` |
| ARM Bearer token | `Bearer eyJ0...` (explicit, non-JWT) |
| Postgres/SQL DSN password | `postgres://user:password@host/db` |

---

## SSE Events

When a guardrail redacts content (verdict: `redact`), the runner emits a `guardrail_warn` event over the SSE stream:

```
event: guardrail_warn
data: {"rule":"core/no-pii","stage":"input","redacted":true}
```

When a guardrail blocks the turn entirely (verdict: `block`), a `guardrail_block` event is emitted and the turn is aborted:

```
event: guardrail_block
data: {"rule":"core/no-credential-leak","stage":"input"}
```

Front-end clients should handle both event types. A `guardrail_warn` means the conversation continued with redacted content. A `guardrail_block` means the turn was rejected and no assistant response will follow.

---

## Dev Kill-Switch

Set `KICKSTART_GUARDRAILS_DISABLED=1` to **disable all guardrails** for local development:

```bash
KICKSTART_GUARDRAILS_DISABLED=1 npm run dev
```

> ⚠️ **Never set this in production.** The kill-switch bypasses all PII and credential detection. It exists only to speed up local iteration when working on harness internals.

---

## Writing a Custom Guardrail

Custom guardrails implement the `GuardrailContribution` interface:

```typescript
import type { GuardrailContribution, GuardrailVerdict } from '@aks-kickstart/harness';

export const myCustomGuardrail: GuardrailContribution = {
  id: 'my-pack/no-profanity',
  stage: ['input', 'output'], // or just ['output']

  async check(content: string): Promise<GuardrailVerdict> {
    if (hasProfanity(content)) {
      return { verdict: 'block', reason: 'Profanity detected' };
    }
    return { verdict: 'pass' };
  },
};
```

| Verdict | Meaning |
|---------|---------|
| `pass` | Content is clean. No action. |
| `redact` | Replace matched substrings (provide `redactedContent`). Emits `guardrail_warn`. |
| `block` | Abort the turn. Emits `guardrail_block`. |

Register your guardrail by adding it to `BuildContext.inputGuardContribs` (checked before the LLM) or `BuildContext.outputGuardContribs` (checked after).

---

## Architecture: Parallel Execution

Since PR #149, input and output guardrails run in the OpenAI Agents SDK's **native parallel pipeline** rather than sequentially. See [ADR-0003](../architecture/decisions/ADR-0003-sdk-native-parallel-guardrails.md) for the full rationale and tradeoffs.

The key behavioural implication for custom guardrail authors: **with parallel input guardrails, the LLM receives the original (unredacted) user message**. The `session.recentTurns` is updated post-run using `result.inputGuardrailResults`. If your guardrail must prevent the LLM from seeing certain content entirely, use `verdict: 'block'` rather than `verdict: 'redact'`.
