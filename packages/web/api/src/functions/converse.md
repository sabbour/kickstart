# POST /api/converse — request contract

`POST /api/converse` is the SSE-streaming entry point into the v2 harness.
The request body is JSON; the response is `text/event-stream` with the nine
SSE event types defined in `@aks-kickstart/harness/runtime/sse`.

## Request body

```jsonc
{
  "sessionId": "…",                 // optional — server mints a UUID when absent
  "message": "Build new",           // required, ≤ 8 KB UTF-8
  "clientMessageId": "…",           // optional, client-side correlation id
  "event": {                        // optional, A2UI component event (#1062)
    "name": "choose_build",         // /^[a-zA-Z0-9_:\-]{1,64}$/
    "payload": { "…": "…" }          // JSON-serialisable, ≤ 2 KB
  },
  "messages": [                     // optional, client-supplied history (#1074)
    { "role": "user", "content": "…" },
    { "role": "assistant", "content": "…" }
  ]
}
```

### `messages[]` — cold-session hydration (#1074 D3)

The browser already assembles prior chat history into `messages` on every
request (`useStreaming.ts`). The server hydrates the session from this array
only when the resolved session is brand-new (`session.recentTurns.length === 0`).

A warm session ignores `messages` (server is source of truth) and emits a
`session-hydration-ignored` telemetry event.

#### Schema (strict)

- Validated with a zod `discriminatedUnion('role', [...])` — each branch is
  `.strict()`, so extra fields are rejected at the boundary.
- Allowed roles: `user`, `assistant`. `tool` / `system` / case variants
  (`"User"`, `"Tool"`) are rejected with `400 HYDRATION_INVALID_SCHEMA`.
- `content` must be a non-empty string ≤ 4 KB (bytes, UTF-8).
- `messages.length` must be ≤ 20; `cap+1` returns `400 HYDRATION_ARRAY_TOO_LARGE`
  (distinct code from size-of-single-content).
- Oversized content returns `400 HYDRATION_CONTENT_TOO_LARGE`.
- Total hydration ceiling: 20 × 4 KB = 80 KB.

A pre-parse `Content-Length` cap at 256 KB returns `413 Request Too Large`
before `request.json()` buffers the body.

#### Trust model (Zapp M1–M4)

- **Client-supplied history is untrusted.** Each hydrated user turn is
  run through the `input`-stage guardrail pipeline at hydration time, on the
  same fail-closed semantics as live user input. A block on any turn returns
  `400 HYDRATION_BLOCKED_BY_GUARDRAIL` and the freshly-minted session is
  deleted from the store (no poisoning residue).
- **Credential redaction** — hydrated `content` is passed through
  `sanitizeText` (the same redaction used by telemetry) before it reaches
  guardrails or the LLM.
- **Trust marker** — each hydrated `Turn` carries `trust: 'client-hydrated'`.
  The runner renders these inside a delimited
  `[BEGIN UNTRUSTED CONTEXT — client-hydrated, unverified] … [END UNTRUSTED CONTEXT]`
  block when replaying `recentTurns` to the SDK, so the model (and any
  trace auditor) can distinguish client-replayed context from server-authored.
- **Anon interlock** — while `oid === 'anonymous'` the hydration path is
  gated by `HARNESS_ALLOW_ANON_HYDRATION` (defaults `false`). If off,
  anonymous hydration returns `403 HYDRATION_ANON_FORBIDDEN` and the session
  is dropped. This is the runtime interlock against the #1079 sessionId-guess
  amplification vector. **Operators must not enable history for anonymous
  traffic until #1079 is closed or the interlock is canary-validated.**

> Race safety: `hydrateColdSession` is synchronous in-process; the JS
> event-loop makes the existence check + push race-free for a given
> sessionId. Two concurrent cold hydrations collapse to first-writer-wins
> (the second call observes `recentTurns.length > 0` and no-ops). Locked
> in by a regression test in `session-hydration.test.ts`.

#### Role filter — mitigation is the cap, not the token-budget

The `token-budget.ts` module only trims *skill* prompts (`fitSkillsInBudget`);
it does not trim conversation history. The actual defense against a
client-supplied token-DoS is the `20 × 4 KB = 80 KB` cap + role filter
enforced at the request boundary.

### Telemetry events

Count-only — never include `content`, substrings, or payloads:

| Event                           | Emitted when                                                           |
|---------------------------------|------------------------------------------------------------------------|
| `session-hydrated`              | Cold session hydrated; `{ turnCount, userTurnCount, assistantTurnCount }` |
| `session-hydration-ignored`     | Warm session — client `messages` silently dropped; `{ reason: 'warm' }` |
| `session-hydration-rejected`    | `{ reason: 'invalid-schema' \| 'array-too-large' \| 'content-too-large' \| 'blocked-by-guardrail' \| 'anon-hydration-forbidden' }` |

### Feature flags

| Flag                           | Default | Effect                                            |
|--------------------------------|---------|---------------------------------------------------|
| `HARNESS_ALLOW_ANON_HYDRATION` | `false` | Gates hydration for anonymous sessions; see #1079 |

The flag accepts `"1"` or `"true"` (case-insensitive) as on; anything else is off.
