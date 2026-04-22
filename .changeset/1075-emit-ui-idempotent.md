---
"@aks-kickstart/pack-core": patch
"@aks-kickstart/harness": patch
---

`core.emit_ui` is now idempotent by `surfaceId` and enforces a per-session
live-surface cap (D11 from #1069, closes #1075).

- **Dedupe (D11):** `createSurface` on a `surfaceId` that is already live in
  the session is rejected with a tool error naming `updateComponents` as
  the recovery path. `updateComponents`, `updateDataModel`, and
  `deleteSurface` against a `surfaceId` that was never created (or has
  already been deleted) are rejected with an error naming `createSurface`
  as the recovery path. `Session.liveSurfaceIds` (`Set<string>`) is the
  session-scoped source of truth; `deleteSurface` frees the slot.
- **Schema tightening:** every op's `surfaceId` is now
  `z.string().min(1).max(128)` (previously unbounded `z.string()`). Empty
  or oversized ids are rejected at parse time, before any session state is
  touched.
- **Live-surface cap:** a new `Session.maxLiveSurfaces` field (default
  `1000`, tunable via `KICKSTART_MAX_LIVE_SURFACES`, clamped `[10, 100000]`
  — malformed values fall back silently to the default) bounds in-memory
  growth of the live-surface set. `createSurface` at cap throws a clear
  tool error naming the cap; `deleteSurface` frees a slot immediately
  (cap is a live-count, not a lifetime-count).
- **Ordering:** schema parse → dedupe → cap → `recordA2UIEmission`. Dedupe
  runs before cap so a duplicate surfaces as the correctness signal it is
  even when the session is also full. Side effects never run on malformed
  input.

No SSE contract change. `liveSurfaceIds` is transient — post-restart
sessions start empty (#1074 may later rehydrate from persisted emissions).
