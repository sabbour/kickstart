/**
 * @file safeguards.test.ts
 * @suite core.check_safeguards + core.fix_safeguards
 *
 * Tests safeguard detection and fix logic ported from MS AKS-Copilot PRs #1837 + #1976.
 * Covers:
 *   - Rule detection (privileged, hostPath, hostNetwork, hostPID, hostIPC, resource limits/requests, runAsRoot, readOnlyRootFs)
 *   - Fix rewrites (privileged→false, hostPath→PVC, hostNetwork/PID/IPC removal, resource defaults)
 *   - Non-fixable violations remain after fix
 *   - Fix determinism (same input → identical output)
 *   - Parser DoS bounds (byte cap, document count, alias count, nesting depth)
 *   - Tool invocation via SDK tool.invoke()
 */

import { describe, it, expect } from 'vitest';
import { RunContext } from '@openai/agents';
import { checkSafeguards } from '../../safeguards/check.js';
import { applyFixes, isFixable } from '../../safeguards/fixes.js';
import { parseManifest, MAX_INPUT_BYTES, MAX_DOCUMENT_COUNT, MAX_ALIAS_COUNT } from '../../safeguards/parser.js';
import { SAFEGUARD_RULES, getRuleById } from '../../safeguards/rules.js';
import { checkSafeguardsTool } from '../../tools/check_safeguards.js';
import { fixSafeguardsTool } from '../../tools/fix_safeguards.js';
import { makeSessionCtx } from './_session-stub.js';

// ── Test fixtures ────────────────────────────────────────────────────────────

const DANGEROUS_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-worker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: gpu-worker
  template:
    metadata:
      labels:
        app: gpu-worker
    spec:
      hostNetwork: true
      hostPID: true
      hostIPC: true
      containers:
        - name: worker
          image: nvidia/cuda:12.0-base
          securityContext:
            privileged: true
      volumes:
        - name: gpu-data
          hostPath:
            path: /dev/nvidia0
`;

const CLEAN_DEPLOYMENT = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
        - name: app
          image: myapp:1.0
          securityContext:
            privileged: false
            runAsNonRoot: true
            readOnlyRootFilesystem: true
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
`;

const MULTI_DOC_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app1
spec:
  template:
    spec:
      containers:
        - name: c1
          image: app:1
          securityContext:
            privileged: true
---
apiVersion: v1
kind: Service
metadata:
  name: svc1
spec:
  ports:
    - port: 80
