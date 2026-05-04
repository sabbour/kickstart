---
sidebar_position: 9
---

# Resume & Session Token

Two harness features keep conversations alive across page reloads, MCP transports, and paused UserActions:

1. **Anonymous session tokens** — short-lived bearer tokens that re-bind a browser to a server-side `Session`.
2. **Resume** — server-side replay of a paused `Runner` after a UserAction completes.

Both live in the harness, not in the API: `packages/harness/src/runtime/session.ts` and `packages/harness/src/runtime/resume.ts`. The Functions endpoints (`packages/web/api/src/functions/converse.ts` for token issuance, `packages/web/api/src/functions/resume.ts` for resume) are thin transport adapters.

---

## Anonymous session tokens

`generateAnonSessionToken()` issues a token; `validateAnonSessionToken()` verifies it; `isAnonymousSession()` predicates on a `Session`. The TTL is `ANON_SESSION_TTL_MS = 10 * 60 * 1000` (10 minutes). The hash of the token is stored on `session.anonTokenHash` — the bare token never lives on the server.

The token is broadcast as a dedicated SSE event the first time an anon session is created or rotated:

```
event: session_token
data: {"token":"…","expiresAt":"…"}
```

The browser stores it (sessionStorage) and includes it on subsequent `/api/converse` calls so the same `Session` is recovered. After 10 minutes of inactivity the token is rejected and a fresh anon session is created.

`AnonTokenGenerationError` is thrown if the random source fails — never silently fall back to a deterministic token.

`HARNESS_ALLOW_ANON_HYDRATION=true` enables cold-rehydration of anonymous sessions from the persistent store (typically Azure Table). Without it, anon sessions die with the process — appropriate for stateless hosts.

---

## Cold rehydration

`hydrateColdSession(rawTurns, opts?)` rebuilds a `Session` from the persistent store with bounded fidelity:

- `HYDRATION_DEFAULT_CAP = 20` turns kept (most-recent-first).
- `HYDRATION_CONTENT_MAX_BYTES = 4096` per turn — long messages are truncated, not silently dropped.
- `provenance` markers are preserved so server-trusted vs client-supplied turns remain distinguishable downstream.

This is what bounds prompt size on resume — long conversations don't accidentally blow the model's context window.

---

## Resume — `runtime/resume.ts`

```ts
export interface ResumeHandlerInput {  /* sessionId, actionId, toolName, result, principal */ }
export interface ResumeHandlerResult { /* sse-friendly result envelope */ }
export interface ClientPrincipal      { /* x-ms-client-principal shape */ }

export function getOidFromPrincipalHeader(headerValue: string | null | undefined): string | null;
export async function handleResume(input: ResumeHandlerInput): Promise<ResumeHandlerResult>;
```

The Functions handler at `packages/web/api/src/functions/resume.ts` is the canonical caller. The header comment captures the three security-critical gates:

- **Critical 1** — OID extracted from `X-MS-CLIENT-PRINCIPAL` must equal `session.user.oid`. Mismatch returns `403 Forbidden` (not an SSE error frame).
- **Critical 2** — `resultPayload` is parsed against the `UserAction.resultSchema` from the registry. Failure returns `400`.
- **Critical 3** — playground stubs are gated by `KICKSTART_PLAYGROUND=true` inside `Runner.run` (the runtime refuses to load stubs when the env var is absent or false).

### Compare-and-swap on `pendingUserAction` (#B3)

The handler clears `session.pendingUserAction` **before** running validation. If validation fails the request is rejected outright; if it succeeds the runner is invoked with the validated result. This ordering prevents a concurrent retry from re-firing the same action while the first result is still in flight.

---

## End-to-end flow

```
browser ── /api/converse (with anon token) ──► Functions
                                                  │
                                                  ▼
                                       sessionStore.get(token)
                                                  │
                              ┌───── miss ────────┴─────── hit ─────┐
                              ▼                                       ▼
                    create new Session                    hydrate from store
                    issue anon token (SSE: session_token)        │
                              │                                  │
                              └────────► Runner.run(...) ◄───────┘
                                                  │
                          tool emits user_action_req
                                                  │
                                                  ▼
                              session.pendingUserAction = {...}
                              SSE: user_action_req {actionId, parameters}
                                                  │
                              ─── browser collects user input ───
                                                  │
                                                  ▼
                          POST /api/converse/resume {sessionId, actionId, result}
                                                  │
                            Critical 1 (OID) → Critical 2 (schema) → CAS clear
                                                  │
                                                  ▼
                                       Runner replays result
                                       SSE stream resumes
```

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `403 Forbidden` on resume | Token mismatch with `session.user.oid` | Browser is sending a stale OID; refresh the auth principal. |
| `400` on resume with no useful body | Resume body did not parse against `resultSchema` | Compare client payload to the action's Zod schema; the server-side log has the full reason (sanitized). |
| `404 No pending UserAction` | `pendingUserAction` already cleared by a prior resume | Concurrent retry; the second one is by-design rejected. |
| Anon session lost mid-flow | Idle &gt; 10 min | Trip-wire is intentional. Re-issue the conversation. |

---

## What this is NOT

- **Not** an authn / authz substitute. Anonymous tokens prove session continuity, not identity.
- **Not** a long-lived API key. They expire in 10 minutes and the bare token is never persisted.
- **Not** an offline mechanism. Resume requires the same `Session` to be live or rehydratable; the browser must replay onto the same logical session id.
