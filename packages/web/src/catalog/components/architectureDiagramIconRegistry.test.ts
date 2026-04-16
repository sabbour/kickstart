import { describe, expect, it } from 'vitest';
import { ALLOWED_ICON_KEYS } from './architectureDiagramUtils';
import {
  ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL,
  ARCHITECTURE_DIAGRAM_HEADER_ICON_URL,
  getArchitectureDiagramIconRegistry,
} from './architectureDiagramIconRegistry';

describe('architectureDiagramIconRegistry', () => {
  it('covers every allowlisted diagram icon with a vendored local asset', () => {
    const registry = getArchitectureDiagramIconRegistry();

    expect(Array.from(registry.keys())).toEqual(ALLOWED_ICON_KEYS);

    for (const key of ALLOWED_ICON_KEYS) {
      expect(registry.get(key)).toMatch(/^\/assets\/architecture-diagram\//);
    }
  });

  it('uses local repo-owned fluent assets for the diagram chrome', () => {
    expect(ARCHITECTURE_DIAGRAM_HEADER_ICON_URL).toBe(
      '/assets/architecture-diagram/fluent/building-cloud.svg',
    );
    expect(ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL).toBe(
      '/assets/architecture-diagram/fluent/design-ideas.svg',
    );
  });
});
