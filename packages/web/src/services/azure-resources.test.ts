import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AzureDiscoveryUnavailableError,
  listAzureLocations,
  listAzureSubscriptions,
} from './azure-resources';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });
}

describe('azure-resources', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normalizes Azure subscription payloads from backend-owned discovery endpoints', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      subscriptions: [
        {
          id: '/subscriptions/sub-123',
          name: 'Demo Subscription',
          state: 'Enabled',
          tenantId: 'tenant-123',
        },
      ],
    }));

    await expect(listAzureSubscriptions()).resolves.toEqual([
      {
        subscriptionId: 'sub-123',
        displayName: 'Demo Subscription',
        state: 'Enabled',
        tenantId: 'tenant-123',
      },
    ]);
  });

  it('fills a display name when Azure location discovery only returns region names', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      locations: [
        { name: 'eastus' },
      ],
    }));

    await expect(listAzureLocations('sub-123')).resolves.toEqual([
      { name: 'eastus', displayName: 'eastus' },
    ]);
  });

  it('raises a discovery-unavailable error when the backend endpoint is missing', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    await expect(listAzureSubscriptions()).rejects.toBeInstanceOf(AzureDiscoveryUnavailableError);
  });
});
