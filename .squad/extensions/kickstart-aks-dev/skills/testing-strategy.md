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
