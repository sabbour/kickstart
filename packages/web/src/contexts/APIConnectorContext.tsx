import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  APIConnectorRegistry,
  PricingConnector,
} from '@aks-kickstart/harness';
import type {
  APIConnector,
  AzureLocation,
  AzureResource,
  AzureResourceGroup,
  AzureSubscription,
  GitHubCommitFilesInput,
  GitHubCommitFilesResult,
} from '@aks-kickstart/harness';
import { apiFetch, buildSwaLoginUrl } from '../services/api-client';
import { armFetchRaw, armList } from '../services/arm-client';
import {
  getGitHubSession,
  signInWithGitHubPopup,
} from '../services/github-handoff';
import { isPlaygroundMockModeEnabled } from './PlaygroundMockModeContext';

const MOCK_SUBSCRIPTIONS: AzureSubscription[] = [
  {
    subscriptionId: '00000000-0000-0000-0000-000000000001',
    displayName: 'Mock Kickstart Subscription',
    state: 'Enabled',
    tenantId: '00000000-0000-0000-0000-000000000099',
  },
];

const MOCK_LOCATIONS: AzureLocation[] = [
  { name: 'eastus', displayName: 'East US' },
  { name: 'eastus2', displayName: 'East US 2' },
  { name: 'westus2', displayName: 'West US 2' },
];

const MOCK_RESOURCE_GROUPS: AzureResourceGroup[] = [
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg',
    name: 'kickstart-rg',
    location: 'eastus',
    provisioningState: 'Succeeded',
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/networking-rg',
    name: 'networking-rg',
    location: 'eastus2',
    provisioningState: 'Succeeded',
  },
];

const MOCK_RESOURCES: AzureResource[] = [
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerService/managedClusters/kickstart-aks',
    name: 'kickstart-aks',
    type: 'Microsoft.ContainerService/managedClusters',
    location: 'eastus',
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerRegistry/registries/kickstartacr',
    name: 'kickstartacr',
    type: 'Microsoft.ContainerRegistry/registries',
    location: 'eastus',
  },
];

const MOCK_GITHUB_OWNER = 'kickstart-mock';

function withSubscriptionId<T extends { id?: string; subscriptionId?: string }>(
  item: T,
  subscriptionId: string,
): T {
  return {
    ...item,
    id: item.id?.replace('{subscriptionId}', subscriptionId),
    subscriptionId,
  };
}

class BrowserAzureARMConnector implements APIConnector {
  readonly name = 'azure-arm';
  private authenticated = false;

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async authenticate(): Promise<void> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return;
    }

    const response = await fetch('/.auth/me', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error('Unable to check Microsoft sign-in status.');
    }

    const body = await response.json().catch(() => undefined) as {
      clientPrincipal?: { identityProvider?: string } | null;
    } | undefined;
    const provider = body?.clientPrincipal?.identityProvider;
    const isSignedIn = provider === 'aad' || provider === 'azureActiveDirectory';
    this.authenticated = isSignedIn;

    if (!isSignedIn) {
      window.location.assign(buildSwaLoginUrl());
    }
  }

  async listSubscriptions(): Promise<AzureSubscription[]> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return MOCK_SUBSCRIPTIONS;
    }

    const body = await this.getArmList<AzureSubscription>('/subscriptions?api-version=2022-12-01');
    return body
      .map((subscription) => ({
        ...subscription,
        subscriptionId: subscription.subscriptionId ?? subscription.id?.split('/').pop() ?? '',
      }))
      .filter((subscription) => subscription.subscriptionId);
  }

  async listLocations(subscriptionId: string): Promise<AzureLocation[]> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return MOCK_LOCATIONS.map((location) => ({ ...location, subscriptionId }));
    }

    return this.getArmList<AzureLocation>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/locations?api-version=2022-12-01`,
    );
  }

  async listResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return MOCK_RESOURCE_GROUPS.map((group) => withSubscriptionId(group, subscriptionId));
    }

    const groups = await this.getArmList<AzureResourceGroup>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups?api-version=2021-04-01`,
    );
    return groups.map((group) => ({ ...group, subscriptionId }));
  }

  async listResources(subscriptionId: string): Promise<AzureResource[]> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return MOCK_RESOURCES.map((resource) => withSubscriptionId(resource, subscriptionId));
    }

    const resources = await this.getArmList<AzureResource>(
      `/subscriptions/${encodeURIComponent(subscriptionId)}/resources?api-version=2021-04-01`,
    );
    return resources.map((resource) => ({
      ...resource,
      subscriptionId,
      resourceGroup: resource.resourceGroup ?? resource.id.match(/resourceGroups\/([^/]+)/i)?.[1],
    }));
  }

  async request(method: string, path: string, body?: unknown): Promise<Response> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return new Response(JSON.stringify({
        id: path,
        name: path.split('/').filter(Boolean).at(-1) ?? 'mock-resource',
        method,
        body,
        provisioningState: 'Succeeded',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ARM is now called directly from the browser using a SWA-issued token
    // — see issue #237 / DP #194. The legacy /api/arm-proxy round-trip is
    // gone. armFetchRaw still returns a Response for the legacy
    // APIConnector.request() shape.
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const response = await armFetchRaw(method, normalizedPath, body);
    this.authenticated = response.ok;
    return response;
  }

  private async getArmList<T>(path: string): Promise<T[]> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const result = await armList<T>(normalizedPath);
    if (!result.ok) {
      this.authenticated = result.error.kind !== 'auth-error' ? this.authenticated : false;
      throw new Error(result.error.message);
    }
    this.authenticated = true;
    return result.value;
  }
}

