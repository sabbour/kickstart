---
sidebar_position: 4
---

# Troubleshooting

Symptom-first table for the most common failures. Each row links to the underlying mechanism so you can verify locally before opening an issue.

---

## API & SSE

| Symptom | Likely cause | Where to look |
|---|---|---|
| SSE stream returns `error: {code: "GUARDRAIL_BLOCK"}` | A guardrail at any stage returned `block`. SSE is opaque by design (no id, reason, or stage). | App Insights `guardrail.evaluate` span carries the rule id and (redacted) reason. See [Guardrails](../pack-authoring/guardrails.md). |
| `403 Forbidden` from `/api/converse/resume` | OID from `X-MS-CLIENT-PRINCIPAL` did not match `session.user.oid` (resume principal-match gate). | `packages/web/api/src/functions/resume.ts`; verify the auth principal. |
| `400` from `/api/converse/resume` with no useful body | `resultPayload` did not pass the action's `resultSchema` (resume schema-validation gate). | App Insights has the full sanitized parse error. See [Resume & session token](../agent-authoring/resume-and-session-token.md). |
| `404 No pending UserAction on this session` | A prior resume already cleared `pendingUserAction` (compare-and-swap). | Concurrent retry — by-design rejection. |
| Anon session "lost" after about 10 minutes | Anon TTL is `ANON_SESSION_TTL_MS = 10 * 60 * 1000`. | `runtime/session.ts`. Surface a fresh anon token via the `session_token` SSE event. |
| Hydrated session is missing older turns | `HYDRATION_DEFAULT_CAP = 20` keeps the most-recent 20 turns. | Adjust before calling `hydrateColdSession`. |
| Hydrated turns are truncated | `HYDRATION_CONTENT_MAX_BYTES = 4096` per turn. | Same as above. |

---

## Tools & schemas

| Symptom | Likely cause | Fix |
|---|---|---|
| API boot fails with `[mypack.foo] Zod field at … uses .optional() without .nullable()` | Strict-mode I2 violation. | Replace `.optional()` with `strictOptional()` and call `stripNulls` in the tool body. See [Schema conformance](../architecture/schema-conformance.md). |
| Tool not visible to the LLM | Tool not in the agent's frontmatter `tools:` allowlist, or the agent is from another pack and `dependsOn` is missing. | Check the agent's `*.agent.md`; confirm `dependsOn` includes the providing pack. |
| Tool not visible over MCP | `mcpExposed !== true` or `requiresSession === true`. | See [MCP tools](../pack-authoring/mcp-tools.md). |
| `Pack already registered: X` at boot | Duplicate `pack.name` in the bootstrap. | Remove the duplicate registration. |
| `Cross-pack handoff rejected: agent "A" in pack "P1" declares handoff to "B" in pack "P2"` | Handoff target outside `dependsOn` and `handoffTargets`. | Add `P2` to `P1.handoffTargets` (narrow) or `P1.dependsOn` (full trust). |

---

## Skills

| Symptom | Likely cause | Fix |
|---|---|---|
| Skill never matches an agent | `appliesTo` glob is wrong — exact-match needs `*` wildcard. | `runtime/skill-matcher.ts`. `appliesTo: ["*"]` matches everything. |
| Pack registration throws "forbidden shell metacharacters" | `appliesTo` pattern contains `;|&$\``. | Sanitize the pattern; the registry rejects these at register-time. |
| Skill is silently dropped from a turn | Token budget — `fitSkillsInBudget` skips skills that don't fit; lower-priority small skills do still get included. | Reduce skill body or raise `priority`. |

---

## Guardrails

| Symptom | Likely cause | Fix |
|---|---|---|
| Tool-stage block halted multiple tools | This is intentional. Tool-stage `block` halts all remaining tool calls in the turn. | Investigate the rule on the *first* tool that blocked. |
| Guardrail emitted `redact` but downstream tools saw the original | Parallel SDK adapter trades dual-eval chaining for latency (DP #116). | Move the rule to the sequential tool stage if chaining matters. |
| `Pack "X" may not register a guardrail in the core/ namespace: …` | Non-core pack tried to use the `core/` id namespace. | Re-namespace the rule to `<your-pack>/...`. |
| `KICKSTART_GUARDRAILS_DISABLED=true` rejected at boot | `NODE_ENV=production` blocks the kill-switch. | Remove the env var in production. |

---

## A2UI

| Symptom | Likely cause | Fix |
|---|---|---|
| A2UI frame appears before its tool's `tool_done` | Should be impossible — drain happens after the LLM tool_call. | If reproducible, dump `session.a2uiEmissions` and the SSE order; file an issue. |
| `A2UIMessageEnvelopeSchema.parse()` fails on a custom envelope | Schemas are `.strict()` — unknown keys throw. | Remove the extra keys or add them to `packages/harness/src/types/a2ui.ts`. |
| Surface never appears in the SPA | The browser never received `createSurface`, or the catalog id was negotiated to one the client doesn't know. | Inspect SSE; confirm `negotiateCatalog()` accepted the advertised id. |

---

## MCP

| Symptom | Likely cause | Fix |
|---|---|---|
| Stuck UserAction over MCP | Interrupt TTL is `INTERRUPT_TTL_MS = 15 * 60 * 1000`. | Re-issue the request after replying or after the TTL expires. |
| Out-of-order tool calls over MCP | Per-session mutex (`session-mutex.ts`) only orders within a session — different sessions race. | Pin the test client to one session. |
| Tool missing from MCP manifest | `mcpExposed !== true` *or* `requiresSession === true`. | See [MCP tools](../pack-authoring/mcp-tools.md). |

---

## Session store

| Symptom | Likely cause | Fix |
|---|---|---|
| Session JSON exceeds Azure Table 64 KB row limit | `MAX_DATA_BYTES` cap. | Trim `recentTurns` before persisting; the bound is intentional. |
| Eviction never runs | Backend doesn't implement `evictExpired()`. | Implement it on your `IAsyncSessionStore`. |
| Sessions vanish on process restart | Default backend is `InMemorySessionStore`. | Set `KICKSTART_SESSION_STORE=azure-table` and supply storage credentials. |

---

## Telemetry

| Symptom | Likely cause | Fix |
|---|---|---|
| App Insights spans missing tool args | Redaction is on (default). | Set `KICKSTART_OTEL_RECORD_CONTENT=true` (dev only). |
| `traceId` differs between SSE and App Insights | Inbound trace header was missing or mangled. | `extractTraceId(req)` returns a fresh id when none is supplied. |
| Browser SDK silent | `WEB_TELEMETRY_BROWSER_ENABLED` not set, or `BROWSER_APPLICATIONINSIGHTS_CONNECTION_STRING` missing. | See [Browser telemetry](./browser-telemetry.md). |

---

## Where to escalate

If a failure mode isn't on this page, the chain to walk is:

1. App Insights — sanitised `ExceptionTelemetry` plus the OTel span tree.
2. Server logs — redacted but include the rule id / tool name / agent name.
3. The relevant package source — every public surface in this docs set is anchored to a `packages/**/src/**/*.ts` path.
4. Open an issue with the trace id and the SSE event sequence.
