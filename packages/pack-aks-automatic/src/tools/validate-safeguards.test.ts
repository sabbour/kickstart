import { describe, it, expect } from 'vitest';
import { validateSafeguardsTool, SAFEGUARD_RULES, evaluateRules } from './validate-safeguards.js';

const COMPLIANT_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: app
          image: myacr.azurecr.io/my-app:1.2.3
          resources:
            limits:
              cpu: 500m
              memory: 256Mi
`.trim();

const PRIVILEGED_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bad-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
          securityContext:
            privileged: true
          resources:
            limits:
              cpu: 100m
`.trim();

const LATEST_TAG_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: latest-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: nginx:latest
          resources:
            limits:
              cpu: 100m
              memory: 64Mi
`.trim();

const HOSTPATH_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hostpath-app
spec:
  template:
    spec:
      volumes:
        - name: host-data
          hostPath:
            path: /etc
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
          resources:
            limits:
              cpu: 100m
`.trim();

const MISSING_LIMITS_MANIFEST = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: no-limits-app
spec:
  template:
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/app:1.0.0
`.trim();

describe('validate-safeguards', () => {
  it('tool is registered with correct name', () => {
    expect(validateSafeguardsTool.name).toBe('aks.validate_safeguards');
  });

  it('SAFEGUARD_RULES is frozen and non-empty', () => {
    expect(Object.isFrozen(SAFEGUARD_RULES)).toBe(true);
    expect(SAFEGUARD_RULES.length).toBeGreaterThan(0);
  });

  it('all rules have required fields', () => {
    for (const rule of SAFEGUARD_RULES) {
      expect(rule.id).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(rule.severity);
      expect(rule.description).toBeTruthy();
    }
  });

  it('compliant manifest has no violations', () => {
    const violations = evaluateRules(COMPLIANT_MANIFEST);
    expect(violations).toHaveLength(0);
  });

  it('detects privileged container — high severity', () => {
    const violations = evaluateRules(PRIVILEGED_MANIFEST);
    const violation = violations.find((v) => v.ruleId === 'no-privileged');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('high');
  });

  it('blocks deployment with high-severity violation (compliant=false)', () => {
    const violations = evaluateRules(PRIVILEGED_MANIFEST);
    const high = violations.filter((v) => v.severity === 'high');
    expect(high.length).toBeGreaterThan(0);
  });

  it('detects :latest tag — high severity', () => {
    const violations = evaluateRules(LATEST_TAG_MANIFEST);
    const violation = violations.find((v) => v.ruleId === 'no-latest-tag');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('high');
  });

  it('detects hostPath volume — high severity', () => {
    const violations = evaluateRules(HOSTPATH_MANIFEST);
    const violation = violations.find((v) => v.ruleId === 'no-hostpath');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('high');
  });

  it('detects missing resource limits — medium severity', () => {
    const violations = evaluateRules(MISSING_LIMITS_MANIFEST);
    const violation = violations.find((v) => v.ruleId === 'require-limits');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('medium');
  });

  it('returns violation line numbers when detectable', () => {
    const violations = evaluateRules(PRIVILEGED_MANIFEST);
    const violation = violations.find((v) => v.ruleId === 'no-privileged');
    expect(violation?.line).toBeTypeOf('number');
    expect(violation!.line!).toBeGreaterThan(0);
  });

  it('no violations on compliant manifest (summary would say compliant)', () => {
    const violations = evaluateRules(COMPLIANT_MANIFEST);
    expect(violations.length).toBe(0);
  });

  it('multiple violations on combined bad manifest', () => {
    const badManifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: very-bad
spec:
  template:
    spec:
      hostNetwork: true
      containers:
        - name: app
          image: nginx:latest
          securityContext:
            privileged: true
`.trim();
    const violations = evaluateRules(badManifest);
    expect(violations.length).toBeGreaterThanOrEqual(3);
  });
});
