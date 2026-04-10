import type { ConnectorConfig } from './types.js';
import { BaseConnector } from './BaseConnector.js';

/** Sample resource shapes returned by the stub. */
export interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  tags?: Record<string, string>;
}

export interface AzureResourceGroup {
  id: string;
  name: string;
  location: string;
  provisioningState: string;
}

/**
 * Default ARM auth scopes — requests tokens for the Azure management plane.
 */
const DEFAULT_ARM_SCOPES = ['https://management.azure.com/.default'];

/**
 * Connector for the Azure Resource Manager REST API.
 *
 * Auth: OAuth2 via MSAL (injected with `setTokenProvider()`).
 * When no token provider is set, domain methods return stub data so
 * the app can function offline during local development.
 */
export class AzureARMConnector extends BaseConnector {
  readonly name = 'azure-arm';

  protected get defaultBaseUrl(): string {
    return 'https://management.azure.com';
  }

  /**
   * Create a new AzureARMConnector.
   * @param config - Optional connector config. Defaults to OAuth2 auth
   *                 with ARM scopes if not specified.
   */
  constructor(config?: ConnectorConfig) {
    super(config ?? { auth: { kind: 'oauth2', scopes: DEFAULT_ARM_SCOPES } });
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /**
   * Lists resources for a subscription.
   * Returns stub data when not authenticated (local dev / stub mode).
   */
  async listResources(subscriptionId: string): Promise<AzureResource[]> {
    if (this.isStubMode()) {
      return STUB_RESOURCES.map((r) => ({
        ...r,
        id: r.id.replace('{subscriptionId}', subscriptionId),
      }));
    }

    const path = `/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`;
    const res = await this.request('GET', path);
    const json = (await res.json()) as { value?: AzureResource[] };
    return json.value ?? [];
  }

  /**
   * Gets a single resource by its full ARM resource ID.
   * Returns stub data when not authenticated.
   */
  async getResource(resourceId: string): Promise<AzureResource | null> {
    if (this.isStubMode()) {
      return STUB_RESOURCES.find((r) => r.id === resourceId) ?? STUB_RESOURCES[0];
    }

    const path = `${resourceId}?api-version=2021-04-01`;
    const res = await this.request('GET', path);
    if (res.status === 404) return null;
    return (await res.json()) as AzureResource;
  }

  /**
   * Creates (or updates) an Azure resource.
   * Returns stub data when not authenticated.
   */
  async createResource(
    subscriptionId: string,
    resourceGroupName: string,
    resourceType: string,
    resourceName: string,
    properties: Record<string, unknown>,
  ): Promise<AzureResource> {
    if (this.isStubMode()) {
      return {
        id: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${resourceType}/${resourceName}`,
        name: resourceName,
        type: resourceType,
        location: 'eastus',
        tags: {},
      };
    }

    const path = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/${resourceType}/${resourceName}?api-version=2021-04-01`;
    const res = await this.request('PUT', path, { location: 'eastus', ...properties });
    return (await res.json()) as AzureResource;
  }
}

// ── Stub data ─────────────────────────────────────────────────────────────────

const STUB_RESOURCES: AzureResource[] = [
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerService/managedClusters/kickstart-aks',
    name: 'kickstart-aks',
    type: 'Microsoft.ContainerService/managedClusters',
    location: 'eastus',
    tags: { environment: 'dev', project: 'kickstart' },
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerRegistry/registries/kickstartacr',
    name: 'kickstartacr',
    type: 'Microsoft.ContainerRegistry/registries',
    location: 'eastus',
    tags: { environment: 'dev', project: 'kickstart' },
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.Network/publicIPAddresses/kickstart-pip',
    name: 'kickstart-pip',
    type: 'Microsoft.Network/publicIPAddresses',
    location: 'eastus',
    tags: { environment: 'dev', project: 'kickstart' },
  },
];
