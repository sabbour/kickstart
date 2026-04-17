# Hermes — Tester

## About Me
QA engineer and test infrastructure owner. Expertise in Playwright E2E testing, validation engine architecture, Kubernetes deployment safeguards, and accessibility compliance.

## Key Files
- `packages/core/src/validation/` — ValidationEngine, DS001-DS020 validators, auto-fix system
- `packages/core/src/__tests__/` — 600+ unit tests
- `packages/web/src/__tests__/` — 70+ Playwright E2E tests
- `packages/harness/src/__tests__/harness-exports.test.ts` — 34 harness smoke tests (added wave 40)

## Patterns
- **Validator interface:** `execute(content) → ValidationResult`; optional `autoFix(content)` for chainable fixes
- **E2E test helpers:** `enterChatViaTrack()`, `sendMessage()`, `verifyPhase()`, `mockApi()` for reusable flow setup
- **Playwright strict mode:** exact `getByText` strings, scope with containers, register routes before `page.goto()`
- **Kubernetes safeguards:** DS001-DS020 security/reliability/networking; category-grouped reports
- **TDD-red pattern:** Write failing tests that define the exact contract, then hand to implementer

## Recent Work (Active Sprint: v2 harness + packs)

- **#474 Step-1 triage** (`squad/474-step1-nuke-v1` @ `2105148`): Fixed 12 test failures → 407 passing. Phase enum stub, `buildSystemPrompt`, `DEPLOYMENT_SAFEGUARDS`, `PricingConnector` all fixed. Added `harness-exports.test.ts` (34 tests).
- **Connector Execution ADR** filed (`hermes-connector-execution-adr.md` → decisions.md). Rule: new connector write methods MUST use server proxy pattern.
- **PR #549** (Pack.skills[] micro-fix): Added merge-path test (`hermes-549-test.md` — still absent from inbox)

## Learnings (archived detail → history-archive.md)

- `systemPrompt` call sites: 4, not 3 (`agents-runner.ts`, `action.ts`, `chat-action.ts`, plus one). Count from `git grep` before writing DP.
- `agents-runner.ts` descope pattern: explicitly note migration-targeted files in DP.
- DP approval-with-conditions: both Leela + Zapp verdicts are blocking before first impl PR.
- Fluent 2 restyle TDD-red tests: 9 tests for CSS contract added for issue #347.
- K8s icon keys: confirmed 4-test TDD-red pattern for `ALLOWED_ICON_KEYS` additions.
- Playwright E2E: `**/.auth/**` route abort in shared fixture prevents auth navigation leaks.

## Review History (compact)

| Date | Item | Outcome |
|------|------|---------|
| 2026-04-15 | Issue #326 Rev 4 | QA gate approved |
| 2026-04-16 | K8s icons batch (#342) | 18→27 tests; all green after Fry's allowlist batch |
| 2026-04-16 | Fluent 2 restyle (#347) | 36 tests (29 green, 7 red TDD) |
| 2026-04-17 | #474 Step-1 triage | 407 passing, 0 failing |
| 2026-04-17 | Connector ADR | Filed decision |
| 2026-04-17 | PR #549 merge-path test | `hermes-549-test.md` pending inbox |
| 2025-07-15 | PR #550 merge-path | Step 5 Runner+SSE merged; tests passing |

*Detailed triage notes and learnings in history-archive.md*
