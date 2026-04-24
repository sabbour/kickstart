# Hermes decision — Golden E2E harness with required-for-merge gate

**Date:** 2026-04-24T04:32:00-07:00
**Context:** Issue #15 — Golden e2e (4 tracks) required-for-merge gate

## Decision

Implemented the golden E2E test harness per the approved revised DP (Bender v2, Zapp-approved). Four tracks replay recorded SSE fixtures through deterministic Playwright specs with hermetic network isolation.

## Key implementation choices

1. **Fixture location:** `packages/web/e2e/golden/fixtures/golden/<track>/` — co-located with specs for discoverability.
2. **Hermetic network:** `page.route('**', abort)` registered FIRST (LIFO ensures specific routes override it). Only localhost/127.0.0.1 allowed.
3. **Fixture replay:** SSE events converted to `text/event-stream` body strings. Phase index increments per `/api/converse` call.
4. **Gate topology:** `golden-gate` job runs `if: always()` and checks upstream results — fail-closed by design.
5. **Secret validation:** Both runtime (in fixture helper) and offline (lint script) check the same patterns.

## Consequences

- Every PR to main/dev triggers the golden-e2e workflow (no path filter on trigger).
- The `golden-gate` job becomes a branch-protection required check.
- Fixtures must be re-recorded when they exceed 30-day freshness or when prompt/tool-schema hashes drift.
