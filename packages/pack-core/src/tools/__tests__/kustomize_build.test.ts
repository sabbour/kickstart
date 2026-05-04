/**
 * @file kustomize_build.test.ts
 * @suite core.kustomize_build unit tests (#213 + Zapp + Nibbler findings)
 *
 * Tests:
 *   T1 — Happy path: kustomize returns valid YAML with Source annotations → renderedYaml + sourceMap
 *   T2 — kustomize not installed → structured error, empty renderedYaml
 *   T3 — kustomize exits non-zero (invalid overlay) → structured error with stderr excerpt
 *   T4 — validateBoundedPath: path with traversal segments → boundary error
 *   T5 — parseSourceMap: single block without Source annotation → empty sourceMap
 *   T6 — parseSourceMap: multiple Source blocks → correct line ranges and sourceKind classification
 *   T7 — classifySourceKind: patch / overlay / base heuristics
 *   T8 — validateBoundedPath: /safe/.. (no trailing slash) bypasses regex but is caught by normalize
 *   T9 — absolute path outside workspace root → boundary error (basePath removed from schema)
 *   T10 — Secret data: and stringData: values redacted in renderedYaml; non-Secret data: untouched
 *   T11 — exceeded flag set by SIGKILL → byte-limit error (not generic code=null failure)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createKustomizeBuildTool,
  parseSourceMap,
  classifySourceKind,
  validateBoundedPath,
  redactSecretValues,
  _deps as kustomizeBuildDeps,
} from '../kustomize_build.js';
import type { KustomizeBuildOutput } from '../kustomize_build.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a test tool instance confined to `workspaceRoot` (defaults to '/workspace')
 * and invoke it with the given input.
 */
async function runTool(
  input: { overlayPath: string },
  workspaceRoot = '/workspace',
): Promise<KustomizeBuildOutput & { error?: string }> {
  const contrib = createKustomizeBuildTool(workspaceRoot);
  const sdkTool = contrib.tool as { invoke: (ctx: unknown, input: string) => Promise<string> };
  const raw = await sdkTool.invoke(
    { usage: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 } },
    JSON.stringify(input),
  );
  return JSON.parse(raw) as KustomizeBuildOutput & { error?: string };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('core.kustomize_build', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // T1 — happy path
  it('T1 — returns renderedYaml and sourceMap when kustomize succeeds', async () => {
    const fakeYaml = [
      '# Source: base/deployment.yaml',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: my-app',
      '---',
      '# Source: overlays/production/service.yaml',
      'apiVersion: v1',
      'kind: Service',
    ].join('\n');

    vi.spyOn(kustomizeBuildDeps, 'spawnKustomize').mockResolvedValueOnce({
      stdout: fakeYaml,
      stderr: '',
      code: 0,
      exceeded: false,
    });

    const result = await runTool({ overlayPath: '/workspace/overlays/prod' });

    expect(result.error).toBeUndefined();
    expect(result.renderedYaml).toBe(fakeYaml);
    expect(result.sourceMap).toHaveLength(2);
    expect(result.sourceMap[0].sourceFile).toBe('base/deployment.yaml');
    expect(result.sourceMap[0].renderedLineRange[0]).toBe(1);
    expect(result.sourceMap[1].sourceFile).toBe('overlays/production/service.yaml');
  });

  // T2 — kustomize not installed
  it('T2 — returns structured error when kustomize is not installed', async () => {
    vi.spyOn(kustomizeBuildDeps, 'spawnKustomize').mockResolvedValueOnce({
      stdout: '',
      stderr: 'executable file not found in $PATH',
      code: -1,
      exceeded: false,
    });

    const result = await runTool({ overlayPath: '/workspace/overlays/prod' });

    expect(result.error).toMatch(/not installed/i);
    expect(result.renderedYaml).toBe('');
    expect(result.sourceMap).toEqual([]);
  });

  // T3 — invalid overlay path (kustomize non-zero exit)
  it('T3 — returns structured error when kustomize exits non-zero', async () => {
    vi.spyOn(kustomizeBuildDeps, 'spawnKustomize').mockResolvedValueOnce({
      stdout: '',
      stderr: 'must run in a kustomization directory',
      code: 1,
      exceeded: false,
    });

    const result = await runTool({ overlayPath: '/workspace/not-kustomize' });

    expect(result.error).toMatch(/kustomize build failed/i);
    expect(result.error).toContain('must run in a kustomization directory');
    expect(result.renderedYaml).toBe('');
  });

  // T9 — absolute overlayPath outside workspace root (Nibbler: absolute paths must be boundary-checked)
  it('T9 — returns structured error when absolute overlayPath escapes workspace root', async () => {
    const spawnSpy = vi.spyOn(kustomizeBuildDeps, 'spawnKustomize');
    const result = await runTool({ overlayPath: '/etc/passwd' });

    expect(result.error).toMatch(/outside workspace root/i);
    expect(result.renderedYaml).toBe('');
    expect(spawnSpy).not.toHaveBeenCalled();
  });

  // T11 — exceeded flag (Nibbler: SIGKILL sets code=null, byte-limit message was unreachable)
  it('T11 — returns byte-limit error when exceeded flag is set (code=null from SIGKILL)', async () => {
    vi.spyOn(kustomizeBuildDeps, 'spawnKustomize').mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      code: null,   // SIGKILL — not -1, not 0
      exceeded: true,
    });

    const result = await runTool({ overlayPath: '/workspace/overlays/prod' });

    expect(result.error).toMatch(/exceeds.*byte limit/i);
    expect(result.renderedYaml).toBe('');
    expect(result.sourceMap).toEqual([]);
  });
});

