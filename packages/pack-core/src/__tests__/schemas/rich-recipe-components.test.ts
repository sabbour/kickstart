/**
 * @file rich-recipe-components.test.ts
 * @suite #231 — Phase 3 promoted recipe components
 *
 * Schema-level smoke tests for the 7 new rich components promoted from recipes
 * R1/R3/R5/R8/R9/R12/R16.  Each test verifies:
 *  1. A valid minimal payload parses successfully.
 *  2. The schema is strict (extra top-level keys are rejected).
 *
 * No JSX / DOM rendering needed here — component render smoke tests live in
 * the basic-components suite.  Schema tests run in Node (no jsdom).
 */

import { describe, it, expect } from 'vitest';
import {
  PlanSummarySchema,
  MigrationMappingTableSchema,
  DiffPlanSchema,
  CostCardSchema,
  JobToBeDoneTableSchema,
  ReviewPackSchema,
  CompatibilityScorecardSchema,
  RICH_COMPONENT_SCHEMAS,
} from '../../schemas/rich-component-schemas.js';

// ---------------------------------------------------------------------------
// PlanSummary (R1)
// ---------------------------------------------------------------------------

describe('PlanSummary schema (R1)', () => {
  const minimal = {
    id: 'ps-1',
    component: 'PlanSummary',
    title: 'Your plan',
    body: 'Single service, no existing manifests.',
    items: [{ label: 'AKS Automatic cluster' }, { label: '1 Deployment + 1 Service' }],
    primaryAction: 'Deploy now',
    secondaryAction: 'Customise',
    children: null,
  };

  it('accepts a valid payload', () => {
    expect(PlanSummarySchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts a minimal payload (items + actions optional)', () => {
    const min = { id: 'ps-2', component: 'PlanSummary' };
    expect(PlanSummarySchema.safeParse(min).success).toBe(true);
  });

  it('rejects extra top-level keys (strict)', () => {
    const extra = { ...minimal, unknownKey: 'oops' };
    expect(PlanSummarySchema.safeParse(extra).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// MigrationMappingTable (R3)
// ---------------------------------------------------------------------------

describe('MigrationMappingTable schema (R3)', () => {
  const minimal = {
    id: 'mmt-1',
    component: 'MigrationMappingTable',
    rows: [
      { from_source: 'Render Web Service', to_azure: 'AKS Deployment', why: 'Same model' },
    ],
  };

  it('accepts a valid payload', () => {
    expect(MigrationMappingTableSchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts an empty rows array', () => {
    expect(MigrationMappingTableSchema.safeParse({ id: 'mmt-2', component: 'MigrationMappingTable', rows: [] }).success).toBe(true);
  });

  it('rejects a row missing required fields', () => {
    const bad = { id: 'mmt-3', component: 'MigrationMappingTable', rows: [{ from_source: 'X' }] };
    expect(MigrationMappingTableSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra top-level keys', () => {
    expect(MigrationMappingTableSchema.safeParse({ ...minimal, extra: true }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DiffPlan (R5)
// ---------------------------------------------------------------------------

describe('DiffPlan schema (R5)', () => {
  const minimal = {
    id: 'dp-1',
    component: 'DiffPlan',
    lines: [
      { marker: '+', text: 'k8s/deployment.yml', annotation: 'new file' },
      { marker: '~', text: 'Dockerfile', annotation: '+3 lines' },
      { marker: ' ', text: '.gitignore' },
      { marker: '-', text: 'old.yml' },
    ],
    approveLabel: 'Approve',
  };

  it('accepts a valid payload with all marker types', () => {
    expect(DiffPlanSchema.safeParse(minimal).success).toBe(true);
  });

  it('rejects an invalid marker value', () => {
    const bad = { id: 'dp-2', component: 'DiffPlan', lines: [{ marker: '?', text: 'file.yml' }] };
    expect(DiffPlanSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra top-level keys', () => {
    expect(DiffPlanSchema.safeParse({ ...minimal, extra: 'nope' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CostCard (R16)
// ---------------------------------------------------------------------------

describe('CostCard schema (R16)', () => {
  const minimal = {
    id: 'cc-1',
    component: 'CostCard',
    lines: [
      { resource: 'AKS Automatic', sku: 'Standard_D4s_v5', qty: '1', unit: 'node', monthly: '$140' },
    ],
    priceNote: 'Live prices via Azure Retail Prices API',
  };

  it('accepts a valid payload', () => {
    expect(CostCardSchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts an empty lines array', () => {
    expect(CostCardSchema.safeParse({ id: 'cc-2', component: 'CostCard', lines: [] }).success).toBe(true);
  });

  it('rejects a line missing required fields', () => {
    const bad = { id: 'cc-3', component: 'CostCard', lines: [{ resource: 'AKS' }] };
    expect(CostCardSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra top-level keys', () => {
    expect(CostCardSchema.safeParse({ ...minimal, unknown: true }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// JobToBeDoneTable (R8)
// ---------------------------------------------------------------------------

describe('JobToBeDoneTable schema (R8)', () => {
  const minimal = {
    id: 'jt-1',
    component: 'JobToBeDoneTable',
    rows: [
      { you_want: 'Zero infra ops', how_aks: 'AKS Automatic manages node pools automatically' },
    ],
    reshapeLabel: 'Reshape for AKS',
  };

  it('accepts a valid payload', () => {
    expect(JobToBeDoneTableSchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts payload with all three action buttons', () => {
    const full = { ...minimal, stayLabel: 'Stay', exitLabel: 'Exit' };
    expect(JobToBeDoneTableSchema.safeParse(full).success).toBe(true);
  });

  it('rejects extra top-level keys', () => {
    expect(JobToBeDoneTableSchema.safeParse({ ...minimal, foo: 'bar' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ReviewPack (R9)
// ---------------------------------------------------------------------------

describe('ReviewPack schema (R9)', () => {
  const minimal = {
    id: 'rp-1',
    component: 'ReviewPack',
    files: [
      { name: 'k8s/deployment.yml', provenance: 'new', description: 'Core workload' },
    ],
    deliveryOptions: [
      { label: 'Open PR', channel: 'pr' },
      { label: 'Download ZIP', channel: 'zip' },
    ],
  };

  it('accepts a valid payload', () => {
    expect(ReviewPackSchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts files without optional provenance/description', () => {
    const min = { id: 'rp-2', component: 'ReviewPack', files: [{ name: 'main.ts' }] };
    expect(ReviewPackSchema.safeParse(min).success).toBe(true);
  });

  it('rejects invalid provenance value', () => {
    const bad = {
      id: 'rp-3', component: 'ReviewPack',
      files: [{ name: 'main.ts', provenance: 'unknown' }],
    };
    expect(ReviewPackSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects invalid delivery channel', () => {
    const bad = {
      id: 'rp-4', component: 'ReviewPack', files: [],
      deliveryOptions: [{ label: 'Email', channel: 'email' }],
    };
    expect(ReviewPackSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra top-level keys', () => {
    expect(ReviewPackSchema.safeParse({ ...minimal, extra: 'x' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CompatibilityScorecard (R12)
// ---------------------------------------------------------------------------

describe('CompatibilityScorecard schema (R12)', () => {
  const minimal = {
    id: 'cs-1',
    component: 'CompatibilityScorecard',
    buckets: [
      { bucket: 'incompatible', count: 1, description: 'hostNetwork: true not allowed' },
      { bucket: 'requiresChanges', count: 2 },
      { bucket: 'autoFixed', count: 3 },
      { bucket: 'informational', count: 5 },
    ],
    manifests: [
      { manifest: 'k8s/deployment.yml', findings: ['hostNetwork: true'] },
    ],
    specVersion: 'Source: constraint spec v1.2.0 AKS 2024-11',
  };

  it('accepts a valid payload with all 4 buckets', () => {
    expect(CompatibilityScorecardSchema.safeParse(minimal).success).toBe(true);
  });

  it('accepts a payload with no manifests', () => {
    const min = { id: 'cs-2', component: 'CompatibilityScorecard', buckets: [] };
    expect(CompatibilityScorecardSchema.safeParse(min).success).toBe(true);
  });

  it('rejects an invalid bucket value', () => {
    const bad = {
      id: 'cs-3', component: 'CompatibilityScorecard',
      buckets: [{ bucket: 'blocker', count: 1 }],
    };
    expect(CompatibilityScorecardSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects extra top-level keys', () => {
    expect(CompatibilityScorecardSchema.safeParse({ ...minimal, extra: 'nope' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RICH_COMPONENT_SCHEMAS registry
// ---------------------------------------------------------------------------

describe('RICH_COMPONENT_SCHEMAS — new entries registered', () => {
  const expectedNew = [
    'PlanSummary',
    'MigrationMappingTable',
    'DiffPlan',
    'CostCard',
    'JobToBeDoneTable',
    'ReviewPack',
    'CompatibilityScorecard',
  ];

  it.each(expectedNew)('has %s in the registry', (name) => {
    expect(RICH_COMPONENT_SCHEMAS.has(name)).toBe(true);
  });
});
