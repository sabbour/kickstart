/**
 * Named geometry constants for the Playground Components tab.
 *
 * These are the single source of truth for the component-card grid density.
 * Both the CSS (Playground.tsx `useStyles`) and the tests consume these values
 * so the grid layout and the assertions that guard it stay in lockstep.
 *
 * Background: #986 tightened the grid but left 6+ cards/row at 1920px and
 * allowed "No preview" cards for several core components. #995 restored the
 * intended 4–5 cards/row density AND raised the preview minimum so previews
 * (video, audio, modals, accordions, tabs) render with legible room.
 *
 * When these values change, the Playwright specs in
 * `packages/web/e2e/playground.spec.ts` pick the new thresholds up
 * automatically — keep it that way (Nibbler DP ask on #995).
 */

/** Minimum column width for the standard (preview-rich) grid. */
export const COMPONENT_GRID_MIN_COL_PX = 300;

/** Per-card hard cap in the standard grid — prevents single-card sprawl at 4K. */
export const COMPONENT_GRID_MAX_CARD_PX = 380;

/** Grid row/column gap in the standard grid (px, Fluent `spacingVerticalL`). */
export const COMPONENT_GRID_GAP_PX = 20;

/** Minimum column width for the compact grid (pack sections with no previews). */
export const COMPONENT_COMPACT_MIN_COL_PX = 220;

/** Per-card hard cap in the compact grid. */
export const COMPONENT_COMPACT_MAX_CARD_PX = 280;

/** Minimum height of a preview card so the live preview renders legibly. */
export const COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX = 180;

/** Minimum height of a compact (no-preview) card. */
export const COMPONENT_CARD_COMPACT_MIN_HEIGHT_PX = 88;
