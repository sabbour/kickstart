/**
 * @file helm_template.test.ts
 * @suite core.helm_template — unit tests (#212)
 *
 * Tests:
 *   T1  — Happy path: valid chart renders successfully with source map
 *   T2  — parseChartMetadata extracts name/version/appVersion correctly
 *   T3  — buildSourceMap parses # Source: comments into entries
 *   T4  — buildSourceMap handles output with no Source comments (single block)
 *   T5  — Missing chart directory → helm exits non-zero → error JSON
 *   T6  — Helm not installed (ENOENT) → descriptive error JSON
 *   T7  — Invalid values file path (.. traversal) → thrown before helm call
 *   T8  — Invalid chartPath (.. traversal) → thrown before helm call
 *   T9  — Namespace passthrough: namespace arg forwarded to helm
 *   T10 — Schema strict-mode conformance: no strictOptional violations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  assertStrictlyConformant,
  getToolJsonSchema,
  walkSchema,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import type { SchemaNode } from '@aks-kickstart/harness/runtime/schema-conformance';
import {
  helmTemplateTool,
  runHelmTemplate,
  buildSourceMap,
  parseChartMetadata,
  resolveChartPath,
  resolveValuesPath,
} from '../helm_template.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const mockedExecFile = vi.mocked(execFile);
const mockedReadFile = vi.mocked(readFile);

// promisify(execFile) calls execFile with (cmd, args, opts, callback).
// Our mock helpers below set up the callback at position 3.
type ExecCallback = (err: Error | null, result?: { stdout: string; stderr: string }) => void;

function mockExecSuccess(stdout: string): void {
  mockedExecFile.mockImplementation(
    (_cmd: string, _args: readonly string[], _opts: unknown, cb: unknown) => {
      (cb as ExecCallback)(null, { stdout, stderr: '' });
    },
  );
}

function mockExecError(err: Error): void {
  mockedExecFile.mockImplementation(
    (_cmd: string, _args: readonly string[], _opts: unknown, cb: unknown) => {
      (cb as ExecCallback)(err);
    },
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAMPLE_CHART_YAML = `
apiVersion: v2
name: my-app
description: A sample chart
version: 1.2.3
appVersion: "2.0.0"
`.trim();

const SAMPLE_RENDERED = `
---
# Source: my-app/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: release-my-app
---
# Source: my-app/templates/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: release-my-app
`.trim();

const WORKSPACE = '/workspace/project';

// ── Helper ────────────────────────────────────────────────────────────────────

async function invokeToolRaw(input: Record<string, unknown>): Promise<unknown> {
  const sdkTool = helmTemplateTool.tool as { invoke: (ctx: unknown, input: string) => Promise<string> };
  const raw = await sdkTool.invoke(
    { usage: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
    JSON.stringify(input),
  );
  return JSON.parse(raw);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parseChartMetadata', () => {
  it('T2 — extracts name, version, appVersion', () => {
    const meta = parseChartMetadata(SAMPLE_CHART_YAML);
    expect(meta.name).toBe('my-app');
    expect(meta.version).toBe('1.2.3');
    expect(meta.appVersion).toBe('2.0.0');
  });

  it('returns empty strings for missing fields', () => {
    const meta = parseChartMetadata('name: only-name\n');
    expect(meta.name).toBe('only-name');
    expect(meta.version).toBe('');
    expect(meta.appVersion).toBe('');
  });
});

describe('buildSourceMap', () => {
  it('T3 — parses Source comments into entries', () => {
    const entries = buildSourceMap(SAMPLE_RENDERED);
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const deployment = entries.find((e) => e.sourceFile.includes('deployment.yaml'));
    expect(deployment).toBeDefined();
    expect(deployment!.sourceKind).toBe('template');
    expect(deployment!.renderedLineRange[0]).toBeLessThan(deployment!.renderedLineRange[1]);

    const service = entries.find((e) => e.sourceFile.includes('service.yaml'));
    expect(service).toBeDefined();
    expect(service!.sourceKind).toBe('template');
  });

  it('T4 — handles output with no Source comments (single block)', () => {
    const noSource = 'apiVersion: v1\nkind: Namespace\nmetadata:\n  name: test\n';
    const entries = buildSourceMap(noSource);
    // No Source comments → no entries created (currentSource remains null)
    expect(entries).toHaveLength(0);
  });

  it('classifies Chart.yaml source as "chart" kind', () => {
    const yaml = '# Source: my-app/Chart.yaml\nsome: value\n';
    const entries = buildSourceMap(yaml);
    expect(entries[0]?.sourceKind).toBe('chart');
  });

  it('classifies values files as "values" kind', () => {
    const yaml = '# Source: my-app/values.yaml\nsome: value\n';
    const entries = buildSourceMap(yaml);
    expect(entries[0]?.sourceKind).toBe('values');
  });
});

describe('resolveChartPath', () => {
  it('T8 — rejects .. traversal', () => {
    expect(() => resolveChartPath(WORKSPACE, '../outside')).toThrow(/traversal/);
  });

  it('rejects null bytes', () => {
    expect(() => resolveChartPath(WORKSPACE, 'my\0chart')).toThrow(/null byte/);
  });

  it('resolves relative paths within workspace', () => {
    const resolved = resolveChartPath(WORKSPACE, 'helm/mychart');
    expect(resolved).toBe(`${WORKSPACE}/helm/mychart`);
  });
});

describe('resolveValuesPath', () => {
  it('T7 — rejects .. traversal in values file', () => {
    expect(() =>
      resolveValuesPath(WORKSPACE, `${WORKSPACE}/helm/chart`, '../../../etc/passwd'),
    ).toThrow(/traversal/);
  });

  it('T7b — BLOCKING: rejects absolute values path that escapes workspace root', () => {
    expect(() =>
      resolveValuesPath(WORKSPACE, `${WORKSPACE}/helm/chart`, '/etc/cloud/credentials.yaml'),
    ).toThrow(/escapes workspace root/);
  });

  it('resolves relative values file against chartPath', () => {
    const resolved = resolveValuesPath(WORKSPACE, `${WORKSPACE}/helm/chart`, 'custom-values.yaml');
    expect(resolved).toBe(`${WORKSPACE}/helm/chart/custom-values.yaml`);
  });

  it('accepts an absolute values path within the workspace', () => {
    const absInWorkspace = `${WORKSPACE}/overrides/prod.yaml`;
    const resolved = resolveValuesPath(WORKSPACE, `${WORKSPACE}/helm/chart`, absInWorkspace);
    expect(resolved).toBe(absInWorkspace);
  });

  it('rejects null bytes in values file', () => {
    expect(() =>
      resolveValuesPath(WORKSPACE, `${WORKSPACE}/helm/chart`, 'val\0ues.yaml'),
    ).toThrow(/null byte/);
  });
});

describe('runHelmTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T1 — happy path: returns renderedYaml, sourceMap, chartMetadata', async () => {
    mockExecSuccess(SAMPLE_RENDERED);
    mockedReadFile.mockResolvedValueOnce(SAMPLE_CHART_YAML as unknown as Uint8Array);

    const result = await runHelmTemplate(WORKSPACE, {
      chartPath: `${WORKSPACE}/helm/my-app`,
      valuesFiles: [],
    });

    expect(result.renderedYaml).toContain('Deployment');
    expect(result.chartMetadata.name).toBe('my-app');
    expect(result.chartMetadata.version).toBe('1.2.3');
    expect(result.sourceMap.length).toBeGreaterThan(0);
  });

  it('T6 — helm not installed (ENOENT) → descriptive error with cause', async () => {
    const enoentErr = Object.assign(new Error('spawn helm ENOENT'), { code: 'ENOENT' });
    mockExecError(enoentErr);

    const thrown = await runHelmTemplate(WORKSPACE, {
      chartPath: `${WORKSPACE}/helm/my-app`,
      valuesFiles: [],
    }).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/helm binary not found/);
    expect((thrown as Error & { cause?: unknown }).cause).toBe(enoentErr);
  });

  it('T5 — helm exits non-zero (missing chart) → error surfaced with cause', async () => {
    const exitErr = new Error('Error: path "/no/chart" not found');
    mockExecError(exitErr);

    const thrown = await runHelmTemplate(WORKSPACE, {
      chartPath: `${WORKSPACE}/helm/missing`,
      valuesFiles: [],
    }).catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/helm template failed/);
    expect((thrown as Error & { cause?: unknown }).cause).toBe(exitErr);
  });

  it('T9 — namespace is forwarded to helm args', async () => {
    mockedExecFile.mockImplementation(
      (_cmd: string, args: readonly string[], _opts: unknown, cb: unknown) => {
        expect(args).toContain('--namespace');
        expect(args).toContain('kube-system');
        (cb as ExecCallback)(null, { stdout: SAMPLE_RENDERED, stderr: '' });
      },
    );
    mockedReadFile.mockResolvedValueOnce(SAMPLE_CHART_YAML as unknown as Uint8Array);

    await runHelmTemplate(WORKSPACE, {
      chartPath: `${WORKSPACE}/helm/my-app`,
      valuesFiles: [],
      namespace: 'kube-system',
    });
  });
});

describe('core.helm_template schema — strict-mode conformance (T10)', () => {
  const schema = getToolJsonSchema(helmTemplateTool) as SchemaNode;

  it('T10a: no $ref node has sibling keywords', () => {
    const violations: string[] = [];
    walkSchema(schema, 'root', (n, p) => {
      if ('$ref' in n && Object.keys(n).length > 1) {
        const siblings = Object.keys(n).filter((k) => k !== '$ref').join(', ');
        violations.push(`${p}: $ref has siblings {${siblings}}`);
      }
    });
    expect(violations).toHaveLength(0);
  });

  it('T10b: assertStrictlyConformant passes (OpenAI SDK transform)', () => {
    expect(() => assertStrictlyConformant(schema, 'core.helm_template')).not.toThrow();
  });
});
