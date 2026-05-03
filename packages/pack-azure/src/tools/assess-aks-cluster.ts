import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { strictOptional } from '@aks-kickstart/harness/runtime/z-strict';
import { getAzureToken, armAuthHeaders, armBaseUrl } from '../services/azure-auth.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const AKS_API_VERSION = '2024-09-01';

/**
 * Add-ons known to be incompatible with or superseded by AKS Automatic features.
 * AKS Automatic enables managed equivalents for most of these.
 */
const INCOMPATIBLE_ADDONS = [
  'kubeDashboard',       // Deprecated and disabled by default in recent AKS
  'openServiceMesh',     // Retired
];

/**
 * Minimum Kubernetes minor version for AKS Automatic support.
 * AKS Automatic requires Kubernetes 1.28+.
 */
const MIN_AKS_AUTOMATIC_K8S_MINOR = 28;

// ── Schema ────────────────────────────────────────────────────────────────────

const AssessAksClusterInputSchema = z.object({
  subscriptionId: z
    .string()
    .describe('Azure subscription GUID, e.g. "00000000-0000-0000-0000-000000000000"'),
  resourceGroup: z
    .string()
    .describe('Resource group containing the AKS cluster'),
  clusterName: z
    .string()
    .describe('Name of the AKS managed cluster'),
});

const NodePoolAssessmentSchema = z.object({
  name: z.string().describe('Node pool name'),
  vmSize: z.string().describe('VM SKU for this node pool'),
  osType: z.string().describe('OS type: Linux or Windows'),
  mode: z.string().describe('Node pool mode: System or User'),
  count: z.number().describe('Current node count'),
  minCount: strictOptional(z.number()).describe('Minimum count (if autoscaler enabled)'),
  maxCount: strictOptional(z.number()).describe('Maximum count (if autoscaler enabled)'),
  autoscalingEnabled: z.boolean().describe('Whether cluster autoscaler is enabled on this pool'),
});

