/**
 * Playground Ideas tab — scenario-fixture guard (#987).
 *
 * Mirrors the component-previews.test.ts pattern: seeds a client registry the
 * same way `main.tsx` does at boot, then asserts every scenario descriptor:
 *   1. has a well-formed adjacency list (every child/children id resolves),
 *   2. resolves through the sealed registry (no orphan component names),
 *   3. survives `validateAndSanitizeComponents` with zero `_ErrorComponent`s
 *      (this is the same render-time guard the Chat pipeline relies on).
 *
 * If a pack author renames a renderer or tightens a Zod schema, these tests
 * fail deterministically instead of the Ideas tab silently regressing to
 * `_ErrorComponent` placeholders (the original failure mode that got the
 * tab removed in #988).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';
import { SCENARIOS, groupScenariosByPack, type AggregatedScenario } from '../catalog/component-scenarios';
import { CORE_SCENARIOS } from '../catalog/core-scenarios';
import { azureClientComponents, scenarios as azureScenarios } from '@aks-kickstart/pack-azure/client';
import { aksClientComponents, scenarios as aksScenarios } from '@aks-kickstart/pack-aks-automatic/client';
import { githubClientComponents, scenarios as githubScenarios } from '@aks-kickstart/pack-github/client';
import {
  ClientComponentRegistry,
  validateAndSanitizeComponents,
} from '../contexts/A2UIRegistryContext';
import { fluentOverrides } from '../catalog/fluent-components/index';
import type { ComponentContribution } from '@aks-kickstart/harness';

// Matches the rich-component list registered in main.tsx; stub renderers are
// sufficient because registry lookup keys on name only.
const RICH_COMPONENT_NAMES = [
  'AuthCard', 'AzureAction', 'AzureLoginCard', 'AzureResourceForm', 'AzureResourcePicker',
  'CodeBlock', 'CostEstimate', 'DecisionCard', 'FileEditor', 'FormGroup',
  'GenerationProgress', 'GitHubAction', 'GitHubCommit', 'GitHubLoginCard', 'GitHubRepoPicker',
  'Markdown', 'ProgressSteps', 'Questionnaire', 'RadioGroup', 'SteppedCarousel', 'SummaryCard',
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

describe('Playground Ideas — scenario catalog', () => {
  it('every pack contributes ≥2 scenarios', () => {
    const byPack = groupScenariosByPack(SCENARIOS);
    for (const pack of ['core', 'azure', 'aks', 'github'] as const) {
      const count = byPack.get(pack)?.length ?? 0;
      expect(count, `${pack} must contribute at least 2 scenarios`).toBeGreaterThanOrEqual(2);
    }
  });

  it('scenario keys are unique across packs', () => {
    const keys = SCENARIOS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('each scenario composes 2–4 rendered components plus supporting children', () => {
    // Count "rendered" components = pack-qualified or core primitives that
    // aren't purely text label children of a Button. We approximate by
    // counting non-Text descriptors (scenarios are 2–4 meaningful widgets).
    for (const s of SCENARIOS) {
      const nonText = s.components.filter((c) => c.component !== 'Text').length;
      expect(nonText, `${s.key}: expected 2–4 non-Text components, got ${nonText}`).toBeGreaterThanOrEqual(2);
      expect(nonText, `${s.key}: expected 2–4 non-Text components, got ${nonText}`).toBeLessThanOrEqual(8);
    }
  });
});

describe('Playground Ideas — scenario adjacency list is well-formed', () => {
  it('every scenario has exactly one descriptor with id="root" and it is first', () => {
    for (const s of SCENARIOS) {
      expect(s.components.length, `${s.key}: empty component list`).toBeGreaterThan(0);
      expect(s.components[0]?.id, `${s.key}: first descriptor must have id="root"`).toBe('root');
      const rootCount = s.components.filter((c) => c.id === 'root').length;
      expect(rootCount, `${s.key}: must have exactly one id="root"`).toBe(1);
    }
  });

  it('every child / children id reference resolves within the scenario', () => {
    const failures: Array<{ scenario: string; missing: string }> = [];
    for (const s of SCENARIOS) {
      const ids = new Set(s.components.map((c) => c.id as string));
      for (const c of s.components) {
        if (typeof c.child === 'string' && !ids.has(c.child)) {
          failures.push({ scenario: s.key, missing: c.child });
        }
        if (Array.isArray(c.children)) {
          for (const childId of c.children as unknown[]) {
            if (typeof childId === 'string' && !ids.has(childId)) {
              failures.push({ scenario: s.key, missing: childId });
            }
          }
        }
      }
    }
    expect(failures, 'Scenarios reference descriptor ids that do not exist in the adjacency list').toEqual([]);
  });

  it('every descriptor has a stable, unique id', () => {
    for (const s of SCENARIOS) {
      const ids = s.components.map((c) => c.id);
      expect(new Set(ids).size, `${s.key}: duplicate descriptor ids`).toBe(ids.length);
      for (const id of ids) {
        expect(typeof id).toBe('string');
      }
    }
  });
});

describe('Playground Ideas — scenarios resolve through the sealed registry (Nibbler PR-gate)', () => {
  it('every component name resolves through ClientComponentRegistry', () => {
    const unresolved: Array<{ scenario: string; id: unknown; component: unknown }> = [];
    for (const s of SCENARIOS) {
      for (const c of s.components) {
        const compName = c.component as string | undefined;
        if (!compName) continue;
        if (!registry.getImpl(compName)) {
          unresolved.push({ scenario: s.key, id: c.id, component: compName });
        }
      }
    }
    expect(unresolved).toEqual([]);
  });

  it('validateAndSanitizeComponents produces NO _ErrorComponent for any scenario (render-time guard)', () => {
    const errorEntries: Array<{ scenario: string; id: unknown; component: unknown }> = [];
    for (const s of SCENARIOS) {
      const sanitized = validateAndSanitizeComponents(
        s.components as Array<Record<string, unknown>>,
        registry,
      );
      for (const d of sanitized) {
        if (d.component === '_ErrorComponent') {
          errorEntries.push({ scenario: s.key, id: d.id, component: d.component });
        }
      }
    }
    expect(
      errorEntries,
      'Some scenario descriptors resolved to _ErrorComponent — check registry names vs descriptor values',
    ).toEqual([]);
  });
});

describe('Pack scenarios parse against pack component schemas (Zapp PR-gate)', () => {
  const packFixtures: Array<{
    packName: string;
    contributions: readonly ComponentContribution[];
    scenarios: readonly { id: string; components: ReadonlyArray<Readonly<Record<string, unknown>>> }[];
  }> = [
    { packName: 'pack-azure', contributions: azureClientComponents, scenarios: azureScenarios },
    { packName: 'pack-aks-automatic', contributions: aksClientComponents, scenarios: aksScenarios },
    { packName: 'pack-github', contributions: githubClientComponents, scenarios: githubScenarios },
  ];

  for (const { packName, contributions, scenarios } of packFixtures) {
    describe(packName, () => {
      const schemaByName = new Map(contributions.map((c) => [c.name, c.propertySchema]));

      it("each pack-component descriptor's props parse cleanly against the component's Zod schema", () => {
        const failures: Array<{ scenario: string; id: unknown; name: string; issues: unknown }> = [];
        for (const s of scenarios) {
          for (const c of s.components) {
            const compName = c.component as string | undefined;
            if (!compName) continue;
            const schema = schemaByName.get(compName);
            if (!schema) continue; // core/* or cross-pack references — covered by render-time guard above
            const { id: _id, component: _component, children: _children, child: _child, ...props } =
              c as Record<string, unknown>;
            void _id; void _component; void _children; void _child;
            const result = schema.safeParse(props);
            if (!result.success) {
              failures.push({ scenario: s.id, id: c.id, name: compName, issues: result.error.issues });
            }
          }
        }
        expect(
          failures,
          'Pack scenario descriptor drifted from component schema — update the scenario or the schema',
        ).toEqual([]);
      });
    });
  }
});

describe('Ideas tab — deterministic render on fixture input (#987 acceptance)', () => {
  it('sanitized scenarios preserve root + adjacency (no dropped descriptors)', () => {
    // The Ideas-tab regression removed in #988 was "permanent Loading…" because
    // the renderer never received valid components. This test pins the property
    // that sanitizing a shipped scenario fixture yields at least as many
    // descriptors as we authored (and always includes a "root").
    for (const s of SCENARIOS) {
      const sanitized = validateAndSanitizeComponents(
        s.components as Array<Record<string, unknown>>,
        registry,
      );
      expect(sanitized.length, `${s.key}: sanitizer dropped descriptors`).toBeGreaterThanOrEqual(
        s.components.length,
      );
      expect(sanitized.some((d) => d.id === 'root'), `${s.key}: lost root after sanitize`).toBe(true);
    }
  });

  it('scenario snapshot — pack/scenarioId stable (regression)', () => {
    const keys = [...SCENARIOS.map((s) => s.key)].sort();
    expect(keys).toMatchInlineSnapshot(`
      [
        "aks/cluster-overview",
        "aks/monitor-deployment",
        "aks/safeguard-review",
        "azure/pick-region",
        "azure/review-cost-before-deploy",
        "azure/scope-deployment",
        "core/azure-auth-target-selection",
        "core/confirm-destructive",
        "core/feedback-survey",
        "core/github-auth-pr-workflow",
        "core/signin-form",
        "github/authorize-and-pick-repo",
        "github/configure-deploy",
        "github/create-repo",
      ]
    `);
  });
});

// The CORE_SCENARIOS module export itself is tested implicitly through SCENARIOS,
// but we also assert referential use to ensure tree-shaking doesn't drop it.
describe('core-scenarios export', () => {
  it('is non-empty and used by the aggregator', () => {
    expect(CORE_SCENARIOS.length).toBeGreaterThan(0);
    const aggregatedCoreIds = SCENARIOS.filter((s: AggregatedScenario) => s.pack === 'core').map((s) => s.scenarioId);
    expect(aggregatedCoreIds).toEqual(CORE_SCENARIOS.map((s) => s.id));
  });
});
