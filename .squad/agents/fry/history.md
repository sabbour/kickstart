# Fry — Frontend Dev

## About Me
Frontend engineer owning web surface and A2UI catalog components. Expertise in React, Fluent UI v9, CSS/Griffel, and streaming UX patterns.
## Docs Restructure Audit (2026-05-01)
- A2UI/component docs audit: mapped current A2UI sources, found extending-a2ui severely stale
- Recommendations integrated into single-PR execution plan
- Stand-by for docs implementation phase

## Spawn: ralph-wave-2 (2026-05-01T12:13:25)
- **Issue #309**: Playwright + web build targets ✅
  - PR #341 opened
  - Targets passed: Playwright ✅, web build ✅
  - Issue marked done
- **Follow-up**: Test-side work for Bender #310 data-streaming integration (separate issue)

## Learnings

### Issue #233 — ArchitectureDiagram PNG Export (2026-05-02)
- Browser-native SVG → Canvas → PNG is the right approach for SWA-hosted apps: no puppeteer, no server round-trip, zero new deps.
- `XMLSerializer` + Blob URL + `<canvas>` drawImage works well for Mermaid-generated SVGs because all assets (icons) are already embedded as data URIs.
- A2UI components do NOT receive `isActive` directly — isolation is only at the surface-wrapper level (opacity). For per-button disable logic, use functional state (`isRendering`, `hasDiagram`) instead.
- When writing tests for components in pack-core, avoid `@testing-library/react` — it may not be installed in a worktree's hoisted `node_modules`. Use `ReactDOM.createRoot` + `act()` from `react-dom/test-utils` instead.
- The web catalog (`packages/web/src/catalog/components/`) maintains a copy of rich components that mirrors pack-core. Both files must be updated in lockstep.