// ── validateBoundedPath ───────────────────────────────────────────────────────

describe('validateBoundedPath', () => {
  const ROOT = '/workspace';

  // T4 — trailing-slash traversal (caught by regex AND by normalize)
  it('T4 — throws for path with explicit ../ traversal', () => {
    expect(() => validateBoundedPath('../etc/passwd', ROOT, 'overlayPath'))
      .toThrow(/outside workspace root/i);
  });

  // T8 — THE KEY ZAPP FINDING: /workspace/.. (no trailing slash)
  //      Old regex (/\.\.[/\\]/) does NOT match "/workspace/.." (no trailing slash after ..)
  //      but normalize('/workspace/..') → '/' which is outside /workspace
  it('T8 — /workspace/.. (no trailing slash) is caught by normalize+prefix check', () => {
    expect(() => validateBoundedPath('/workspace/..', ROOT, 'overlayPath'))
      .toThrow(/outside workspace root/i);
  });

  it('T8b — deeply nested traversal /workspace/a/b/../../../etc is caught', () => {
    expect(() => validateBoundedPath('/workspace/a/b/../../../etc', ROOT, 'overlayPath'))
      .toThrow(/outside workspace root/i);
  });

  it('T4b — path exactly equal to workspaceRoot is allowed', () => {
    expect(() => validateBoundedPath(ROOT, ROOT, 'overlayPath')).not.toThrow();
  });

  it('T4c — path inside workspaceRoot is allowed', () => {
    expect(validateBoundedPath('/workspace/overlays/prod', ROOT, 'overlayPath'))
      .toBe('/workspace/overlays/prod');
  });

  it('rejects null byte injection', () => {
    expect(() => validateBoundedPath('/workspace/over\0lay', ROOT, 'overlayPath'))
      .toThrow(/null byte/i);
  });
});

// ── redactSecretValues ────────────────────────────────────────────────────────

