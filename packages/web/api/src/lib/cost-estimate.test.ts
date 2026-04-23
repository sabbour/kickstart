import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSession } from './session-store.js';
import {
  CostEstimateRequestError,
  getCostEstimateRequestKey,
  normalizeCostEstimateRequest,
  resolveSessionCostEstimate,
} from './cost-estimate.js';

function makeRetailPriceResponse(overrides: Record<string, unknown> = {}): Response {
  const item = {
    currencyCode: 'USD',
    tierMinimumUnits: 0,
    retailPrice: 0.16,
    unitPrice: 0.16,
    armRegionName: 'eastus',
    location: 'US East',
    effectiveStartDate: '2024-01-01T00:00:00Z',
    meterId: 'meter-1',
    meterName: 'Automatic Hosted Control Plane',
    productId: 'product-1',
    skuId: 'sku-1',
    productName: 'Azure Kubernetes Service',
    skuName: 'Automatic',
    serviceName: 'Azure Kubernetes Service',
    serviceId: 'service-1',
    serviceFamily: 'Compute',
    unitOfMeasure: '1 Hour',
    type: 'Consumption',
    isPrimaryMeterRegion: true,
    ...overrides,
  };

  return new Response(JSON.stringify({
    BillingCurrency: 'USD',
    CustomerEntityId: '',
    CustomerEntityType: '',
    Items: [item],
    Count: 1,
    NextPageLink: null,
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('cost estimate resolver', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('rejects unsupported regions up front', () => {
    expect(() => normalizeCostEstimateRequest({
      region: 'centralus',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    })).toThrowError(CostEstimateRequestError);
  });

  it('caches live pricing per session', async () => {
    fetchMock.mockResolvedValue(makeRetailPriceResponse());

    const session = createSession();
    const request = {
      region: 'eastus',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    };

    const first = await resolveSessionCostEstimate(session, request);
    const second = await resolveSessionCostEstimate(session, request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({
      source: 'live',
      monthlyEstimate: 116.8,
      cache: { status: 'miss' },
      fallback: { used: false },
    });
    expect(second).toMatchObject({
      source: 'live',
      monthlyEstimate: 116.8,
      cache: { status: 'hit' },
      fallback: { used: false },
    });
  });

  it('falls back to estimated pricing when live pricing fails', async () => {
    fetchMock.mockRejectedValue(new Error('Azure Retail API unavailable'));

    const estimate = await resolveSessionCostEstimate(createSession(), {
      region: 'eastus2',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    });

    expect(estimate).toMatchObject({
      source: 'estimated',
      monthlyEstimate: 116.8,
      cache: { status: 'miss' },
      fallback: {
        used: true,
        reason: 'live_pricing_unavailable',
      },
    });
  });

  it('reuses stale live cache when Azure pricing is temporarily unavailable', async () => {
    const request = {
      region: 'westus',
      lineItems: [{ id: 'aks-control-plane', kind: 'aksAutomaticControlPlane' }],
    };

    fetchMock
      .mockResolvedValueOnce(makeRetailPriceResponse())
      .mockRejectedValueOnce(new Error('Azure Retail API unavailable'));

    const session = createSession();
    const normalized = normalizeCostEstimateRequest(request);
    const fresh = await resolveSessionCostEstimate(session, request);
    const cacheEntry = session.costEstimateCache.get(getCostEstimateRequestKey(normalized));

    if (!cacheEntry) {
      throw new Error('expected cached live estimate');
    }

    const futureNow = Date.now() + (11 * 60 * 1000);
    vi.spyOn(Date, 'now').mockReturnValue(futureNow);
    cacheEntry.expiresAt = futureNow - 1;

    const stale = await resolveSessionCostEstimate(session, request);

    expect(fresh).toMatchObject({ source: 'live', cache: { status: 'miss' } });
    expect(stale).toMatchObject({ source: 'live', cache: { status: 'stale' } });
    expect(stale.citation).toContain('Using cached live pricing');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
