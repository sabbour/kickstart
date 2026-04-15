/**
 * Accessibility audit tests for A2UI fluent-components and catalog components.
 *
 * These tests statically verify that ARIA attributes, semantic roles, keyboard
 * handlers, and live regions are present in component source files. This is a
 * cost-effective first line of defense until a full React Testing Library +
 * axe-core suite is added.
 *
 * WCAG 2.1 AA criteria checked:
 *   1.1.1  Non-text content (alt text, aria-label)
 *   1.3.1  Info and relationships (semantic roles, list structure)
 *   2.1.1  Keyboard accessible (onKeyDown, tabIndex)
 *   4.1.2  Name, Role, Value (ARIA attributes)
 *   4.1.3  Status messages (aria-live regions)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLUENT_DIR = resolve(__dirname, '../catalog/fluent-components');
const CATALOG_DIR = resolve(__dirname, '../catalog/components');
const FILE_MANAGER_DIR = resolve(__dirname, '../components/FileManager');

function readComponent(dir: string, name: string): string {
  return readFileSync(resolve(dir, `${name}.tsx`), 'utf-8');
}

// ─── Fluent Components ───────────────────────────────────────────────

describe('Fluent components — ARIA compliance', () => {
  describe('List', () => {
    const src = readComponent(FLUENT_DIR, 'List');

    it('has role="list" on container', () => {
      expect(src).toContain('role="list"');
    });

    it('supports accessibility.label passthrough', () => {
      expect(src).toContain('props.accessibility?.label');
    });
  });

  describe('Icon', () => {
    const src = readComponent(FLUENT_DIR, 'Icon');

    it('marks decorative icons as aria-hidden', () => {
      expect(src).toContain('aria-hidden');
    });

    it('uses role="img" for informational icons', () => {
      expect(src).toContain('role={a11yLabel ? \'img\'');
    });

    it('reads accessibility.label for accessible name', () => {
      expect(src).toContain('props.accessibility?.label');
    });
  });

  describe('Badge', () => {
    const src = readComponent(FLUENT_DIR, 'Badge');

    it('CounterBadge has aria-label with item count', () => {
      expect(src).toMatch(/CounterBadge[\s\S]*?aria-label/);
    });

    it('PresenceBadge has aria-label with status', () => {
      expect(src).toMatch(/PresenceBadge[\s\S]*?aria-label/);
    });
  });

  describe('Image', () => {
    const src = readComponent(FLUENT_DIR, 'Image');

    it('has alt text with accessibility.label fallback', () => {
      expect(src).toContain('props.accessibility?.label');
    });

    it('uses alt attribute on FluentImage', () => {
      expect(src).toContain('alt=');
    });
  });

  describe('Video', () => {
    const src = readComponent(FLUENT_DIR, 'Video');

    it('has aria-label on video element', () => {
      expect(src).toContain('aria-label');
    });

    it('falls back to "Video player" label', () => {
      expect(src).toContain("'Video player'");
    });
  });

  describe('Slider', () => {
    const src = readComponent(FLUENT_DIR, 'Slider');

    it('has aria-label on FluentSlider', () => {
      expect(src).toContain('aria-label=');
    });

    it('has aria-valuetext for screen reader feedback', () => {
      expect(src).toContain('aria-valuetext');
    });
  });

  describe('ChoicePicker', () => {
    const src = readComponent(FLUENT_DIR, 'ChoicePicker');

    it('filter input has aria-label', () => {
      expect(src).toContain('aria-label="Filter options"');
    });
  });

  describe('Link', () => {
    const src = readComponent(FLUENT_DIR, 'Link');

    it('external link icon is aria-hidden', () => {
      expect(src).toContain('aria-hidden="true"');
    });

    it('announces "opens in new window" for external links', () => {
      expect(src).toContain('opens in new window');
    });
  });

  describe('AudioPlayer', () => {
    const src = readComponent(FLUENT_DIR, 'AudioPlayer');

    it('has aria-label on audio element', () => {
      expect(src).toContain('aria-label');
    });

    it('falls back to "Audio player" label', () => {
      expect(src).toContain("'Audio player'");
    });
  });

  describe('Table', () => {
    const src = readComponent(FLUENT_DIR, 'Table');

    it('has aria-label on FluentTable', () => {
      expect(src).toContain("aria-label={props.caption ?? 'Data table'}");
    });
  });
});

describe('Workspace surfaces — ARIA compliance', () => {
  describe('FileManagerSidebar', () => {
    const src = readFileSync(resolve(FILE_MANAGER_DIR, 'FileManagerSidebar.tsx'), 'utf-8');

    it('announces streamed files via a polite live region', () => {
      expect(src).toContain('role="status"');
      expect(src).toContain('aria-live="polite"');
    });

    it('labels the workspace tree for screen readers', () => {
      expect(src).toContain('aria-label="Workspace files"');
    });
  });
});

// ─── Catalog Components ──────────────────────────────────────────────

describe('Catalog components — ARIA compliance', () => {
  describe('ProgressSteps', () => {
    const src = readComponent(CATALOG_DIR, 'ProgressSteps');

    it('uses <ol> with role="list" for semantic structure', () => {
      expect(src).toContain('<ol');
      expect(src).toContain('role="list"');
    });

    it('uses <li> for individual steps', () => {
      expect(src).toContain('<li');
    });

    it('has aria-label="Progress steps" on container', () => {
      expect(src).toContain('aria-label="Progress steps"');
    });

    it('marks active step with aria-current="step"', () => {
      expect(src).toContain('aria-current');
      expect(src).toMatch(/['"]step['"]/);
    });

    it('has role="img" and aria-label on status dots', () => {
      expect(src).toContain('role="img"');
      expect(src).toMatch(/aria-label=.*Step/);
    });
  });

  describe('RadioGroup', () => {
    const src = readComponent(CATALOG_DIR, 'RadioGroup');

    it('has role="radiogroup" on container', () => {
      expect(src).toContain('role="radiogroup"');
    });

    it('has role="radio" on each option card', () => {
      expect(src).toContain('role="radio"');
    });

    it('has aria-checked on option cards', () => {
      expect(src).toContain('aria-checked');
    });

    it('has aria-label on each option card', () => {
      expect(src).toMatch(/aria-label=\{String\(opt\.label\)\}/);
    });

    it('has tabIndex for roving focus', () => {
      expect(src).toContain('tabIndex=');
    });

    it('has keyboard handler for arrow keys', () => {
      expect(src).toContain('onKeyDown');
      expect(src).toContain('ArrowDown');
      expect(src).toContain('ArrowUp');
      expect(src).toContain('ArrowLeft');
      expect(src).toContain('ArrowRight');
    });

    it('supports Enter and Space for selection', () => {
      expect(src).toContain("e.key === ' '");
      expect(src).toContain("e.key === 'Enter'");
    });
  });

  describe('CodeBlock', () => {
    const src = readComponent(CATALOG_DIR, 'CodeBlock');

    it('copy button has descriptive aria-label', () => {
      expect(src).toContain('Copy code to clipboard');
    });

    it('code region has role="region" and aria-label', () => {
      expect(src).toContain('role="region"');
      expect(src).toMatch(/aria-label=.*Code block/);
    });
  });

  describe('DeploymentProgress', () => {
    const src = readComponent(CATALOG_DIR, 'DeploymentProgress');

    it('step list has role="list" and aria-label', () => {
      expect(src).toContain('role="list"');
      expect(src).toContain('aria-label="Deployment steps"');
    });

    it('individual steps have role="listitem"', () => {
      expect(src).toContain('role="listitem"');
    });

    it('has aria-live="polite" for real-time updates', () => {
      expect(src).toContain('aria-live="polite"');
    });

    it('step items expose accessible status labels while icons remain decorative', () => {
      expect(src).toContain('aria-label={getAccessibleStepLabel(step)}');
      expect(src).toContain('aria-hidden="true"');
    });
  });

  describe('SteppedCarousel', () => {
    const src = readComponent(CATALOG_DIR, 'SteppedCarousel');

    it('indicators have role="tablist"', () => {
      expect(src).toContain('role="tablist"');
    });

    it('each indicator has role="tab" and aria-selected', () => {
      expect(src).toContain('role="tab"');
      expect(src).toContain('aria-selected');
    });

    it('content area has role="tabpanel"', () => {
      expect(src).toContain('role="tabpanel"');
    });

    it('content area has aria-live="polite"', () => {
      expect(src).toContain('aria-live="polite"');
    });

    it('navigation buttons have descriptive aria-labels', () => {
      expect(src).toContain('Go to previous step');
      expect(src).toContain('Go to next step');
    });

    it('pills are aria-hidden (decorative)', () => {
      expect(src).toContain('aria-hidden="true"');
    });
  });

  describe('Questionnaire', () => {
    const src = readComponent(CATALOG_DIR, 'Questionnaire');

    it('labels are connected to inputs via htmlFor', () => {
      expect(src).toContain('htmlFor=');
    });

    it('text inputs have matching id', () => {
      expect(src).toMatch(/id=\{`q-\$\{qId\}`\}/);
    });

    it('required asterisk is aria-hidden', () => {
      expect(src).toContain('aria-hidden="true"');
    });

    it('required fields have aria-required', () => {
      expect(src).toContain('aria-required');
    });
  });
});
