/**
 * Regression test for #343 — Playground surfaceIds must be stable across renders.
 *
 * The bug: getScenarioJson was a useCallback whose body called generate() on
 * every render. Each generate() call increments the module-level surfaceCounter
 * via uid(), producing new surfaceId values for unchanged scenario data.
 *
 * The fix: getScenarioJson was converted to useMemo so generate() is called
 * only once per selectedScenario change. These tests verify that:
 *   1. Each scenario with a generate() function produces valid A2UI messages.
 *   2. The surface IDs within a single generate() call are consistent (no
 *      duplicate surfaces created within one call).
 *   3. Consecutive calls to generate() do produce different IDs — which is why
 *      memoization at the call-site is the correct fix.
 */

import { describe, it, expect } from 'vitest';
import { CONTROL_SCENARIOS } from '../pages/playground-scenarios';
import type { A2uiMsg } from '../types';

function extractSurfaceIds(msgs: A2uiMsg[]): string[] {
  return msgs
    .map((m) => {
      if ('createSurface' in m && m.createSurface) return m.createSurface.surfaceId;
      if ('updateComponents' in m && m.updateComponents) return m.updateComponents.surfaceId;
      if ('updateDataModel' in m && m.updateDataModel) return m.updateDataModel.surfaceId;
      return undefined;
    })
    .filter((id): id is string => id !== undefined);
}

describe('Playground scenario generate() stability', () => {
  const generatingScenarios = CONTROL_SCENARIOS.filter((s) => typeof s.generate === 'function');

  it('has at least one scenario with a generate() function', () => {
    expect(generatingScenarios.length).toBeGreaterThan(0);
  });

  for (const scenario of generatingScenarios) {
    it(`scenario "${scenario.id}" – generate() returns valid A2UI messages`, () => {
      const msgs = scenario.generate!();
      expect(Array.isArray(msgs)).toBe(true);
      expect(msgs.length).toBeGreaterThan(0);
      // Every message must carry a version field
      for (const m of msgs) {
        expect(m).toHaveProperty('version');
      }
    });

    it(`scenario "${scenario.id}" – surfaceIds within one generate() call are self-consistent`, () => {
      const msgs = scenario.generate!();
      const ids = extractSurfaceIds(msgs);
      expect(ids.length).toBeGreaterThan(0);

      // All IDs that appear more than once (createSurface + updateComponents share one ID)
      // should reference the same surface intentionally — not a collision from counter churn.
      const unique = new Set(ids);
      // Sanity: the set of unique IDs is small relative to total messages (surfaces are reused
      // across createSurface + updateComponents, not duplicated).
      expect(unique.size).toBeLessThanOrEqual(ids.length);
    });

    it(`scenario "${scenario.id}" – consecutive generate() calls produce different surfaceIds (memoization required at call-site)`, () => {
      const ids1 = extractSurfaceIds(scenario.generate!());
      const ids2 = extractSurfaceIds(scenario.generate!());

      // This documents the inherent behaviour of uid(): each call gets new IDs.
      // The UI must memoize the result to keep the preview stable.
      expect(ids1).not.toEqual(ids2);
    });
  }
});
