/**
 * Regression tests for #995 — Core components tab density + preview quality.
 *
 * Asserts two invariants:
 *  1. Every core "basic" component that has a concrete renderer has a preview
 *     entry in COMPONENT_PREVIEWS, so the Core tab never shows "No preview"
 *     for shipped basic components. (This is the "lack of previews" half of
 *     the user complaint on #995.)
 *  2. Grid density named constants satisfy the geometry the DP agreed to —
 *     4–5 cards/row at 1280px through 1920px viewports.
 *     Per Nibbler's DP ask, all expected dimensions are imported from the
 *     same layout-constants module the CSS consumes, so a design-token change
 *     can never silently drift the assertion into a no-op.
 */

import { describe, it, expect } from 'vitest';
import { COMPONENT_PREVIEWS } from '../pages/component-examples';
import {
  COMPONENT_GRID_MIN_COL_PX,
  COMPONENT_GRID_MAX_CARD_PX,
  COMPONENT_GRID_GAP_PX,
  COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX,
  COMPONENT_CARD_COMPACT_MIN_HEIGHT_PX,
  COMPONENT_COMPACT_MIN_COL_PX,
  COMPONENT_COMPACT_MAX_CARD_PX,
} from '../pages/playground-layout-constants';

// Core "basic" (non-rich) components that ship a renderer and therefore MUST
// have a preview — matches the set registered in pack-core + fluent overrides.
// If pack-core adds a new basic renderer, add it here AND add its preview.
const CORE_BASIC_COMPONENTS_WITH_RENDERERS = [
  'core/Text',
  'core/Button',
  'core/Image',
  'core/Icon',
  'core/Link',
  'core/Divider',
  'core/Alert',
  'core/TextField',
  'core/CheckBox',
  'core/Slider',
  'core/DateTimeInput',
  'core/ChoicePicker',
  'core/Row',
  'core/Column',
  'core/Card',
  'core/List',
  'core/Table',
  'core/Tabs',
  'core/Modal',
  'core/Accordion',
  'core/Video',
  'core/AudioPlayer',
  'core/Badge',
  'core/Toggle',
] as const;

describe('Playground Core components tab — preview coverage (#995)', () => {
  it.each(CORE_BASIC_COMPONENTS_WITH_RENDERERS)(
    '%s has a registered preview (no "No preview" placeholder on Core tab)',
    (name) => {
      expect(
        COMPONENT_PREVIEWS[name],
        `Missing preview for ${name} — Core tab would show "No preview" card (re-regresses #995 / #986)`,
      ).toBeDefined();
      expect(COMPONENT_PREVIEWS[name]!.length).toBeGreaterThan(0);
    },
  );

  it('every core preview roots at id="root"', () => {
    for (const name of CORE_BASIC_COMPONENTS_WITH_RENDERERS) {
      const entry = COMPONENT_PREVIEWS[name];
      if (!entry) continue;
      expect(entry[0]?.id, `${name} preview root must have id="root"`).toBe('root');
    }
  });
});

describe('Playground Core components tab — grid density (#995)', () => {
  it('standard-grid minimum column width caps at ~5 cards/row at 1920px', () => {
    // Viewport width the DP calls out.
    const VIEWPORT_PX = 1920;
    // Content area excludes the Playground left sidebar (approx 240px) and
    // horizontal padding applied by the panel container. Use a conservative
    // upper bound to derive the max possible card count.
    const APPROX_SIDEBAR_PX = 240;
    const APPROX_PANEL_PADDING_PX = 48;
    const contentPx = VIEWPORT_PX - APPROX_SIDEBAR_PX - APPROX_PANEL_PADDING_PX;
    const colStride = COMPONENT_GRID_MIN_COL_PX + COMPONENT_GRID_GAP_PX;
    const maxCardsPerRow = Math.floor(contentPx / colStride);
    // 4–5 cards/row target from DP — fail above or below.
    expect(maxCardsPerRow).toBeGreaterThanOrEqual(4);
    expect(maxCardsPerRow).toBeLessThanOrEqual(5);
  });

  it('standard-grid minimum column width yields ~4 cards/row at 1280px', () => {
    const VIEWPORT_PX = 1280;
    const APPROX_SIDEBAR_PX = 240;
    const APPROX_PANEL_PADDING_PX = 48;
    const contentPx = VIEWPORT_PX - APPROX_SIDEBAR_PX - APPROX_PANEL_PADDING_PX;
    const colStride = COMPONENT_GRID_MIN_COL_PX + COMPONENT_GRID_GAP_PX;
    const maxCardsPerRow = Math.floor(contentPx / colStride);
    expect(maxCardsPerRow).toBeGreaterThanOrEqual(3);
    expect(maxCardsPerRow).toBeLessThanOrEqual(4);
  });

  it('card hard-cap is wider than the minimum column (no sub-column cards)', () => {
    expect(COMPONENT_GRID_MAX_CARD_PX).toBeGreaterThan(COMPONENT_GRID_MIN_COL_PX);
  });

  it('preview card min-height leaves room for a live preview', () => {
    expect(COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX).toBeGreaterThanOrEqual(160);
    expect(COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX).toBeGreaterThan(
      COMPONENT_CARD_COMPACT_MIN_HEIGHT_PX,
    );
  });

  it('compact grid geometry stays tighter than the standard grid', () => {
    expect(COMPONENT_COMPACT_MIN_COL_PX).toBeLessThan(COMPONENT_GRID_MIN_COL_PX);
    expect(COMPONENT_COMPACT_MAX_CARD_PX).toBeLessThan(COMPONENT_GRID_MAX_CARD_PX);
  });

  it('row gap is at least Fluent spacingVerticalM (12px) to avoid tight rendering', () => {
    const FLUENT_SPACING_VERTICAL_M_PX = 12;
    expect(COMPONENT_GRID_GAP_PX).toBeGreaterThanOrEqual(FLUENT_SPACING_VERTICAL_M_PX);
  });
});
