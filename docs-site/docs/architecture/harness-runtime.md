---
sidebar_position: 4
---

# Harness Runtime

The harness runtime is everything inside `packages/harness/src/runtime/`. It is the only layer that knows how to drive a turn end-to-end. This page is a guided tour of the major modules and their public surface.

---

## Runner — `runtime/runner.ts`

`Runner` wraps `@openai/agents`. The single entry point is:

```ts
async run(
  session: Session,
  userMessage: string,
  sseWrite: SSEWriter,
  signal?: AbortSignal,
  runConfig?: RunConfig,
): Promise<void>
```

What it owns end-to-end:

- **Plan-artifact gate** for `PLAN_REQUIRED_AGENTS` (architects + `core.codesmith`). On miss it emits a fixed-copy Card and an `end` frame; raw error text goes to telemetry, never to SSE.
- **Per-turn skill counters**: `session.skillsPulled`, `skillsPulledBytes`, `skillsPulledTokens` — reset at turn entry and in `try/finally` so they never leak across turns on abort or thrown errors.
- **Abort plumbing**: external `AbortSignal` is forwarded into an internal `AbortController` (#B2).
- **History threading & guardrail-on-capture**: user turn is recorded *before* the SDK run; if input guardrail tripwires, the turn is popped (#1062 Z2).
- **A2UI ordering (post-tool drain)**: `session.a2uiEmissions` is drained *after* each LLM `tool_call`, never before, so A2UI frames cannot overtake their producing tool.
- **Phase transitions**: emits `phase` SSE on agent handoff. Phase advancement itself is owned by agents and `advancePhase()` (`packages/harness/src/index.ts`).
- **Responses API thread continuity**: persists `session.responseId` across turns (#114/#126 Phase 3).
- **KICKSTART_PLAYGROUND gate** — runtime refuses to load playground stubs unless the env var is true.

---

## Session — `runtime/session.ts`

Defines the `Session` class plus the `sessionStore` (default in-memory) and helpers:

| Symbol | Purpose |
|---|---|
| `Session` | Mutable per-turn state: `recentTurns`, `a2uiEmissions`, `pendingUserAction`, `artifacts`, `responseId`, `activeAgent`, `currentPhase`, `lastActiveAt`. |
| `getOrCreateSession`, `getOrCreateSessionResult` | Resolve a request to a session, creating one for anonymous callers. |
| `generateAnonSessionToken`, `validateAnonSessionToken`, `isAnonymousSession`, `AnonTokenGenerationError` | Anon-token lifecycle (#1079). |
| `ANON_SESSION_TTL_MS = 10 * 60 * 1000` | 10-minute TTL on anonymous sessions. |
| `hydrateColdSession`, `HYDRATION_DEFAULT_CAP = 20`, `HYDRATION_CONTENT_MAX_BYTES = 4096` | Cold-rehydration for sessions evicted from memory. |

See [Resume & session token](../agent-authoring/resume-and-session-token.md) for the full flow.

---

## Session store — `runtime/session-store.ts` (+ `session-store-azure-table.ts`)

Two abstractions:

- `ISessionStore` — synchronous, Map-shaped. Default impl `InMemorySessionStore`.
- `IAsyncSessionStore` — Promise-returning. Default impl `AzureTableSessionStore` (Azure Table Storage backend, #133).

Pick the backend by setting `KICKSTART_SESSION_STORE=memory|azure-table`. `createSessionStore()` and `startEvictionScheduler()` are exported from the same module. Eviction polls `evictExpired()` every 5 minutes by default and `unref()`s the timer so the process can exit cleanly.

See [Session store](../pack-authoring/session-store.md) for the full adapter contract.

---

## SSE writer — `runtime/sse.ts`

Exports `SSEEventType`, `SSE_EVENT_TYPES` (a `Set` so adding a new event without updating the union fails type-check), `formatSSEFrame`, `writeSSE`, `createSSEStream`, and `SSE_RESPONSE_HEADERS`. The 12-event taxonomy is documented at the top of the file.

---

## Guardrails — `runtime/guardrails.ts`

The shared engine. See [Guardrails](../pack-authoring/guardrails.md) and [Safeguards](../pack-authoring/safeguards.md). Public surface:

- `runGuardrails(input, contributions, sseWrite?)` — sequential pipeline used at the tool stage.
- `applyRedact(input, result)` — payload mutation for `redact` verdicts.
- `toSdkInputGuardrail`, `toSdkOutputGuardrail` — SDK adapter wrappers used by the runner.
- `RunGuardrailsResult` — `{ blocked, mutatedInput }`.

Security invariants enforced here: `core/` always wins, every thrown `evaluate()` blocks (fail-closed), payload coercion errors block, SSE only emits opaque `{ code: 'GUARDRAIL_BLOCK' }` (no id/reason/pattern), and a tool-stage block halts all remaining tool calls for the turn.

---

## RunConfig + handoff filter — `runtime/run-config.ts`

`buildRunConfig({ onHandoff?, handoffInputFilter? })` produces the options object passed to `sdkRunner.run()`. The default `handoffInputFilter` (`defaultHandoffInputFilter`) strips A2UI tool outputs (detected by the `"version":"v0.9"` substring marker) and compresses old turns to keep handoff context lean (#104). `defaultHandoffCallback` logs `[handoff] from → to at turn N` (#108).

---

## Schema conformance — `runtime/schema-conformance.ts`

Authoritative I2 enforcement uses `toStrictJsonSchema()` from `openai/lib/transform` — the exact function the SDK runs before the API call. Walkers cover the invariants `toStrictJsonSchema()` silently accepts but the API rejects: I1 (every object has `properties`), I4 (every property has a `type` or combinator), I5 (no `format: "uri"`), I6 (no unsupported `oneOf`). See [Schema conformance](./schema-conformance.md).

---

## OTel bridge — `runtime/agents-otel-bridge.ts`

`OtelBridgeTraceProcessor` adapts the `@openai/agents` trace stream to OpenTelemetry spans. Tool args / tool results are redacted before being attached as span attributes. Setting `KICKSTART_OTEL_RECORD_CONTENT=true` allows recording un-redacted content (development only). See [Observability](../operations/observability.md).

Companion modules: `redact.ts` (regex-based PII / secret redaction), `sanitize-error.ts` (strips secrets and stack frames before SSE / telemetry).

---

## Resume — `runtime/resume.ts`

Server-side handler shared by `web/api/src/functions/resume.ts`. Exports `ResumeHandlerInput`, `ResumeHandlerResult`, and `ClientPrincipal`. Performs three security gates in the call site: OID match against the session's user, payload schema validation, and the `KICKSTART_PLAYGROUND` gate. See [Resume & session token](../agent-authoring/resume-and-session-token.md).

---

## Skill resolution helpers

| File | Exports |
|---|---|
| `runtime/skill-matcher.ts` | `matchesSkill`, `validateGlobPattern`, `FORBIDDEN_PATTERN_RE` |
| `runtime/token-budget.ts` | `estimateTokens`, `buildSkillPrompt`, `fitSkillsInBudget` |
| `runtime/skill-resolver.ts` | `resolveSkills`, `ResolveSkillsOptions` |
| `runtime/loader-skill.ts` | parses `<pack>/skills/<slug>/SKILL.md` |
| `runtime/loader-agent.ts` | parses `<pack>/agents/<agent>.agent.md` |

`fitSkillsInBudget` is greedy with **skip-on-overshoot** semantics — a small high-priority skill ranked after a large one still gets included.

---

## Catalog snapshot — `runtime/catalog.ts`

`buildCatalogSnapshot(components, userActions, id?)` and `negotiateCatalog(advertisedIds, snapshot)` build / select the A2UI catalog the client will render. See [A2UI integration](./a2ui-integration.md).

---

## Registry — `runtime/registry.ts`

`PackRegistry` owns all contributions. Lifecycle: `register(pack)` → `enable(names)` → `seal()`. Post-seal mutations throw. `seal()` validates every handoff target across active packs (#1073), snapshots playground stubs, and reserves the `core/` namespace for the core pack. See [Packs, skills & actions](../pack-authoring/packs-and-skills.md) for usage.