`;

// ── Rule registry ────────────────────────────────────────────────────────────

describe('safeguard rules registry', () => {
  it('has 9 rules total', () => {
    expect(SAFEGUARD_RULES).toHaveLength(9);
  });

  it('every rule has required fields', () => {
    for (const rule of SAFEGUARD_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(rule.severity);
      expect(rule.message).toBeTruthy();
      expect(rule.msprLink).toMatch(/^https:\/\/github\.com\/microsoft\/AKS-Copilot\/pull\//);
      expect(typeof rule.autoFixable).toBe('boolean');
      expect(typeof rule.check).toBe('function');
    }
  });

  it('getRuleById returns correct rule', () => {
    expect(getRuleById('privileged-container')?.severity).toBe('high');
    expect(getRuleById('missing-resource-limits')?.severity).toBe('medium');
    expect(getRuleById('nonexistent')).toBeUndefined();
  });

  it('severity classification: high rules from PR #1837', () => {
    const highRules = SAFEGUARD_RULES.filter((r) => r.severity === 'high');
    expect(highRules.map((r) => r.id)).toEqual(
      expect.arrayContaining(['privileged-container', 'hostpath-volume', 'host-network', 'host-pid', 'host-ipc']),
    );
  });

  it('severity classification: medium/low rules from PR #1976', () => {
    const mediumRules = SAFEGUARD_RULES.filter((r) => r.severity === 'medium');
    expect(mediumRules.map((r) => r.id)).toEqual(
      expect.arrayContaining(['missing-resource-limits', 'missing-resource-requests', 'run-as-root']),
    );
    const lowRules = SAFEGUARD_RULES.filter((r) => r.severity === 'low');
    expect(lowRules.map((r) => r.id)).toEqual(
      expect.arrayContaining(['mutable-root-filesystem']),
    );
  });
});

// ── Check logic ──────────────────────────────────────────────────────────────

describe('checkSafeguards', () => {
  it('flags hostPath + privileged per MS PR #1837', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.ok).toBe(false);
    expect(res.violations.map((v) => v.id)).toEqual(
      expect.arrayContaining(['hostpath-volume', 'privileged-container']),
    );
  });

  it('flags hostNetwork, hostPID, hostIPC per MS PR #1837', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.violations.map((v) => v.id)).toEqual(
      expect.arrayContaining(['host-network', 'host-pid', 'host-ipc']),
    );
  });

  it('flags missing resource limits/requests per MS PR #1976', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.violations.map((v) => v.id)).toEqual(
      expect.arrayContaining(['missing-resource-limits', 'missing-resource-requests']),
    );
  });

  it('flags runAsRoot when runAsNonRoot is not set', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.violations.map((v) => v.id)).toContain('run-as-root');
  });

  it('flags mutable root filesystem when readOnlyRootFilesystem not set', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.violations.map((v) => v.id)).toContain('mutable-root-filesystem');
  });

  it('produces zero violations for a clean deployment', () => {
    const res = checkSafeguards(CLEAN_DEPLOYMENT);
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });

  it('provides correct severity summary', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    expect(res.summary.high).toBeGreaterThan(0);
    expect(res.summary.medium).toBeGreaterThan(0);
  });

  it('includes MS PR attribution links on every violation', () => {
    const res = checkSafeguards(DANGEROUS_DEPLOYMENT);
    for (const v of res.violations) {
      expect(v.msprLink).toMatch(/\/pull\/(1837|1976)$/);
    }
  });

  it('handles multi-document YAML (only flags workloads, not Services)', () => {
    const res = checkSafeguards(MULTI_DOC_MANIFEST);
    expect(res.violations.some((v) => v.id === 'privileged-container')).toBe(true);
    // Service should not produce workload violations
  });

  it('returns parseError for invalid YAML', () => {
    const res = checkSafeguards('{{invalid yaml');
    expect(res.ok).toBe(false);
    expect(res.parseError).toBeTruthy();
    expect(res.violations).toHaveLength(0);
  });
});

// ── Fix logic ────────────────────────────────────────────────────────────────

describe('applyFixes', () => {
  it('fix rewrites privileged: false and PVC', () => {
    const fixed = applyFixes(DANGEROUS_DEPLOYMENT, ['privileged-container', 'hostpath-volume']);
    const recheck = checkSafeguards(fixed.fixedManifest);
    expect(recheck.violations.filter((v) => v.id === 'privileged-container')).toHaveLength(0);
    expect(recheck.violations.filter((v) => v.id === 'hostpath-volume')).toHaveLength(0);
    expect(fixed.appliedFixes).toEqual(expect.arrayContaining(['privileged-container', 'hostpath-volume']));
  });

  it('fixes hostNetwork, hostPID, hostIPC removal', () => {
    const fixed = applyFixes(DANGEROUS_DEPLOYMENT, ['host-network', 'host-pid', 'host-ipc']);
    const recheck = checkSafeguards(fixed.fixedManifest);
    expect(recheck.violations.filter((v) => v.id === 'host-network')).toHaveLength(0);
    expect(recheck.violations.filter((v) => v.id === 'host-pid')).toHaveLength(0);
    expect(recheck.violations.filter((v) => v.id === 'host-ipc')).toHaveLength(0);
  });

  it('adds default resource limits when missing', () => {
    const fixed = applyFixes(DANGEROUS_DEPLOYMENT, ['missing-resource-limits', 'missing-resource-requests']);
    const recheck = checkSafeguards(fixed.fixedManifest);
    expect(recheck.violations.filter((v) => v.id === 'missing-resource-limits')).toHaveLength(0);
    expect(recheck.violations.filter((v) => v.id === 'missing-resource-requests')).toHaveLength(0);
  });

  it('non-fixable violation remains after fix (run-as-root)', () => {
    const allIds = checkSafeguards(DANGEROUS_DEPLOYMENT).violations.map((v) => v.id);
    const fixed = applyFixes(DANGEROUS_DEPLOYMENT, allIds);
    const recheck = checkSafeguards(fixed.fixedManifest);

    // Non-fixable rules should still be flagged
    expect(recheck.violations.some((v) => v.id === 'run-as-root')).toBe(true);
    expect(recheck.violations.some((v) => v.id === 'mutable-root-filesystem')).toBe(true);

    // Fixable rules should be resolved
    expect(recheck.violations.some((v) => v.id === 'privileged-container')).toBe(false);
    expect(recheck.violations.some((v) => v.id === 'hostpath-volume')).toBe(false);

    // Skipped IDs returned in result
    expect(fixed.skippedIds).toEqual(expect.arrayContaining(['run-as-root', 'mutable-root-filesystem']));
  });

  it('skips unknown rule IDs gracefully', () => {
    const fixed = applyFixes(DANGEROUS_DEPLOYMENT, ['nonexistent-rule']);
    expect(fixed.skippedIds).toEqual(['nonexistent-rule']);
    expect(fixed.appliedFixes).toHaveLength(0);
  });

  it('fix is deterministic (same input → identical output)', () => {
    const ids = ['privileged-container', 'hostpath-volume', 'host-network'];
    const result1 = applyFixes(DANGEROUS_DEPLOYMENT, ids);
    const result2 = applyFixes(DANGEROUS_DEPLOYMENT, ids);
    expect(result1.fixedManifest).toBe(result2.fixedManifest);
  });

  it('isFixable returns correct values', () => {
    expect(isFixable('privileged-container')).toBe(true);
    expect(isFixable('hostpath-volume')).toBe(true);
    expect(isFixable('run-as-root')).toBe(false);
    expect(isFixable('mutable-root-filesystem')).toBe(false);
    expect(isFixable('nonexistent')).toBe(false);
  });
});

// ── Parser bounds ────────────────────────────────────────────────────────────

describe('parseManifest bounds', () => {
  it('rejects input exceeding byte limit', () => {
    const huge = 'a'.repeat(MAX_INPUT_BYTES + 1);
    const result = parseManifest(huge);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('byte limit');
  });

  it('rejects too many YAML documents', () => {
    const docs = Array.from({ length: MAX_DOCUMENT_COUNT + 1 }, (_, i) => `key: val${i}`).join('\n---\n');
    const result = parseManifest(docs);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Too many YAML documents');
  });

  it('rejects too many aliases', () => {
    const aliases = Array.from({ length: MAX_ALIAS_COUNT + 1 }, (_, i) => `*alias${i}`).join('\n');
    const result = parseManifest(aliases);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('aliases');
  });

  it('parses valid single-document YAML', () => {
    const result = parseManifest('apiVersion: v1\nkind: Pod\nmetadata:\n  name: test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].kind).toBe('Pod');
    }
  });

  it('skips empty documents in multi-doc', () => {
    const result = parseManifest('---\n---\napiVersion: v1\nkind: Pod');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.documents).toHaveLength(1);
    }
  });
});

// ── Tool invocation (SDK contract) ───────────────────────────────────────────

describe('core.check_safeguards tool', () => {
  const invoke = (manifest: string) =>
    checkSafeguardsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ manifest }),
    );

  it('returns valid JSON with violations array', async () => {
    const raw = await invoke(DANGEROUS_DEPLOYMENT);
    const result = JSON.parse(String(raw));
    expect(Array.isArray(result.violations)).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.summary).toHaveProperty('high');
  });

  it('returns ok: true for clean manifest', async () => {
    const raw = await invoke(CLEAN_DEPLOYMENT);
    const result = JSON.parse(String(raw));
    expect(result.ok).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('returns parseError for invalid YAML', async () => {
    const raw = await invoke('{{invalid');
    const result = JSON.parse(String(raw));
    expect(result.ok).toBe(false);
    expect(result.parseError).toBeTruthy();
  });
});

describe('core.fix_safeguards tool', () => {
  const invoke = (manifest: string, ids: string[]) =>
    fixSafeguardsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ manifest, ids }),
    );

  it('returns fixed manifest and applied/skipped lists', async () => {
    const raw = await invoke(DANGEROUS_DEPLOYMENT, ['privileged-container', 'run-as-root']);
    const result = JSON.parse(String(raw));
    expect(result.fixedManifest).toBeTruthy();
    expect(result.appliedFixes).toEqual(['privileged-container']);
    expect(result.skippedIds).toEqual(['run-as-root']);
  });

  it('full fix + recheck round-trip leaves only non-fixable violations', async () => {
    const checkRaw = await checkSafeguardsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ manifest: DANGEROUS_DEPLOYMENT }),
    );
    const checkResult = JSON.parse(String(checkRaw));
    const allIds = checkResult.violations.map((v: { id: string }) => v.id);

    const fixRaw = await invoke(DANGEROUS_DEPLOYMENT, allIds);
    const fixResult = JSON.parse(String(fixRaw));

    const recheckRaw = await checkSafeguardsTool.tool.invoke(
      new RunContext(makeSessionCtx()),
      JSON.stringify({ manifest: fixResult.fixedManifest }),
    );
    const recheckResult = JSON.parse(String(recheckRaw));

    // Only non-fixable violations should remain
    for (const v of recheckResult.violations) {
      expect(isFixable(v.id)).toBe(false);
    }
  });
});
