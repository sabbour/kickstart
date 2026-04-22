# SKILL: SDK Session → AgentInputItem[] history threading

**Owner:** Bender · **Origin:** #1062 Layer 0 (PR #1071) · **Reusable for:** any harness → `@openai/agents` integration that maintains conversation state server-side.

## When to use this pattern

You have a long-lived server-side `Session` carrying `recentTurns: {role, content}[]` and you need to feed conversation history into the `@openai/agents` SDK so each turn sees context. The SDK's `Runner.run(agent, input, opts)` accepts three input shapes:

1. `string` — one-shot user message, **no history**.
2. `AgentInputItem[]` — pre-threaded conversation array. **Use this.**
3. A full `Session` implementation (`getItems/addItems/popItem/clearSession`).

Option 2 is the cheapest path when you already own the session data model. Option 3 is only worth it if you need `responses.compact` or `previous_response_id` server-side compaction.

## The helper

```ts
import type { AgentInputItem } from '@openai/agents';
import type { Turn } from '../types/session.js';

/** Convert harness turns to SDK input items. User/assistant only. */
export function toAgentInputItems(turns: readonly Turn[]): AgentInputItem[] {
  const items: AgentInputItem[] = [];
  for (const turn of turns) {
    const text = typeof turn.content === 'string' ? turn.content : '';
    if (!text) continue;
    if (turn.role === 'user') {
      items.push({ role: 'user', content: text } as AgentInputItem);
    } else if (turn.role === 'assistant') {
      items.push({
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text }],
      } as AgentInputItem);
    }
    // system / tool turns dropped — see rules below.
  }
  return items;
}
```

## Shape rules (learned the hard way)

| Item role | Shorthand accepted? | Required fields |
|---|---|---|
| `user` | ✅ `{role:'user', content: string}` | `content` (string or array of `input_text`/`input_image`/...) |
| `assistant` | ❌ **no string shorthand** | `status: 'completed' \| 'in_progress' \| 'incomplete'` **and** `content: [{type:'output_text', text}]` |
| `system` | — | Do **not** replay. The SDK re-injects `Agent.instructions` every turn. Replaying system turns duplicates the prompt and can confuse the model. |
| `tool` (function_call / function_call_result) | — | Drop on replay unless you explicitly need tool-result memory. The SDK re-plans tools per turn; stale tool items from 10 turns ago are noise. If you DO need them, they must be paired (call + result) and chronologically adjacent, or the SDK will reject the batch. |

## Empty-content guard

Always drop turns with `content === ''` or `content === undefined`. The SDK treats empty strings as invalid on user items and `content: []` as invalid on assistant items; both will throw at runtime.

## Feature-flag the rollout

History threading is **behaviour-changing** — the model suddenly sees 10× more tokens per turn and may produce different outputs. Gate the switch:

```ts
export function isHistoryEnabled(): boolean {
  const raw = process.env.HARNESS_SESSION_HISTORY_ENABLED;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true';
}

// …in Runner.run():
const runInput: string | AgentInputItem[] = isHistoryEnabled()
  ? toAgentInputItems(session.recentTurns)
  : guardedMessage; // byte-compat fallback
```

Default OFF in the first merge. Flip to ON once preview-env validation is green for 24h. Keep the flag for one release cycle after that as a kill-switch; remove in a follow-up.

## Guardrail-on-capture invariant

If you sanitize input via guardrails, **record the sanitized text**, not the raw user message. Otherwise enabling history replay instantly exposes previously-persisted raw PII to the model:

```ts
// ❌ WRONG — raw PII persists even when redacted at send time
session.recordTurn({ role: 'user', content: userMessage });
const { guardedMessage } = await runGuardrails(...);

// ✅ RIGHT — only sanitized text ever lands in recentTurns
const { guardedMessage } = await runGuardrails(...);
session.recordTurn({ role: 'user', content: guardedMessage });
```

This must be an always-on invariant, NOT gated by the history feature flag. Mixing capture and replay sanitization creates a state where flipping the flag retroactively exposes turns that were recorded raw.

## Testing pattern

Mock `@openai/agents` and capture `Runner.run()` call args. Use dynamic imports **after** the mock block:

```ts
const runCalls: Array<{input: unknown}> = [];

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');
  class FakeSDKRunner {
    async run(agent: unknown, input: unknown) {
      runCalls.push({ input });
      return {
        finalOutput: Promise.resolve({ message: 'ok' }),
        async *[Symbol.asyncIterator]() { return; },
      };
    }
  }
  return { ...actual, Runner: FakeSDKRunner, setDefaultModelProvider: vi.fn(), setTraceProcessors: vi.fn() };
});

// CRITICAL: dynamic import AFTER vi.mock, otherwise the real SDKRunner is captured at eval time.
const { Runner } = await import('../runner.js');
```

Then drive a 3-turn conversation and assert turn 3's `input` contains a full `[user, assistant, user, assistant, user]` array. This is your #1062-style regression guard.

## Reference implementation

`packages/harness/src/runtime/runner.ts` (`toAgentInputItems`, `isHistoryEnabled`) and tests at `packages/harness/src/runtime/__tests__/history-threading.test.ts` + `packages/harness/src/__tests__/runner-history.test.ts`.
