/**
 * Regression test for #954.
 *
 * Asserts every COMPONENT_PREVIEWS entry uses descriptor `component` values
 * that resolve through a registry seeded with the actual fluentOverrides +
 * rich components. Catches drift between `impl.name` (bare, e.g. "Text") and
 * the example map (which keys by pack-qualified id, e.g. "core/Text").
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { COMPONENT_PREVIEWS } from '../pages/component-examples';
import { ClientComponentRegistry } from '../contexts/A2UIRegistryContext';
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
});
