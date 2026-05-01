/**
 * Regression guard for COMPONENT_PREVIEWS → ClientComponentRegistry drift.
 *
 * Updated for #991 (pack rendering via the engine): the preview map now
 * aggregates:
 *   - core/* previews from packages/web/src/catalog/core-previews.ts
 *   - azure/*, aks/*, github/* previews pack-contributed via
 *     @aks-kickstart/pack-{azure,aks-automatic,github}/client
 *
 * Every preview descriptor MUST resolve through a registry seeded the same way
 * `main.tsx` seeds it at boot. If any pack's `previews` export drifts from its
 * `clientComponents`, the render-time guard below fails instead of silently
 * rendering `_ErrorComponent`.
 *
 * Separately asserts that each pack's fixtures parse against the component's
 * Zod schema — Zapp's PR-gate condition from the DP review.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { COMPONENT_PREVIEWS } from '../catalog/component-previews';
import {
  azureClientComponents,
  previews as azurePreviews,
} from '@aks-kickstart/pack-azure/client';
import {
  aksClientComponents,
  previews as aksPreviews,
} from '@aks-kickstart/pack-aks-automatic/client';
import {
  githubClientComponents,
  previews as githubPreviews,
} from '@aks-kickstart/pack-github/client';
import {
  ClientComponentRegistry,
  validateAndSanitizeComponents,
} from '../contexts/A2UIRegistryContext';
import { fluentOverrides } from '../catalog/fluent-components/index';
import type { ComponentContribution } from '@aks-kickstart/harness';

// Mirrors the rich-component list registered in main.tsx. We register stub
// renderers (the registry only checks names, not behavior) to avoid pulling
// in the real rich-component module graph (which transitively requires
// optional harness runtime deps).
const RICH_COMPONENT_NAMES = [
  'ArchitectureDiagram',
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

const ALL_PACK_COMPONENTS: readonly ComponentContribution[] = [
  ...azureClientComponents,
  ...aksClientComponents,
  ...githubClientComponents,
];

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
  // Pack components: register under their pack-qualified names, same as main.tsx
  // does through adaptPackComponent. The registry only keys on `name`, so a
  // lightweight stub is sufficient for resolution testing.
  for (const contribution of ALL_PACK_COMPONENTS) {
    registry.register({
      name: contribution.name,
      schema: z.object({}),
      render: () => null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
  registry.seal();
});

describe('COMPONENT_PREVIEWS', () => {
  it('every preview descriptor resolves through the sealed registry', () => {
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

  it('preview map keys are pack-qualified (pack/Name)', () => {
    for (const key of Object.keys(COMPONENT_PREVIEWS)) {
      expect(key).toMatch(/^(core|azure|aks|github)\//);
    }
  });

  it('core/* descriptor values are bare; pack/* descriptor values are qualified', () => {
    for (const [key, descriptors] of Object.entries(COMPONENT_PREVIEWS)) {
      const isCoreKey = key.startsWith('core/');
      for (const d of descriptors) {
        if (typeof d.component !== 'string') continue;
        if (isCoreKey) {
          expect(d.component, `core preview "${key}" descriptor leaks pack prefix`).not.toMatch(/^core\//);
        } else {
          // Pack descriptors MUST be qualified so they look up pack renderers
          // in the registry rather than colliding with core names.
          expect(d.component, `pack preview "${key}" must use qualified names`).toMatch(/\//);
        }
      }
    }
  });

  it('validateAndSanitizeComponents produces NO _ErrorComponent for any COMPONENT_PREVIEWS entry (render-time guard)', () => {
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

describe('Pack previews parse against pack component schemas (Zapp PR-gate)', () => {
  const packFixtures: Array<{
    packName: string;
    contributions: readonly ComponentContribution[];
    previews: Readonly<Record<string, Array<Record<string, unknown>>>>;
  }> = [
    { packName: 'pack-azure', contributions: azureClientComponents, previews: azurePreviews },
    { packName: 'pack-aks-automatic', contributions: aksClientComponents, previews: aksPreviews },
    { packName: 'pack-github', contributions: githubClientComponents, previews: githubPreviews },
  ];

  for (const { packName, contributions, previews } of packFixtures) {
    describe(packName, () => {
      it('every clientComponents entry has a previews fixture', () => {
        const missing = contributions
          .map((c) => c.name)
          .filter((name) => !(name in previews));
        expect(missing, `${packName}: components without previews`).toEqual([]);
      });

      it('every previews key maps to a registered component', () => {
        const registeredNames = new Set(contributions.map((c) => c.name));
        const orphans = Object.keys(previews).filter((k) => !registeredNames.has(k));
        expect(orphans, `${packName}: previews for unknown components`).toEqual([]);
      });

      it("each fixture's root descriptor parses cleanly against the component's Zod schema", () => {
        const failures: Array<{ name: string; issues: unknown }> = [];
        for (const contribution of contributions) {
          const fixture = previews[contribution.name];
          if (!fixture || fixture.length === 0) continue;
          const root = fixture[0]!;
          // Strip envelope keys that aren't part of the renderer's prop surface.
          const { id: _id, component: _component, children: _children, child: _child, ...props } =
            root as Record<string, unknown>;
          void _id;
          void _component;
          void _children;
          void _child;
          const result = contribution.propertySchema.safeParse(props);
          if (!result.success) {
            failures.push({ name: contribution.name, issues: result.error.issues });
          }
        }
        expect(
          failures,
          'Pack preview fixture drifted from component schema — update the fixture or the schema',
        ).toEqual([]);
      });
    });
  }
});

describe('clientRegistry.getNames() snapshot (regression)', () => {
  // Pinning the aggregate list of names keeps a structural rail so accidental
  // removal (or name rename) of a pack component trips this test instead of
  // silently breaking the allow-list ↔ registry guard.
  it('pack-qualified names are stable', () => {
    const names = [...ALL_PACK_COMPONENTS.map((c) => c.name)].sort();
    expect(names).toMatchInlineSnapshot(`
      [
        "aks/AksClusterCard",
        "aks/ArchitectureDiagram",
        "aks/DeploymentProgress",
        "aks/SafeguardViolations",
        "azure/AzureAction",
        "azure/AzureResourceCard",
        "azure/BicepEditor",
        "azure/CostEstimate",
        "azure/DeploymentStatus",
        "azure/LocationSelector",
        "azure/ResourceGroupSelector",
        "azure/SubscriptionSelector",
        "github/Action",
        "github/CreatePRFlow",
        "github/Login",
        "github/OrgPicker",
        "github/RepoInfo",
        "github/RepoPicker",
        "github/SecretSetter",
      ]
    `);
  });
});
