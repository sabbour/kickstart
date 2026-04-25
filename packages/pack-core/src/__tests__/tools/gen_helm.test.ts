import { describe, it, expect } from 'vitest';
import { genHelm } from '../../tools/gen_helm.js';
import type { GenHelmInput } from '../../tools/gen_helm.js';

const baseKaito: GenHelmInput = {
  plan: { name: 'my-app', description: 'Test app', version: '1.0.0' },
  proposed_services: {
    cpu: '500m', memory: '512Mi', cpuLimit: '1000m', memoryLimit: '1Gi', replicaCount: 2,
  },
  track: 'kaito',
};

const baseFoundry: GenHelmInput = {
  ...baseKaito,
  track: 'foundry',
};

function findFile(output: ReturnType<typeof genHelm>, path: string) {
  const f = output.files.find(f => f.outputPath === path);
  if (!f) throw new Error(`File not found: ${path}`);
  return f;
}

describe('gen_helm', () => {
  it('Chart.yaml contains correct name from plan', () => {
    const out = genHelm(baseKaito);
    expect(findFile(out, 'helm/Chart.yaml').content).toContain('name: my-app');
  });

  it('Chart.yaml has apiVersion: v2', () => {
    const out = genHelm(baseKaito);
    expect(findFile(out, 'helm/Chart.yaml').content).toContain('apiVersion: v2');
  });

  it('values.yaml contains resource limits', () => {
    const out = genHelm(baseKaito);
    const vals = findFile(out, 'helm/values.yaml').content;
    expect(vals).toContain('limits:');
    expect(vals).toContain('cpu:');
    expect(vals).toContain('memory:');
  });

  it('values.yaml contains replicaCount', () => {
    const out = genHelm(baseKaito);
    expect(findFile(out, 'helm/values.yaml').content).toContain('replicaCount: 2');
  });

  it('deployment.yaml has non-root securityContext (runAsNonRoot: true, runAsUser: 1000)', () => {
    const out = genHelm(baseKaito);
    const dep = findFile(out, 'helm/templates/deployment.yaml').content;
    expect(dep).toContain('runAsNonRoot: true');
    expect(dep).toContain('runAsUser: 1000');
  });

  it('deployment.yaml has GPU toleration for kaito track', () => {
    const out = genHelm(baseKaito);
    const dep = findFile(out, 'helm/templates/deployment.yaml').content;
    expect(dep).toContain('nvidia.com/gpu');
    expect(dep).toContain('agentpool: kaito-gpu-pool');
  });

  it('deployment.yaml has NO GPU toleration for foundry track', () => {
    const out = genHelm(baseFoundry);
    const dep = findFile(out, 'helm/templates/deployment.yaml').content;
    expect(dep).not.toContain('nvidia.com/gpu');
    expect(dep).not.toContain('kaito-gpu-pool');
  });

  it('service.yaml is ClusterIP', () => {
    const out = genHelm(baseKaito);
    expect(findFile(out, 'helm/templates/service.yaml').content).toContain('type: ClusterIP');
  });

  it('serviceaccount.yaml is present', () => {
    const out = genHelm(baseKaito);
    const sa = findFile(out, 'helm/templates/serviceaccount.yaml');
    expect(sa.content).toContain('kind: ServiceAccount');
  });

  it('all outputPaths start with "helm/" and have no "../"', () => {
    const out = genHelm(baseKaito);
    for (const f of out.files) {
      expect(f.outputPath).toMatch(/^helm\//);
      expect(f.outputPath).not.toContain('../');
    }
  });

  it('plan name with unsafe chars throws error', () => {
    expect(() => genHelm({ ...baseKaito, plan: { name: 'bad name!' } })).toThrow();
  });

  it('foundry track generates no secrets in values.yaml plaintext', () => {
    const out = genHelm(baseFoundry);
    const vals = findFile(out, 'helm/values.yaml').content;
    expect(vals).not.toContain('AZURE_OPENAI');
    expect(vals).not.toContain('secret');
    expect(vals).not.toContain('password');
  });
});
