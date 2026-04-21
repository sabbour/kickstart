/**
 * Regression tests for #954 and #967/#968 (playground renderer unification).
 *
 * Asserts every COMPONENT_PREVIEWS entry uses descriptor `component` values
 * that resolve through a registry seeded with the actual fluentOverrides +
 * rich components. Catches drift between `impl.name` (bare, e.g. "Text") and
 * the example map (which keys by pack-qualified id, e.g. "core/Text").
 *
 * Also guards the validateAndSanitizeComponents path — ensures that when the
 * real sanitizer runs over the preview descriptors, NO descriptor is replaced
 * with _ErrorComponent. This is the same code path that fires in A2UIEnvelopePreview
 * at render time.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { COMPONENT_PREVIEWS } from '../pages/component-examples';
import { ClientComponentRegistry, validateAndSanitizeComponents } from '../contexts/A2UIRegistryContext';
import { fluentOverrides } from '../catalog/fluent-components/index';

// Mirrors the rich-component list registered in main.tsx. We register stub
// renderers (the registry only checks names, not behavior) to avoid pulling
// in the real rich-component module graph (which transitively requires
// optional harness runtime deps).
const RICH_COMPONENT_NAMES = [
  'AuthCard',
  'AzureAction',
  'AzureLoginCard',
  'AzureResourceForm',
  'AzureResourcePicker',
  'CodeBlock',
  'CostEstimate',
  'DecisionCard',
  'FileEditor',
  'FormGroup',
  'GenerationProgress',
  'GitHubAction',
  'GitHubCommit',
  'GitHubLoginCard',
  'GitHubRepoPicker',
  'Markdown',
  'ProgressSteps',
  'Questionnaire',
  'RadioGroup',
  'SteppedCarousel',
  'SummaryCard',
] as const;

let registry: ClientComponentRegistry;

beforeAll(() => {
  registry = new ClientComponentRegistry();
  for (const impl of fluentOverrides) registry.register(impl);
  for (const name of RICH_COMPONENT_NAMES) {
    registry.register({
      name,
      schema: z.object({}),
      render: () => null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  registry.seal();
});

describe('COMPONENT_PREVIEWS', () => {
  it('every preview root descriptor resolves through the sealed registry', () => {
    const unresolved: Array<{ key: string; component: string }> = [];
    for (const [key, descriptors] of Object.entries(COMPONENT_PREVIEWS)) {
      for (const d of descriptors) {
        const compName = d.component as string | undefined;
        if (!compName) continue;
        if (!registry.getImpl(compName)) {
          unresolved.push({ key, component: compName });
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('preview map keys are pack-qualified (core/Name) — descriptor values are bare', () => {
    for (const [key, descriptors] of Object.entries(COMPONENT_PREVIEWS)) {
      expect(key).toMatch(/^core\//);
      for (const d of descriptors) {
        if (typeof d.component === 'string') {
          expect(d.component, `preview "${key}" descriptor leaks pack prefix`).not.toMatch(/^core\//);
        }
      }
    }
  });

  it('validateAndSanitizeComponents produces NO _ErrorComponent for any COMPONENT_PREVIEWS entry (render-time guard)', () => {
    // This is the exact code path that fires inside A2UIEnvelopePreview / useA2UI.
    // If any descriptor would render as _ErrorComponent in the browser, this test fails.
    const errorEntries: Array<{ key: string; id: unknown; component: unknown }> = [];
    for (const [key, descriptors] of Object.entries(COMPONENT_PREVIEWS)) {
      const sanitized = validateAndSanitizeComponents(
        descriptors as Array<Record<string, unknown>>,
        registry,
      );
      for (const d of sanitized) {
        if (d.component === '_ErrorComponent') {
          errorEntries.push({ key, id: d.id, component: d.component });
        }
      }
    }
    expect(
      errorEntries,
      'Some COMPONENT_PREVIEWS descriptors resolved to _ErrorComponent — check registry names vs descriptor values',
    ).toEqual([]);
  });
});
