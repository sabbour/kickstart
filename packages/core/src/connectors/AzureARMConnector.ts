import type { APIConnector, APIConnectorRequestOptions } from './types.js';

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
 * Connector for the Azure Resource Manager REST API.
 *
 * Auth: MSAL (coming in B-14). For now, `authenticate()` is a no-op and
 * `isAuthenticated()` returns false until tokens are wired.
 *
 * All methods return stub data so the rest of the app can build against
 * real shapes before the auth layer exists.
 */
export class AzureARMConnector implements APIConnector {
  readonly name = 'azure-arm';
  readonly baseUrl = 'https://management.azure.com';

  private _token: string | null = null;

  async authenticate(): Promise<void> {
    // TODO (B-14): acquire MSAL token and store in this._token
    // Stubbed — MSAL integration pending (B-14)
  }

  isAuthenticated(): boolean {
    return this._token !== null;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
      ...options?.headers,
    };

    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /**
   * Lists resource groups and resources for a subscription.
   * Returns stub data until auth is wired (B-14).
   */
  async listResources(subscriptionId: string): Promise<AzureResource[]> {
    if (!this.isAuthenticated()) {
      return STUB_RESOURCES.map((r) => ({
        ...r,
        id: r.id.replace('{subscriptionId}', subscriptionId),
      }));
    }

    const path = `/subscriptions/${subscriptionId}/resources?api-version=2021-04-01`;
    const res = await this.request('GET', path);
    const json = await res.json();
    return json.value ?? [];
  }

  /**
   * Gets a single resource by its full ARM resource ID.
   * Returns stub data until auth is wired (B-14).
   */
  async getResource(resourceId: string): Promise<AzureResource | null> {
    if (!this.isAuthenticated()) {
      return STUB_RESOURCES.find((r) => r.id === resourceId) ?? STUB_RESOURCES[0];
    }

    const path = `${resourceId}?api-version=2021-04-01`;
    const res = await this.request('GET', path);
    if (res.status === 404) return null;
    return res.json();
  }

  /**
   * Creates (or updates) an Azure resource.
   * Returns stub data until auth is wired (B-14).
   */
  async createResource(
    subscriptionId: string,
    resourceGroupName: string,
    resourceType: string,
    resourceName: string,
    properties: Record<string, unknown>,
  ): Promise<AzureResource> {
    if (!this.isAuthenticated()) {
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
    return res.json();
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