class BrowserGitHubConnector implements APIConnector {
  readonly name = 'github';
  private authenticated = false;

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async authenticate(): Promise<void> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return;
    }

    const session = await signInWithGitHubPopup();
    this.authenticated = session.authenticated;
  }

  async request(method: string, path: string, body?: unknown): Promise<Response> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      const payload = (body ?? {}) as Record<string, unknown>;
      const repoName = typeof payload.name === 'string' && payload.name.trim()
        ? payload.name.trim()
        : 'kickstart-sample';
      return new Response(JSON.stringify({
        id: 1001,
        name: repoName,
        full_name: `${MOCK_GITHUB_OWNER}/${repoName}`,
        owner: { login: MOCK_GITHUB_OWNER },
        private: payload.private === true,
        html_url: `https://github.com/${MOCK_GITHUB_OWNER}/${repoName}`,
        description: typeof payload.description === 'string' ? payload.description : 'Mock repository',
        default_branch: 'main',
        language: 'TypeScript',
        stargazers_count: 0,
        updated_at: new Date().toISOString(),
      }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const normalizedMethod = method.toUpperCase();
    const repoCreateMatch = path.match(/^\/(?:user|orgs\/([^/]+))\/repos$/);
    if (normalizedMethod === 'POST' && repoCreateMatch) {
      const payload = (body ?? {}) as Record<string, unknown>;
      const owner = repoCreateMatch[1] ?? await this.defaultOwner();
      return apiFetch('/api/github/repos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          name: typeof payload.name === 'string' ? payload.name : '',
          description: typeof payload.description === 'string' ? payload.description : undefined,
          private: payload.private === true,
        }),
      });
    }

    return new Response(JSON.stringify({
      error: 'This GitHub operation is not available through the server-owned GitHub handoff endpoints.',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async commitFilesAndCreatePullRequest(
    input: GitHubCommitFilesInput,
  ): Promise<GitHubCommitFilesResult> {
    if (isPlaygroundMockModeEnabled()) {
      this.authenticated = true;
      return {
        committedFilesCount: input.files.length,
        pullRequest: {
          number: 42,
          html_url: `https://github.com/${input.owner}/${input.repo}/pull/42`,
          title: input.title,
          state: 'open',
        },
      };
    }

    const response = await apiFetch('/api/github/pulls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const body = await response.json().catch(() => undefined) as
      | (GitHubCommitFilesResult & { error?: string })
      | undefined;
    if (!response.ok) {
      throw new Error(body?.error ?? `GitHub pull request creation failed (${response.status}).`);
    }
    this.authenticated = true;
    if (!body) {
      throw new Error('GitHub pull request creation returned an empty response.');
    }
    return body;
  }

  private async defaultOwner(): Promise<string> {
    if (isPlaygroundMockModeEnabled()) {
      return MOCK_GITHUB_OWNER;
    }

    const session = await getGitHubSession();
    this.authenticated = session.authenticated;
    const owner = session.viewer?.login ?? session.owners[0]?.login;
    if (!owner) {
      throw new Error('Sign in to GitHub before creating a repository.');
    }
    return owner;
  }
}

interface APIConnectorContextValue {
  registry: APIConnectorRegistry;
  /** Convenience helper — equivalent to registry.get(name). */
  getConnector: (name: string) => APIConnector | undefined;
}

const APIConnectorContext = createContext<APIConnectorContextValue | null>(null);

interface APIConnectorProviderProps {
  children: ReactNode;
  /**
   * Optional: pass a pre-configured registry (useful in tests or Storybook).
   * When omitted, a default registry with AzureARM + GitHub + Pricing connectors
   * is created automatically.
   */
  registry?: APIConnectorRegistry;
}

/**
 * Provides the APIConnector registry to the React tree.
 *
 * Place this near the top of your component tree (wrapping the whole app).
 * Connectors are initialized at mount time — no re-renders on connector state
 * changes.
 *
 * Usage:
 *   <APIConnectorProvider>
 *     <App />
 *   </APIConnectorProvider>
 */
export function APIConnectorProvider({
  children,
  registry: externalRegistry,
}: APIConnectorProviderProps) {
  const registry = useMemo(() => {
    if (externalRegistry) return externalRegistry;

    const r = new APIConnectorRegistry();
    r.register(new BrowserAzureARMConnector());
    r.register(new BrowserGitHubConnector());
    r.register(new PricingConnector());
    return r;
  }, [externalRegistry]);

  const value = useMemo<APIConnectorContextValue>(
    () => ({
      registry,
      getConnector: (name: string) => registry.get(name),
    }),
    [registry],
  );

  return (
    <APIConnectorContext.Provider value={value}>{children}</APIConnectorContext.Provider>
  );
}

/**
 * Returns the connector registered under `name`, or `undefined` if not found.
 *
 * Must be used inside an `<APIConnectorProvider>`.
 *
 * Usage:
 *   const arm = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
 */
export function useAPIConnector(name: string): APIConnector | undefined {
  const ctx = useContext(APIConnectorContext);
  if (!ctx) {
    throw new Error('useAPIConnector must be used within an <APIConnectorProvider>');
  }
  return ctx.getConnector(name);
}

/**
 * Returns the full connector registry.
 *
 * Use this when you need to register connectors dynamically (e.g., from an
 * IntegrationKit) or when you want to enumerate all available connectors.
 */
export function useAPIConnectorRegistry(): APIConnectorRegistry {
  const ctx = useContext(APIConnectorContext);
  if (!ctx) {
    throw new Error('useAPIConnectorRegistry must be used within an <APIConnectorProvider>');
  }
  return ctx.registry;
}
