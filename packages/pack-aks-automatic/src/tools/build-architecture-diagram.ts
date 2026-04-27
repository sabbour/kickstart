import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

const PlanNodePoolSchema = z.object({
  name: z.string().max(1000, 'Pool name must be ≤1000 chars'),
  mode: z.enum(['System', 'User']).nullable(),
  vmSize: z.string().max(1000, 'VM size must be ≤1000 chars').nullable(),
  count: z.number().nullable(),
});

const PlanWorkloadSchema = z.object({
  name: z.string().max(1000, 'Workload name must be ≤1000 chars'),
  type: z.string().max(1000, 'Workload type must be ≤1000 chars').nullable(),
  replicas: z.number().nullable(),
});

const PlanIngressSchema = z.object({
  type: z.string().max(1000, 'Ingress type must be ≤1000 chars').nullable(),
  host: z.string().max(1000, 'Ingress host must be ≤1000 chars').nullable(),
});

const PlanStorageSchema = z.object({
  type: z.string().max(1000, 'Storage type must be ≤1000 chars').nullable(),
  name: z.string().max(1000, 'Storage name must be ≤1000 chars').nullable(),
});

const PlanKaitoSchema = z.object({
  model: z.string().max(1000, 'KAITO model must be ≤1000 chars').nullable(),
  gpu: z.string().max(1000, 'KAITO gpu must be ≤1000 chars').nullable(),
});

const PlanFoundrySchema = z.object({
  endpoint: z.string().max(1000, 'Foundry endpoint must be ≤1000 chars').nullable(),
  model: z.string().max(1000, 'Foundry model must be ≤1000 chars').nullable(),
});

const PlanCiCdSchema = z.object({
  provider: z.string().max(1000, 'CI/CD provider must be ≤1000 chars').nullable(),
  registry: z.string().max(1000, 'CI/CD registry must be ≤1000 chars').nullable(),
});

const BuildArchitectureDiagramInputSchema = z.object({
  plan: z.object({
    clusterName: z.string().max(1000, 'Cluster name must be ≤1000 chars').nullable(),
    nodePools: z.array(PlanNodePoolSchema).max(100, 'Node pools must be ≤100').nullable(),
    workloads: z.array(PlanWorkloadSchema).max(100, 'Workloads must be ≤100').nullable(),
    ingress: PlanIngressSchema.nullable(),
    storage: PlanStorageSchema.nullable(),
    kaito: PlanKaitoSchema.nullable(),
    foundry: PlanFoundrySchema.nullable(),
    cicd: PlanCiCdSchema.nullable(),
  }).describe('The plan artifact from Phase A/B describing the AKS topology'),
});

// Output schema — strict, closed contract (Zapp S1)
const DiagramNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().optional(),
});

const DiagramEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

