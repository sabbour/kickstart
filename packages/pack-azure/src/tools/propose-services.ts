import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';

// ── SKU Matrix (AKS-Automatic only) ───────────────────────────────────────────

export const GPU_SKU_MATRIX: Record<string, string> = {
  '7b': 'Standard_NC24ads_A100_v4',
  '13b': 'Standard_NC48ads_A100_v4',
  '70b': 'Standard_NC96ads_A100_v4',
};

export const SUPPORTED_MODEL_SIZES = Object.keys(GPU_SKU_MATRIX);

// ── Input schema ──────────────────────────────────────────────────────────────

const PlanNodePoolSchema = z.object({
  name: z.string().max(1000),
  mode: z.enum(['System', 'User']).nullable(),
  vmSize: z.string().max(1000).nullable(),
  count: z.number().nullable(),
});

const PlanWorkloadSchema = z.object({
  name: z.string().max(1000),
  type: z.string().max(1000).nullable(),
  replicas: z.number().nullable(),
});

const PlanSchema = z.object({
  clusterName: z.string().max(1000).nullable(),
  nodePools: z.array(PlanNodePoolSchema).max(100).nullable(),
  workloads: z.array(PlanWorkloadSchema).max(100).nullable(),
  ingress: z.object({ type: z.string().max(1000).nullable(), host: z.string().max(1000).nullable() }).nullable(),
  storage: z.object({ type: z.string().max(1000).nullable(), name: z.string().max(1000).nullable() }).nullable(),
  kaito: z.object({ model: z.string().max(1000).nullable(), gpu: z.string().max(1000).nullable() }).nullable(),
  foundry: z.object({ endpoint: z.string().max(1000).nullable(), model: z.string().max(1000).nullable() }).nullable(),
});

export const ProposeServicesInputSchema = z.object({
  plan: PlanSchema.describe('AKS plan object from Phase A/B'),
  track: z.enum(['kaito', 'foundry']).describe('Deployment track: kaito (GPU/KAITO workspace) or foundry (Azure AI Foundry)'),
  sub_branch: z.string().max(100).describe('Model size for kaito (7b|13b|70b) or service tier for foundry'),
});

// ── Output types ──────────────────────────────────────────────────────────────

export type ServiceRef = { name: string; type: string; description: string };
export type NodePoolRecommendation = {
  name: string;
  mode: 'User';
  vmSize: string;
  count: number;
  labels: Record<string, string>;
  taints: string[];
};
export type ConnectionRef = { name: string; secretRef: string; description: string };
export type KaitoOutput = { track: 'kaito'; services: ServiceRef[]; nodePoolRecommendation: NodePoolRecommendation; modelSize: string; vmSize: string };
export type FoundryOutput = { track: 'foundry'; services: ServiceRef[]; connectionRefs: ConnectionRef[]; tier: string };
export type ProposeServicesOutput = KaitoOutput | FoundryOutput;

// ── Core business logic (exported for unit tests) ─────────────────────────────

export function proposeServices(track: 'kaito' | 'foundry', sub_branch: string): ProposeServicesOutput {
  if (track === 'kaito') {
    const modelSize = sub_branch.toLowerCase();
    const vmSize = GPU_SKU_MATRIX[modelSize];
    if (!vmSize) {
      throw new Error(
        `Unsupported model size "${sub_branch}" for KAITO track. Supported sizes: ${SUPPORTED_MODEL_SIZES.join(', ')}.`,
      );
    }
    return {
      track: 'kaito',
      services: [
        {
          name: 'kaito-workspace',
          type: 'kaito.sh/v1alpha1/Workspace',
          description: 'KAITO Workspace CRD that provisions the model inference service on the GPU node pool.',
        },
      ],
      nodePoolRecommendation: {
        name: `gpu-${modelSize}`,
        mode: 'User',
        vmSize,
        count: 1,
        labels: { 'kaito.sh/model-size': modelSize, 'workload-type': 'gpu-inference' },
        taints: ['nvidia.com/gpu=present:NoSchedule'],
      },
      modelSize,
      vmSize,
    };
  }

  // foundry track — placeholder connection refs only, never actual credentials
  return {
    track: 'foundry',
    services: [
      {
        name: 'ai-foundry-project',
        type: 'Microsoft.MachineLearningServices/workspaces',
        description: 'Azure AI Foundry project resource that hosts the model deployment and endpoints.',
      },
    ],
    connectionRefs: [
      {
        name: 'azure-openai-key',
        secretRef: '{{ secrets.AZURE_OPENAI_KEY }}',
        description: 'Azure OpenAI API key — injected from secret store at deploy time, never stored in output.',
      },
      {
        name: 'azure-openai-endpoint',
        secretRef: '{{ secrets.AZURE_OPENAI_ENDPOINT }}',
        description: 'Azure OpenAI endpoint URL — injected from secret store at deploy time.',
      },
    ],
    tier: sub_branch,
  };
}

// ── Tool registration ─────────────────────────────────────────────────────────

export const proposeServicesTool: ToolContribution = {
  name: 'azure.propose_services',
  tool: tool({
    name: 'azure.propose_services',
    description:
      'Proposes a structured service list and SKU recommendations for AKS Generation Phase C. ' +
      'For the kaito track, returns a kaito-workspace service and a GPU node pool recommendation using a ' +
      'deterministic SKU matrix (AKS-Automatic only). ' +
      'For the foundry track, returns an ai-foundry-project service with placeholder connection refs only — ' +
      'never actual credentials.',
    parameters: ProposeServicesInputSchema,
    execute: async (input): Promise<ProposeServicesOutput> => {
      return proposeServices(input.track, input.sub_branch);
    },
  }),
};