const AssessAksClusterOutputSchema = z.object({
  // Cluster metadata
  clusterName: z.string(),
  location: z.string(),
  kubernetesVersion: z.string().describe('Current Kubernetes version of the cluster'),
  provisioningState: z.string().describe('Current provisioning state of the cluster'),

  // Network configuration
  networkPlugin: z.string().describe('Network plugin: azure, kubenet, or none'),
  networkPluginMode: strictOptional(z.string()).describe(
    'Network plugin mode, e.g. "overlay" for Azure CNI Overlay',
  ),
  networkPolicy: strictOptional(z.string()).describe('Network policy: azure, calico, cilium, or none'),
  loadBalancerSku: strictOptional(z.string()).describe('Load balancer SKU: standard or basic'),

  // Security / identity
  workloadIdentityEnabled: z.boolean().describe('Whether workload identity is enabled'),
  oidcIssuerEnabled: z.boolean().describe('Whether OIDC issuer profile is enabled'),
  azureRbacEnabled: z.boolean().describe('Whether Azure RBAC for Kubernetes is enabled'),
  localAccountsDisabled: z.boolean().describe('Whether local accounts are disabled (AAD-only)'),

  // Node pools
  nodePools: z.array(NodePoolAssessmentSchema).describe('Assessment of each node pool'),

  // Add-ons
  enabledAddons: z.array(z.string()).describe('Names of currently enabled add-ons'),
  incompatibleAddons: z.array(z.string()).describe(
    'Add-ons that are incompatible with or redundant in AKS Automatic',
  ),

  // AKS Automatic compatibility flags
  automaticCompatibility: z.object({
    versionCompatible: z.boolean().describe('Kubernetes version >= 1.28 (minimum for Automatic)'),
    cniOverlayEnabled: z.boolean().describe('Azure CNI Overlay (network plugin mode = overlay) is enabled'),
    workloadIdentityReady: z.boolean().describe('Workload identity + OIDC issuer both enabled'),
    noIncompatibleAddons: z.boolean().describe('No add-ons incompatible with AKS Automatic detected'),
    overallReady: z.boolean().describe('True when all compatibility checks pass'),
    summary: z.string().describe('Human-readable summary of AKS Automatic readiness'),
  }),

  // Error field — present when the assessment could not complete
  error: strictOptional(z.string()),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ManagedClusterAddonProfile {
  enabled?: boolean;
}

interface ManagedClusterAgentPoolProfile {
  name?: string;
  vmSize?: string;
  osType?: string;
  mode?: string;
  count?: number;
  minCount?: number;
  maxCount?: number;
  enableAutoScaling?: boolean;
}

interface ManagedClusterProperties {
  kubernetesVersion?: string;
  provisioningState?: string;
  networkProfile?: {
    networkPlugin?: string;
    networkPluginMode?: string;
    networkPolicy?: string;
    loadBalancerSku?: string;
  };
  securityProfile?: {
    workloadIdentity?: { enabled?: boolean };
  };
  oidcIssuerProfile?: { enabled?: boolean };
  enableRBAC?: boolean;
  aadProfile?: { enableAzureRBAC?: boolean };
  disableLocalAccounts?: boolean;
  agentPoolProfiles?: ManagedClusterAgentPoolProfile[];
  addonProfiles?: Record<string, ManagedClusterAddonProfile>;
}

interface ManagedCluster {
  name?: string;
  location?: string;
  properties?: ManagedClusterProperties;
}

function parseMajorMinor(version: string): { major: number; minor: number } {
  const [major = '0', minor = '0'] = version.split('.');
  return { major: parseInt(major, 10), minor: parseInt(minor, 10) };
}

export function assessAutomaticCompatibility(
  props: ManagedClusterProperties,
  enabledAddons: string[],
  incompatibleAddons: string[],
): AssessAksClusterOutputSchema['automaticCompatibility'] {
  const k8sVersion = props.kubernetesVersion ?? '0.0.0';
  const { minor } = parseMajorMinor(k8sVersion);
  const versionCompatible = minor >= MIN_AKS_AUTOMATIC_K8S_MINOR;

  const networkPlugin = props.networkProfile?.networkPlugin ?? '';
  const networkPluginMode = props.networkProfile?.networkPluginMode ?? '';
  const cniOverlayEnabled =
    networkPlugin === 'azure' && networkPluginMode.toLowerCase() === 'overlay';

  const workloadIdentityEnabled =
    props.securityProfile?.workloadIdentity?.enabled === true;
  const oidcIssuerEnabled = props.oidcIssuerProfile?.enabled === true;
  const workloadIdentityReady = workloadIdentityEnabled && oidcIssuerEnabled;

  const noIncompatibleAddons = incompatibleAddons.length === 0;

  const overallReady =
    versionCompatible && cniOverlayEnabled && workloadIdentityReady && noIncompatibleAddons;

  const issues: string[] = [];
  if (!versionCompatible) {
    issues.push(`Kubernetes ${k8sVersion} < 1.28 (minimum required)`);
  }
  if (!cniOverlayEnabled) {
    issues.push(`Network plugin/mode is ${networkPlugin}/${networkPluginMode || 'default'} — Azure CNI Overlay required`);
  }
  if (!workloadIdentityReady) {
    issues.push(
      `Workload identity not fully enabled (workloadIdentity=${workloadIdentityEnabled}, oidcIssuer=${oidcIssuerEnabled})`,
    );
  }
  if (!noIncompatibleAddons) {
    issues.push(`Incompatible add-ons present: ${incompatibleAddons.join(', ')}`);
  }

  const summary = overallReady
    ? `Cluster is compatible with AKS Automatic (k8s ${k8sVersion}, CNI Overlay, workload identity enabled).`
    : `Cluster has ${issues.length} compatibility issue(s) for AKS Automatic: ${issues.join('; ')}.`;

  return { versionCompatible, cniOverlayEnabled, workloadIdentityReady, noIncompatibleAddons, overallReady, summary };
}

// ── Type alias ────────────────────────────────────────────────────────────────
type AssessAksClusterOutputSchema = z.infer<typeof AssessAksClusterOutputSchema>;

// ── Tool ──────────────────────────────────────────────────────────────────────

export const assessAksClusterTool: ToolContribution = {
  name: 'azure.assess_aks_cluster',
  tool: tool({
    name: 'azure.assess_aks_cluster',
    description:
      'Assesses an existing AKS cluster for compatibility with AKS Automatic. ' +
      'Retrieves cluster properties from Azure ARM and returns a structured readiness report ' +
      'covering Kubernetes version, network configuration (CNI overlay), workload identity, ' +
      'enabled add-ons, and per-node-pool SKU details. ' +
      'Use this tool before recommending an in-place migration to AKS Automatic.',
    parameters: AssessAksClusterInputSchema,
    execute: async (
      input,
      runCtx,
    ): Promise<z.infer<typeof AssessAksClusterOutputSchema>> => {
      const errResult = (msg: string): z.infer<typeof AssessAksClusterOutputSchema> => ({
        clusterName: input.clusterName,
        location: '',
        kubernetesVersion: '',
        provisioningState: '',
        networkPlugin: '',
        networkPluginMode: null,
        networkPolicy: null,
        loadBalancerSku: null,
        workloadIdentityEnabled: false,
        oidcIssuerEnabled: false,
        azureRbacEnabled: false,
        localAccountsDisabled: false,
        nodePools: [],
        enabledAddons: [],
        incompatibleAddons: [],
        automaticCompatibility: {
          versionCompatible: false,
          cniOverlayEnabled: false,
          workloadIdentityReady: false,
          noIncompatibleAddons: false,
          overallReady: false,
          summary: `Assessment failed: ${msg}`,
        },
        error: msg,
      });

      try {
        const session = runCtx?.context as SessionCtx | undefined;
        const token = getAzureToken(session);

        const url =
          `${armBaseUrl()}/subscriptions/${encodeURIComponent(input.subscriptionId)}` +
          `/resourceGroups/${encodeURIComponent(input.resourceGroup)}` +
          `/providers/Microsoft.ContainerService/managedClusters/${encodeURIComponent(input.clusterName)}` +
          `?api-version=${AKS_API_VERSION}`;

        const response = await fetch(url, {
          headers: armAuthHeaders(token),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          return errResult(
            `ARM AKS HTTP ${response.status} for ${input.clusterName}: ${body.slice(0, 500)}`,
          );
        }

        const cluster = (await response.json()) as ManagedCluster;
        const props = cluster.properties ?? {};

        // Node pools
        const nodePools = (props.agentPoolProfiles ?? []).map((pool) => ({
          name: pool.name ?? '',
          vmSize: pool.vmSize ?? '',
          osType: pool.osType ?? '',
          mode: pool.mode ?? '',
          count: pool.count ?? 0,
          minCount: pool.minCount ?? null,
          maxCount: pool.maxCount ?? null,
          autoscalingEnabled: pool.enableAutoScaling === true,
        }));

        // Add-ons
        const addonProfiles = props.addonProfiles ?? {};
        const enabledAddons = Object.entries(addonProfiles)
          .filter(([, profile]) => profile.enabled === true)
          .map(([name]) => name);

        const incompatibleAddons = enabledAddons.filter((name) =>
          INCOMPATIBLE_ADDONS.includes(name),
        );

        // Compatibility assessment
        const automaticCompatibility = assessAutomaticCompatibility(
          props,
          enabledAddons,
          incompatibleAddons,
        );

        return {
          clusterName: cluster.name ?? input.clusterName,
          location: cluster.location ?? '',
          kubernetesVersion: props.kubernetesVersion ?? '',
          provisioningState: props.provisioningState ?? '',
          networkPlugin: props.networkProfile?.networkPlugin ?? '',
          networkPluginMode: props.networkProfile?.networkPluginMode ?? null,
          networkPolicy: props.networkProfile?.networkPolicy ?? null,
          loadBalancerSku: props.networkProfile?.loadBalancerSku ?? null,
          workloadIdentityEnabled: props.securityProfile?.workloadIdentity?.enabled === true,
          oidcIssuerEnabled: props.oidcIssuerProfile?.enabled === true,
          azureRbacEnabled: props.aadProfile?.enableAzureRBAC === true,
          localAccountsDisabled: props.disableLocalAccounts === true,
          nodePools,
          enabledAddons,
          incompatibleAddons,
          automaticCompatibility,
          error: null,
        };
      } catch (err) {
        return errResult((err as Error).message);
      }
    },
  }),
};
