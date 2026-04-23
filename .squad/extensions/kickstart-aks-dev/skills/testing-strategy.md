# Testing Strategy

**When to use:** you are writing tests, validating a change, or wiring up a CI step.

## Context

Kickstart v2 has four test layers. A PR is not complete until the layers it touches are green.

| Layer | Tool | What it proves |
|-------|------|----------------|
| Unit | Vitest | Individual functions, pure components, utility code |
| Pack conformance | Vitest | Every pack registers cleanly, every primitive round-trips the registry, tool schemas are valid |
| Contract | Vitest + recorded fixtures | SSE events and tool outputs match pinned shapes |
| End-to-end | Playwright | Real agent runs through the web client, real streaming, real UI |

## Layer rules

### Unit (Vitest)

- Tests co-locate with source (`foo.ts` + `foo.test.ts`) or live in `__tests__/`.
- Mock only what crosses a process boundary (Azure SDK, OpenAI, fs when destructive).
- Tests are deterministic. No random, no time-sensitive assertions without a fake clock.

### Pack conformance

Every pack under `packages/pack-*/src/__tests__/` has:

- `conformance.test.ts` — registers the pack against a fresh harness and asserts every declared primitive is reachable.
- `schema.test.ts` — snapshot test of every tool and user-action schema.
- `components.test.ts` — renders every component with its sample props.

Packs that fail conformance cannot ship.

### Contract

`packages/harness/src/__tests__/contract/` pins:

- The SSE event taxonomy (`chunk`, `a2ui`, `tool`, `user_action_required`, `handoff`, `intent`, `done`, `error`).
- The `core.emit_ui` payload shape.
- The user-action resume payload shape.

Breaking these is a major version bump.

### End-to-end (Playwright)

- Config: `playwright.config.ts`.
- Tests under `packages/web/e2e/`.
- Register `page.waitForResponse()` before `page.goto()` when intercepting SSE routes. Route registrations in the test body use LIFO and override auto-fixtures.
- Mock mode (`?mock`) exercises the UI without hitting the API. Use it for deterministic UI tests.
- Live mode exercises the real SSE parser path. Use it for streaming regressions.

## CI pipeline

`.github/workflows/ci.yml` runs on every PR:

1. Lint (`npm run lint`)
2. TypeScript check across all packages
3. Build harness, all packs, web, API
4. Unit + conformance + contract tests (`npx vitest run`)
5. Changeset status (surfaces missing changesets)
6. Playwright E2E (`npx playwright test`)

All required. A red CI blocks merge.

## Writing a good test

- Name describes expected behaviour, not the method under test. `renders empty state when data is null` beats `test_render_1`.
- One assertion cluster per test. Multiple unrelated assertions belong in separate tests.
- Prefer real objects and integration-style tests to deep mock chains.
- For streaming: assert on the sequence of events, not just the final output.
- For components: assert user-observable behaviour (role, text, aria) over implementation detail.

## Flake policy

- A flaky test is a broken test. Fix it or delete it. Do not skip it "for now."
- Retries in CI hide problems. Do not add them without a Zapp + Hermes review.

## Coverage

- 80% is a floor, not a target.
- Coverage without contract and conformance is theatre. A pack with 100% unit coverage but a broken conformance test still fails.

## Performance budgets

Hermes owns the perf budget on every DP that introduces or materially changes a user-facing path.

A DP must state:

| Metric | Required for |
|--------|--------------|
| p95 latency | Any new `/api/*` endpoint or tool invocation path |
| First-chunk time | Any new streaming path (SSE, agent response) |
| Token budget | Any new LLM-backed tool, agent, or prompt |
| Cold-start delta | Any change to SWA Functions API bundle or dependencies |
| Resource footprint | Any change to pack infra, AKS Automatic defaults, or deployment manifests |

Defaults (adjust per feature):

- `/api/converse` p95 under 500 ms excluding LLM call time
- First SSE chunk under 800 ms from request receipt
- Cold start under 3 s for the Functions host
- Token budget stated per-call with a hard ceiling

Enforcement:

- PRs that regress a stated budget without a written justification are blocked.
- Regression tests live next to the feature. Playwright timing assertions are acceptable for UI paths.
- Budget changes themselves are a DP item, not a silent PR edit.

Observability:

- Emit structured logs with `trace_id`, `session_id`, `agent`, `tool`, `latency_ms`, `tokens_in`, `tokens_out`, `first_chunk_ms`, and `outcome` on every agent turn.
- Every new tool, agent, or endpoint gets an OpenTelemetry span. Span names: `tool.{name}`, `agent.{name}`, `emit_ui`, `sse.chunk`. Trace IDs propagate from the Functions API through harness and packs.
- No `console.log` in shipped code. Secrets and user content are redacted at source; redaction rules go through Zapp.
- Dropping a span, breaking trace propagation, or emitting unstructured logs is a block-merge regression on par with a perf-budget regression.
- Surface regressions in the weekly pulse when available.
