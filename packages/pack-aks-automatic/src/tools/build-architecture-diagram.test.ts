import { describe, it, expect } from 'vitest';
import { buildArchitectureDiagram, type PlanInput, type DiagramOutput } from './build-architecture-diagram.js';
import kaitoPlan from './__fixtures__/kaito-plan.json';
import foundryPlan from './__fixtures__/foundry-plan.json';

// Helper to load a plan fixture with type safety
function loadFixture(fixture: Record<string, unknown>): PlanInput {
  return fixture as PlanInput;
}

describe('aks.build_architecture_diagram', () => {
  // ── Determinism ───────────────────────────────────────────────────────────

  it('is deterministic across 10 runs for the KAITO plan', () => {
    const plan = loadFixture(kaitoPlan);
    const outputs = Array.from({ length: 10 }, () => buildArchitectureDiagram(plan));
    const canonical = JSON.stringify(outputs[0]);
    for (const o of outputs) {
      expect(JSON.stringify(o)).toBe(canonical);
    }
  });

  it('is deterministic across 10 runs for the Foundry plan', () => {
    const plan = loadFixture(foundryPlan);
    const outputs = Array.from({ length: 10 }, () => buildArchitectureDiagram(plan));
    const canonical = JSON.stringify(outputs[0]);
    for (const o of outputs) {
      expect(JSON.stringify(o)).toBe(canonical);
    }
  });

  // ── Snapshot ──────────────────────────────────────────────────────────────

  it('snapshot for KAITO plan matches golden', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    expect(diagram).toMatchSnapshot();
  });

  it('snapshot for Foundry plan matches golden', () => {
    const diagram = buildArchitectureDiagram(loadFixture(foundryPlan));
    expect(diagram).toMatchSnapshot();
  });

  // ── Schema version ────────────────────────────────────────────────────────

  it('includes schema_version: 1 in output', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    expect(diagram.schema_version).toBe('1');
  });

  // ── Control plane ─────────────────────────────────────────────────────────

  it('always includes a control-plane node', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const cp = diagram.nodes.find(n => n.id === 'control-plane');
    expect(cp).toBeDefined();
    expect(cp!.label).toContain('AKS Automatic');
  });

  // ── Node pools ────────────────────────────────────────────────────────────

  it('creates nodes for all declared node pools', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const poolNodes = diagram.nodes.filter(n => n.id.startsWith('pool-'));
    expect(poolNodes).toHaveLength(2);
    expect(poolNodes.map(n => n.id).sort()).toEqual(['pool-gpu-pool', 'pool-system']);
  });

  it('creates default pools when none specified', () => {
    const diagram = buildArchitectureDiagram({ clusterName: 'empty-cluster' });
    const poolNodes = diagram.nodes.filter(n => n.id.startsWith('pool-'));
    expect(poolNodes).toHaveLength(2);
    expect(poolNodes.map(n => n.id).sort()).toEqual(['pool-system', 'pool-user']);
  });

  it('connects pools to control plane with manages edge', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const managesEdges = diagram.edges.filter(e => e.from === 'control-plane' && e.label === 'manages');
    expect(managesEdges).toHaveLength(2);
  });

  // ── Workloads ─────────────────────────────────────────────────────────────

  it('creates nodes for all workloads', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const workloadNodes = diagram.nodes.filter(n => n.id.startsWith('workload-'));
    expect(workloadNodes).toHaveLength(2);
  });

  // ── KAITO ─────────────────────────────────────────────────────────────────

  it('includes a KAITO node when plan.kaito is set', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const kaito = diagram.nodes.find(n => n.id === 'kaito');
    expect(kaito).toBeDefined();
    expect(kaito!.label).toContain('falcon-7b');
  });

  it('connects KAITO to GPU pool', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const kaitoHostEdge = diagram.edges.find(e => e.to === 'kaito' && e.label === 'hosts');
    expect(kaitoHostEdge).toBeDefined();
    // NC24 pool should be selected for GPU workload
    expect(kaitoHostEdge!.from).toBe('pool-gpu-pool');
  });

  // ── Foundry ───────────────────────────────────────────────────────────────

  it('includes a Foundry node when plan.foundry is set', () => {
    const diagram = buildArchitectureDiagram(loadFixture(foundryPlan));
    const foundry = diagram.nodes.find(n => n.id === 'foundry');
    expect(foundry).toBeDefined();
    expect(foundry!.label).toContain('gpt-4o');
  });

  it('does not include Foundry when plan.foundry is not set', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const foundry = diagram.nodes.find(n => n.id === 'foundry');
    expect(foundry).toBeUndefined();
  });

  // ── Ingress ───────────────────────────────────────────────────────────────

  it('includes an ingress node when plan.ingress is set', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const ingress = diagram.nodes.find(n => n.id === 'ingress');
    expect(ingress).toBeDefined();
    expect(ingress!.type).toBe('network');
  });

  // ── Storage ───────────────────────────────────────────────────────────────

  it('includes a storage node when plan.storage is set', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const storage = diagram.nodes.find(n => n.id === 'storage');
    expect(storage).toBeDefined();
    expect(storage!.type).toBe('storage');
  });

  // ── CI/CD ─────────────────────────────────────────────────────────────────

  it('includes CI/CD + registry nodes when plan.cicd has registry', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const cicd = diagram.nodes.find(n => n.id === 'cicd');
    const reg = diagram.nodes.find(n => n.id === 'registry');
    expect(cicd).toBeDefined();
    expect(reg).toBeDefined();
    expect(cicd!.label).toBe('GitHub Actions');
    expect(reg!.label).toBe('ACR');
  });

  // ── Canonical ordering ────────────────────────────────────────────────────

  it('nodes are sorted by id for canonical ordering', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const ids = diagram.nodes.map(n => n.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('edges are sorted by from, then to, then label', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    const edgeKeys = diagram.edges.map(e => `${e.from}|${e.to}|${e.label ?? ''}`);
    expect(edgeKeys).toEqual([...edgeKeys].sort());
  });

  // ── Edge count stability ──────────────────────────────────────────────────

  it('produces identical node and edge counts across 10 runs', () => {
    const plan = loadFixture(kaitoPlan);
    const baseline = buildArchitectureDiagram(plan);
    for (let i = 0; i < 10; i++) {
      const run = buildArchitectureDiagram(plan);
      expect(run.nodes.length).toBe(baseline.nodes.length);
      expect(run.edges.length).toBe(baseline.edges.length);
    }
  });

  // ── Security: escaping (Zapp S1/S3) ───────────────────────────────────────

  it('escapes HTML in labels', () => {
    const plan: PlanInput = {
      clusterName: '<script>alert("xss")</script>',
      workloads: [{ name: 'app<img onerror=alert(1)>' }],
    };
    const diagram = buildArchitectureDiagram(plan);
    const allLabels = diagram.nodes.map(n => n.label).join(' ');
    expect(allLabels).not.toContain('<script>');
    expect(allLabels).not.toContain('<img');
    expect(allLabels).toContain('&lt;script&gt;');
  });

  // ── Title and description ─────────────────────────────────────────────────

  it('generates a descriptive title and description', () => {
    const diagram = buildArchitectureDiagram(loadFixture(kaitoPlan));
    expect(diagram.title).toContain('kaito-demo-cluster');
    expect(diagram.description).toContain('KAITO');
    expect(diagram.description).toContain('node pool');
  });

  // ── Minimal plan ──────────────────────────────────────────────────────────

  it('handles a minimal plan with no optional fields', () => {
    const diagram = buildArchitectureDiagram({});
    expect(diagram.nodes.length).toBeGreaterThanOrEqual(3); // control-plane + 2 default pools
    expect(diagram.schema_version).toBe('1');
  });
});
