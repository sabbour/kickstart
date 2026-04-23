---
'@aks-kickstart/web': patch
---

Fix: Playground component graceful API fallback and E2E test re-enablement (#913)

- Added client-side fallback widget inspiration ideas in `lib/fallback-ideas.ts`
- Updated Playground.tsx `handleInspire()` to gracefully fallback when API is unavailable
- Updated E2E helpers.ts to mock `/api/inspirations/widgets` endpoint
- Re-enabled Playground E2E tests (previously skipped in #772)
- Playground now renders reliably even when API is down, showing inspiration prompts from fallback ideas
