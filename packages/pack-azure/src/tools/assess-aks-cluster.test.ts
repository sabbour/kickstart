import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  assessAutomaticCompatibility,
  assessAksClusterTool,
} from './assess-aks-cluster.js';
import type { FunctionTool } from '@openai/agents';

// ── Helper unit tests ─────────────────────────────────────────────────────────

describe('assessAutomaticCompatibility', () => {
  it('returns overallReady=true for a fully-compatible cluster', () => {
    const props = {
      kubernetesVersion: '1.29.2',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.overallReady).toBe(true);
    expect(result.versionCompatible).toBe(true);
    expect(result.cniOverlayEnabled).toBe(true);
    expect(result.workloadIdentityReady).toBe(true);
    expect(result.noIncompatibleAddons).toBe(true);
    expect(result.summary).toMatch(/compatible with AKS Automatic/);
  });

  it('detects version < 1.28 as incompatible', () => {
    const props = {
      kubernetesVersion: '1.27.9',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.versionCompatible).toBe(false);
    expect(result.overallReady).toBe(false);
    expect(result.summary).toMatch(/1\.27\.9/);
  });

  it('detects kubenet as non-CNI-overlay', () => {
    const props = {
      kubernetesVersion: '1.29.0',
      networkProfile: { networkPlugin: 'kubenet', networkPluginMode: '' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.cniOverlayEnabled).toBe(false);
    expect(result.overallReady).toBe(false);
  });

  it('detects azure CNI without overlay mode as incompatible', () => {
    const props = {
      kubernetesVersion: '1.29.0',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'transparent' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.cniOverlayEnabled).toBe(false);
    expect(result.overallReady).toBe(false);
  });

  it('detects missing workload identity as incompatible', () => {
    const props = {
      kubernetesVersion: '1.29.0',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay' },
      securityProfile: { workloadIdentity: { enabled: false } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.workloadIdentityReady).toBe(false);
    expect(result.overallReady).toBe(false);
  });

  it('detects missing OIDC issuer as incompatible', () => {
    const props = {
      kubernetesVersion: '1.29.0',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: false },
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.workloadIdentityReady).toBe(false);
    expect(result.overallReady).toBe(false);
  });

  it('detects incompatible add-ons', () => {
    const props = {
      kubernetesVersion: '1.29.0',
      networkProfile: { networkPlugin: 'azure', networkPluginMode: 'overlay' },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
    };
    const result = assessAutomaticCompatibility(props, ['kubeDashboard'], ['kubeDashboard']);
    expect(result.noIncompatibleAddons).toBe(false);
    expect(result.overallReady).toBe(false);
    expect(result.summary).toMatch(/kubeDashboard/);
  });

  it('handles missing/undefined networkProfile gracefully', () => {
    const props = {
      kubernetesVersion: '1.29.0',
    };
    const result = assessAutomaticCompatibility(props, [], []);
    expect(result.cniOverlayEnabled).toBe(false);
  });
});

// ── Tool invoke tests (fetch-mocked) ──────────────────────────────────────────

const SUB_ID = '00000000-0000-0000-0000-000000000000';
const RG = 'my-rg';
const CLUSTER = 'my-aks';

function makeRunCtx(token = 'test-token') {
  return { context: { tokens: { azure: token } } };
}

function makeClusterResponse(overrides: Record<string, unknown> = {}) {
  return {
    name: CLUSTER,
    location: 'eastus',
    properties: {
      kubernetesVersion: '1.29.2',
      provisioningState: 'Succeeded',
      networkProfile: {
        networkPlugin: 'azure',
        networkPluginMode: 'overlay',
        networkPolicy: 'cilium',
        loadBalancerSku: 'standard',
      },
      securityProfile: { workloadIdentity: { enabled: true } },
      oidcIssuerProfile: { enabled: true },
      aadProfile: { enableAzureRBAC: true },
      disableLocalAccounts: false,
      agentPoolProfiles: [
        {
          name: 'systempool',
          vmSize: 'Standard_D4s_v3',
          osType: 'Linux',
          mode: 'System',
          count: 3,
          enableAutoScaling: false,
        },
      ],
      addonProfiles: {
        omsagent: { enabled: true },
        kubeDashboard: { enabled: false },
      },
      ...overrides,
    },
  };
}

describe('azure.assess_aks_cluster tool invoke', () => {
  const invokeFn = (assessAksClusterTool.tool as FunctionTool).invoke as (
    ctx: unknown,
    input: string,
  ) => Promise<unknown>;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a fully-populated assessment for a compatible cluster', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeClusterResponse(),
    } as Response);

    const result = (await invokeFn(
      makeRunCtx(),
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    )) as Record<string, unknown>;

    expect(result.error).toBeNull();
    expect(result.clusterName).toBe(CLUSTER);
    expect(result.kubernetesVersion).toBe('1.29.2');
    expect(result.networkPlugin).toBe('azure');
    expect(result.networkPluginMode).toBe('overlay');
    expect(result.workloadIdentityEnabled).toBe(true);
    expect(result.oidcIssuerEnabled).toBe(true);
    expect((result.automaticCompatibility as Record<string, unknown>).overallReady).toBe(true);
    expect(result.enabledAddons).toEqual(['omsagent']);
    expect(result.incompatibleAddons).toEqual([]);
  });

  it('returns incompatibleAddons for kubeDashboard=enabled', async () => {
    const data = makeClusterResponse({
      addonProfiles: { kubeDashboard: { enabled: true } },
    });
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => data,
    } as Response);

    const result = (await invokeFn(
      makeRunCtx(),
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    )) as Record<string, unknown>;

    expect(result.incompatibleAddons).toEqual(['kubeDashboard']);
    expect((result.automaticCompatibility as Record<string, unknown>).noIncompatibleAddons).toBe(false);
    expect((result.automaticCompatibility as Record<string, unknown>).overallReady).toBe(false);
  });

  it('returns error result on HTTP 404', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    } as Response);

    const result = (await invokeFn(
      makeRunCtx(),
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    )) as Record<string, unknown>;

    expect(result.error).toMatch(/404/);
    expect((result.automaticCompatibility as Record<string, unknown>).overallReady).toBe(false);
    expect((result.automaticCompatibility as Record<string, unknown>).summary).toMatch(/failed/i);
  });

  it('returns error result when no azure token present', async () => {
    const result = (await invokeFn(
      { context: {} }, // no tokens
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    )) as Record<string, unknown>;

    expect(result.error).toMatch(/token/i);
  });

  it('builds the correct ARM URL (contains cluster name)', async () => {
    let capturedUrl = '';
    vi.mocked(fetch).mockImplementationOnce(async (url) => {
      capturedUrl = url as string;
      return { ok: true, json: async () => makeClusterResponse() } as Response;
    });

    await invokeFn(
      makeRunCtx(),
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    );

    expect(capturedUrl).toContain('managedClusters');
    expect(capturedUrl).toContain(CLUSTER);
    expect(capturedUrl).toContain(SUB_ID);
  });

  it('returns node pool details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => makeClusterResponse(),
    } as Response);

    const result = (await invokeFn(
      makeRunCtx(),
      JSON.stringify({ subscriptionId: SUB_ID, resourceGroup: RG, clusterName: CLUSTER }),
    )) as Record<string, unknown>;

    const nodePools = result.nodePools as Array<Record<string, unknown>>;
    expect(nodePools).toHaveLength(1);
    expect(nodePools[0].name).toBe('systempool');
    expect(nodePools[0].vmSize).toBe('Standard_D4s_v3');
    expect(nodePools[0].autoscalingEnabled).toBe(false);
  });
});