const _BuildArchitectureDiagramOutputSchema = z.object({
  schema_version: z.literal('1'),
  title: z.string(),
  description: z.string(),
  nodes: z.array(DiagramNodeSchema),
  edges: z.array(DiagramEdgeSchema),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type PlanInput = z.infer<typeof BuildArchitectureDiagramInputSchema>['plan'];
export type DiagramOutput = z.infer<typeof _BuildArchitectureDiagramOutputSchema>;
interface DiagramNode { id: string; label: string; type?: string; }
interface DiagramEdge { from: string; to: string; label?: string; }

// ── Deterministic builder (pure function, no randomness) ──────────────────────

/** Locale-independent codepoint comparison for deterministic sorting across environments. */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Builds a deterministic architecture diagram JSON from a plan artifact.
 * Identical plan → identical output, guaranteed by:
 *   1. No random IDs — node IDs derived from plan content
 *   2. Sorted node/edge arrays — canonical codepoint ordering (not locale-dependent)
 *   3. No timestamps or run-specific metadata
 */
export function buildArchitectureDiagram(plan: PlanInput): DiagramOutput {
  const nodes: DiagramNode[] = [];
  const edges: DiagramEdge[] = [];

  const clusterName = plan.clusterName ?? 'aks-cluster';
  const clusterLabel = escapeLabel(clusterName);

  // Control plane node (always present)
  nodes.push({
    id: 'control-plane',
    label: `AKS Automatic\\n${clusterLabel}`,
    type: 'compute',
  });

  // Node pools — sorted by name for determinism (codepoint order, not locale)
  const pools = [...(plan.nodePools ?? [])].sort((a, b) => cmp(a.name, b.name));
  if (pools.length === 0) {
    // Default pools when none specified
    pools.push({ name: 'system', mode: 'System', vmSize: null, count: null });
    pools.push({ name: 'user', mode: 'User', vmSize: null, count: null });
  }

  // Pre-assign pool IDs with separate collision tracking (avoids cross-type ID collisions)
  const poolIds = new Map<string, string>();
  const poolCollisions = new Map<string, number>();
  for (const pool of pools) {
    const baseName = sanitizeId(pool.name);
    const count = poolCollisions.get(baseName) ?? 0;
    poolCollisions.set(baseName, count + 1);
    poolIds.set(pool.name, count === 0 ? `pool-${baseName}` : `pool-${baseName}-${count}`);
  }

  for (const pool of pools) {
    const poolId = poolIds.get(pool.name)!;
    const mode = pool.mode ?? 'User';
    const sizeLabel = pool.vmSize ? ` (${escapeLabel(pool.vmSize)})` : '';
    nodes.push({
      id: poolId,
      label: `${escapeLabel(pool.name)}\\n${mode} Pool${sizeLabel}`,
      type: 'compute',
    });
    edges.push({
      from: 'control-plane',
      to: poolId,
      label: 'manages',
    });
  }

  // Workloads — sorted by name for determinism (codepoint order, not locale)
  const workloads = [...(plan.workloads ?? [])].sort((a, b) => cmp(a.name, b.name));

  // Pre-assign workload IDs with separate collision tracking (avoids cross-type ID collisions)
  const workloadIds = new Map<string, string>();
  const workloadCollisions = new Map<string, number>();
  for (const wl of workloads) {
    const baseName = sanitizeId(wl.name);
    const count = workloadCollisions.get(baseName) ?? 0;
    workloadCollisions.set(baseName, count + 1);
    workloadIds.set(wl.name, count === 0 ? `workload-${baseName}` : `workload-${baseName}-${count}`);
  }

  // Connect workload to first user pool (mode omitted defaults to 'User'), or first pool
  const userPool = pools.find(p => (p.mode ?? 'User') === 'User') ?? pools[0];

  for (const wl of workloads) {
    const wlId = workloadIds.get(wl.name)!;
    const typeLabel = wl.type ? ` (${escapeLabel(wl.type)})` : '';
    nodes.push({
      id: wlId,
      label: `${escapeLabel(wl.name)}${typeLabel}`,
      type: 'compute',
    });

    if (userPool) {
      edges.push({
        from: poolIds.get(userPool.name)!,
        to: wlId,
        label: 'runs',
      });
    }
  }

  // Ingress
  if (plan.ingress) {
    const ingressType = plan.ingress.type ?? 'Ingress';
    nodes.push({
      id: 'ingress',
      label: `${escapeLabel(ingressType)}`,
      type: 'network',
    });
    edges.push({ from: 'ingress', to: 'control-plane', label: 'routes to' });

    for (const wl of workloads) {
      edges.push({
        from: 'ingress',
        to: workloadIds.get(wl.name)!,
        label: 'exposes',
      });
    }
  }

  // Storage
  if (plan.storage) {
    const storageName = plan.storage.name ?? plan.storage.type ?? 'Storage';
    nodes.push({
      id: 'storage',
      label: escapeLabel(storageName),
      type: 'storage',
    });

    for (const wl of workloads) {
      edges.push({
        from: workloadIds.get(wl.name)!,
        to: 'storage',
        label: 'persists',
      });
    }
  }

  // KAITO model pod
  if (plan.kaito) {
    const modelName = plan.kaito.model ?? 'KAITO Model';
    nodes.push({
      id: 'kaito',
      label: `KAITO\\n${escapeLabel(modelName)}`,
      type: 'compute',
    });
    // KAITO runs on a GPU-enabled pool, or the first user pool (mode omitted defaults to 'User')
    const gpuPool = pools.find(p => p.vmSize?.includes('gpu') || p.vmSize?.includes('NC') || p.vmSize?.includes('ND'))
      ?? pools.find(p => (p.mode ?? 'User') === 'User')
      ?? pools[0];
    if (gpuPool) {
      edges.push({
        from: poolIds.get(gpuPool.name)!,
        to: 'kaito',
        label: 'hosts',
      });
    }

    for (const wl of workloads) {
      edges.push({
        from: workloadIds.get(wl.name)!,
        to: 'kaito',
        label: 'inference',
      });
    }
  }

  // Foundry connection
  if (plan.foundry) {
    const foundryModel = plan.foundry.model ?? 'Azure AI Foundry';
    nodes.push({
      id: 'foundry',
      label: `Foundry\\n${escapeLabel(foundryModel)}`,
      type: 'network',
    });
    edges.push({ from: 'control-plane', to: 'foundry', label: 'connects' });

    for (const wl of workloads) {
      edges.push({
        from: workloadIds.get(wl.name)!,
        to: 'foundry',
        label: 'calls',
      });
    }
  }

  // CI/CD
  if (plan.cicd) {
    const provider = plan.cicd.provider ?? 'CI/CD';
    nodes.push({
      id: 'cicd',
      label: escapeLabel(provider),
      type: 'compute',
    });

    if (plan.cicd.registry) {
      nodes.push({
        id: 'registry',
        label: escapeLabel(plan.cicd.registry),
        type: 'storage',
      });
      edges.push({ from: 'cicd', to: 'registry', label: 'pushes' });
      edges.push({ from: 'registry', to: 'control-plane', label: 'pulls' });
    } else {
      edges.push({ from: 'cicd', to: 'control-plane', label: 'deploys' });
    }
  }

  // Sort nodes and edges for canonical output — codepoint order, not locale-dependent
  nodes.sort((a, b) => cmp(a.id, b.id));
  edges.sort((a, b) => cmp(a.from, b.from) || cmp(a.to, b.to) || cmp(a.label ?? '', b.label ?? ''));

  const description = buildDescription(plan, pools.length);

  return {
    schema_version: '1',
    title: `Architecture: ${clusterLabel}`,
    description,
    nodes,
    edges,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sanitize a string into a safe, deterministic node ID. Rejects empty results and tracks collisions. */
function sanitizeId(value: string, disambiguator?: number): string {
  let sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // If the sanitized result is empty or only punctuation, throw to prevent ID collisions and hidden resources
  if (!sanitized) {
    throw new Error(`Cannot sanitize "${value}" to a valid ID: result is empty. Names with only punctuation are not allowed.`);
  }

  // If a disambiguator is provided (collision detected), append it to make ID unique
  if (disambiguator !== undefined) {
    sanitized = `${sanitized}-${disambiguator}`;
  }

  return sanitized;
}

/** Escape label text — no HTML, no raw SVG, no event handlers (Zapp S1/S3) */
function escapeLabel(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDescription(plan: PlanInput, poolCount: number): string {
  const parts: string[] = ['AKS Automatic cluster'];
  parts.push(`with ${poolCount} node pool${poolCount === 1 ? '' : 's'}`);
  if (plan.workloads?.length) {
    parts.push(`running ${plan.workloads.length} workload${plan.workloads.length === 1 ? '' : 's'}`);
  }
  if (plan.kaito) parts.push('with KAITO AI model serving');
  if (plan.foundry) parts.push('connected to Azure AI Foundry');
  if (plan.ingress) parts.push(`exposed via ${plan.ingress.type ?? 'ingress'}`);
  if (plan.storage) parts.push(`using ${plan.storage.type ?? 'persistent storage'}`);
  if (plan.cicd) parts.push(`with ${plan.cicd.provider ?? 'CI/CD'} pipeline`);
  return parts.join(', ') + '.';
}

// ── Tool contribution ─────────────────────────────────────────────────────────

export const buildArchitectureDiagramTool: ToolContribution = {
  name: 'aks.build_architecture_diagram',
  tool: tool({
    name: 'aks.build_architecture_diagram',
    description:
      'Builds a deterministic architecture diagram from a plan artifact. ' +
      'Produces identical JSON for identical plans — no LLM variation, no randomness. ' +
      'Output is an ArchitectureDiagram-compatible props object with nodes, edges, title, and description.',
    parameters: BuildArchitectureDiagramInputSchema,
    execute: async (input): Promise<DiagramOutput> => {
      return buildArchitectureDiagram(input.plan);
    },
  }),
};


