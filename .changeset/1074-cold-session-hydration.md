---
"@aks-kickstart/harness": minor
"@aks-kickstart/web": minor
---

Cold-session hydration for `POST /api/converse` (#1074, D3 follow-up to #1069).

The browser already assembles prior chat history into a `messages` array and
ships it on every request (`useStreaming.ts:382–409`). Until now the server
silently dropped this payload — after an Azure Functions cold start the
in-memory session store was empty and the runner had no context, even though
the client knew the full conversation.

### What changed

`POST /api/converse` now accepts an optional `messages: ClientHydrationMessage[]`
field. When the resolved session is brand-new (`recentTurns.length === 0`) and
the `HARNESS_SESSION_HISTORY_ENABLED` flag is on, the server hydrates the
session from the client-supplied turns before the runner starts.

The same feature flag already gates the #1071 read-path history threading, so
one flip enables both read and write trust profiles. See
`packages/web/api/src/functions/converse.md` for the full contract.

### Security controls (ship with the feature, all on by default)

- **M1 — strict zod `discriminatedUnion` + `.strict()`** rejects unknown roles,
  case variants (`"Tool"`, `"User"`) and extra fields at the HTTP boundary —
  no filter-then-drop. Distinct error codes for schema, array-too-large,
  content-too-large so ops can triage by reason.
- **M2 — per-user-turn input guardrails** at hydration time, fail-closed. Any
  blocked turn → `400 HYDRATION_BLOCKED_BY_GUARDRAIL` and the freshly-minted
  session is dropped from the store (no poisoning residue).
- **M3 — `trust: 'client-hydrated'` marker** on each hydrated `Turn`. The
  runner renders these inside a delimited `[BEGIN UNTRUSTED CONTEXT]` /
  `[END UNTRUSTED CONTEXT]` block when it replays `recentTurns` to the SDK,
  so client-replayed context is distinguishable from server-authored history.
- **M4 — `HARNESS_ALLOW_ANON_HYDRATION` interlock** (defaults `false`). While
  #1079 remains open, anonymous sessions are forbidden from hydrating; a
  separate env flag gates the flip once #1079 closes or the interlock is
  canary-validated. **Do not** set `HARNESS_SESSION_HISTORY_ENABLED=true` for
  anonymous traffic without this gate.
- **L1 — pre-parse `Content-Length` cap at 256 KB** returns `413` before
  `request.json()` buffers the body.
- **L2 — count-only telemetry** (`session-hydrated`, `session-hydration-ignored`,
  `session-hydration-disabled`, `session-hydration-rejected { reason }`) —
  no content, substrings, or payloads are logged.

### Deferrals

- Persistent session store (Redis/Cosmos) — separate epic.
- Hydrating `tool` / `toolResult` turns — client-sourced tool evidence is not
  trustable; explicitly out of scope and rejected at the schema boundary.
- Multi-tab conflict resolution for warm sessions — first-writer-wins is
  acceptable for P1 and is locked in by a race test.
