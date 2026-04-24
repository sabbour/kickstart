# Squad Decisions

Chronological record of architectural, process, and product decisions. Entries merged from `.squad/decisions/inbox/` on each session close.

---

# Amy decision — identity system ADR complete

**Date:** 2026-04-24T00:00:00-07:00  
**Status:** Done

## What Happened

Created ADR-0001 documenting the per-role GitHub Apps identity system decision. The ADR comprehensively covers:

- **Decision:** Use 10 independent GitHub Apps (one per squad role) for bot identity
- **Context:** Why per-role (auditability, least privilege, independent rotation)
- **Alternatives:** Evaluated shared bot token, PATs, and single app with role parameter
- **Implementation:** PEM storage, app registration metadata, token lifecycle
- **Consequences:** Operational complexity (10 apps) vs. security benefits
- **Token Flow:** PEM → JWT → installation token → inline use → post-flight check

## Location

`docs-site/docs/architecture/decisions/ADR-0001-per-role-github-apps.md`

## Commit

Committed to `squad/identity-system-complete` branch:  
`5f2ec5fa - docs: add ADR for per-role GitHub App identity system`

## Next Steps for Review

The ADR closes the documentation gap flagged in the PR #37 docs review. Ready for inclusion in the PR branch once reviewed.

---

# Fry decision inbox — shared surface namespace for chat updates

**Date:** 2026-04-24T00:01:12-07:00
**Context:** Issue #5 DP amendment responding to Nibbler rejection

## Decision

For chat A2UI replay/update flows, reserve a stable surface-id namespace (`shared:<logical-id>`) for surfaces that must update in place across assistant turns.

## Why

- Current `assistant-turn-N::surfaceId` scoping prevents turn-2 `updateComponents()` from targeting turn-1 surfaces.
- Blanket prefix stripping would break intentionally isolated per-turn surfaces such as repeated file/progress cards.
- An explicit namespace keeps cross-turn behavior opt-in and replay-safe.

## Consequences

- `chat-a2ui` needs a logical→rendered surface registry for `shared:*` IDs.
- `App`/chat rendering must preserve original surface ownership instead of attaching updated shared surfaces to later turn bubbles.
- Acceptance/E2E tests should assert stable `data-surface-id` across turns.

---

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

- The golden E2E harness, fixtures, and deterministic Playwright coverage remain available in-repo under `packages/web/e2e/golden/` for future re-enablement.
- The standalone `.github/workflows/golden-e2e.yml` workflow has been removed (commit `a896eb44`). There is no active `golden-gate` branch-protection required check.
- Fixtures must be re-recorded when they exceed 30-day freshness or when prompt/tool-schema hashes drift.