describe('redactSecretValues', () => {
  // T10a — Secret data: values are redacted
  it('T10a — redacts data: values in a Secret document', () => {
    const yaml = [
      'apiVersion: v1',
      'kind: Secret',
      'metadata:',
      '  name: db-creds',
      'data:',
      '  password: c2VjcmV0cGFzcw==',
      '  username: YWRtaW4=',
    ].join('\n');

    const result = redactSecretValues(yaml);
    expect(result).toContain('password: [REDACTED]');
    expect(result).toContain('username: [REDACTED]');
    expect(result).not.toContain('c2VjcmV0cGFzcw==');
    expect(result).not.toContain('YWRtaW4=');
  });

  // T10b — stringData: values are redacted
  it('T10b — redacts stringData: values in a Secret document', () => {
    const yaml = [
      'apiVersion: v1',
      'kind: Secret',
      'metadata:',
      '  name: api-key',
      'stringData:',
      '  token: my-plain-text-secret',
    ].join('\n');

    const result = redactSecretValues(yaml);
    expect(result).toContain('token: [REDACTED]');
    expect(result).not.toContain('my-plain-text-secret');
  });

  // T10c — ConfigMap data: is NOT redacted
  it('T10c — ConfigMap data: values are NOT redacted', () => {
    const yaml = [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      '  name: app-config',
      'data:',
      '  LOG_LEVEL: info',
      '  MAX_RETRIES: "3"',
    ].join('\n');

    const result = redactSecretValues(yaml);
    expect(result).toContain('LOG_LEVEL: info');
    expect(result).toContain('MAX_RETRIES: "3"');
  });

  // T10d — multi-document: Secret redacted, Deployment untouched
  it('T10d — in multi-document YAML only the Secret document is redacted', () => {
    const yaml = [
      '# Source: base/deployment.yaml',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: app',
      '---',
      '# Source: base/secret.yaml',
      'apiVersion: v1',
      'kind: Secret',
      'metadata:',
      '  name: app-secret',
      'data:',
      '  key: c2VjcmV0',
    ].join('\n');

    const result = redactSecretValues(yaml);
    // Deployment untouched
    expect(result).toContain('kind: Deployment');
    expect(result).toContain('name: app');
    // Secret data redacted
    expect(result).toContain('key: [REDACTED]');
    expect(result).not.toContain('c2VjcmV0');
  });

  // T10e — YAML with no Secrets passes through unchanged
  it('T10e — YAML with no Secrets is returned unchanged', () => {
    const yaml = 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app\n';
    expect(redactSecretValues(yaml)).toBe(yaml);
  });
});

// ── parseSourceMap ────────────────────────────────────────────────────────────

describe('parseSourceMap', () => {
  // T5 — no Source annotations
  it('T5 — returns empty sourceMap when no Source annotations present', () => {
    const yaml = 'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: cm\n';
    expect(parseSourceMap(yaml, '/overlay')).toEqual([]);
  });

  // T6 — multiple Source blocks
  it('T6 — records correct line ranges for multiple Source blocks', () => {
    const yaml = [
      '# Source: base/deploy.yaml',  // line 1
      'apiVersion: apps/v1',          // line 2
      'kind: Deployment',             // line 3
      '---',                          // line 4
      '# Source: overlays/svc.yaml', // line 5
      'apiVersion: v1',               // line 6
      'kind: Service',                // line 7
    ].join('\n');

    const map = parseSourceMap(yaml, '/overlay');
    expect(map).toHaveLength(2);

    expect(map[0].renderedLineRange).toEqual([1, 4]);
    expect(map[0].sourceFile).toBe('base/deploy.yaml');

    expect(map[1].renderedLineRange[0]).toBe(5);
    expect(map[1].sourceFile).toBe('overlays/svc.yaml');
  });
});

// ── classifySourceKind ────────────────────────────────────────────────────────

describe('classifySourceKind', () => {
  // T7 — heuristics
  it('T7a — path containing /patch/ → patch', () => {
    expect(classifySourceKind('/overlay/patches/add-label.yaml', '/overlay')).toBe('patch');
  });

  it('T7b — path inside overlayPath → overlay', () => {
    expect(classifySourceKind('/overlay/kustomization.yaml', '/overlay')).toBe('overlay');
  });

  it('T7c — path outside overlayPath → base', () => {
    expect(classifySourceKind('/base/deployment.yaml', '/overlay')).toBe('base');
  });
});

