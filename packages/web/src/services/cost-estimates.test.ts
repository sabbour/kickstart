import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCostEstimate,
  normalizeCostEstimateResponse,
} from './cost-estimates';

describe('cost-estimates service', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('normalizes legacy total + stub responses into the unified contract', () => {
    const estimate = normalizeCostEstimateResponse({
      items: [{ name: 'VM', sku: 'B1ms', monthlyCost: 12.4 }],
      total: 12.4,
      currency: 'USD',
      source: 'stub',
    });

    expect(estimate).toMatchObject({
      monthlyEstimate: 12.4,
      currency: 'USD',
      source: 'estimated',
    });
    expect(estimate.fallback).toBeUndefined();
    expect(estimate.resources).toEqual([
      { name: 'VM', sku: 'B1ms', monthlyEstimate: 12.4 },
    ]);
  });

  it('posts pricing requests to the session cost-estimate endpoint and preserves cache metadata', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      resources: [{ name: 'AKS Automatic control plane', sku: 'Standard', monthlyEstimate: 116.8 }],
      monthlyEstimate: 116.8,
      currency: 'USD',
      source: 'live',
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
      cache: {
        status: 'hit',
      },
    }), { status: 200 }));

    const request = {
      region: 'eastus',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    };

    const estimate = await fetchCostEstimate('session-123', request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-123/cost-estimate', expect.objectContaining({
      method: 'POST',
      redirect: 'manual',
    }));

    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(init?.body).toBe(JSON.stringify(request));
    expect(estimate).toMatchObject({
      monthlyEstimate: 116.8,
      source: 'live',
      citation: 'Prices from Azure Retail Prices API (East US, consumption).',
      cache: { status: 'hit' },
    });
  });
});
