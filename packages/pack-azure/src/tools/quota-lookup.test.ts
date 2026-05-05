import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findSkuUsage, buildQuotaRequestUrl, fetchPricingInfo, quotaLookupTool } from './quota-lookup.js';
import type { FunctionTool } from '@openai/agents';

// ── Helper unit tests ─────────────────────────────────────────────────────────

const SAMPLE_USAGES = [
  { currentValue: 4, limit: 24, name: { value: 'standardNCSFamily', localizedValue: 'Standard NCS Family' } },
  { currentValue: 0, limit: 48, name: { value: 'standardNCv3Family', localizedValue: 'Standard NCv3 Family' } },
  { currentValue: 48, limit: 48, name: { value: 'standardNCSv3Family', localizedValue: 'Standard NCSv3 Family' } },
];

describe('findSkuUsage', () => {
  it('finds an exact (case-insensitive) match', () => {
    expect(findSkuUsage(SAMPLE_USAGES, 'standardNCSFamily')?.name.value).toBe('standardNCSFamily');
  });

  it('matches case-insensitively', () => {
    expect(findSkuUsage(SAMPLE_USAGES, 'STANDARDNCSV3FAMILY')?.name.value).toBe('standardNCSv3Family');
  });

  it('returns undefined for an unknown SKU family', () => {
    expect(findSkuUsage(SAMPLE_USAGES, 'standardND96amsr_A100_v4Family')).toBeUndefined();
  });

  it('returns the first matching entry when multiple entries match the substring', () => {
    expect(findSkuUsage(SAMPLE_USAGES, 'standardNCS')?.name.value).toBe('standardNCSFamily');
  });

  it('returns undefined for an empty usages array', () => {
    expect(findSkuUsage([], 'standardNCSFamily')).toBeUndefined();
  });
});

describe('buildQuotaRequestUrl', () => {
  it('contains the subscription ID', () => {
    expect(buildQuotaRequestUrl('00000000-0000-0000-0000-000000000000', 'eastus'))
      .toContain('00000000-0000-0000-0000-000000000000');
  });

  it('contains the region', () => {
    expect(buildQuotaRequestUrl('sub-id', 'westeurope')).toContain('westeurope');
  });

  it('points to the Azure Portal quota blade', () => {
    const url = buildQuotaRequestUrl('sub-id', 'eastus');
    expect(url).toContain('portal.azure.com');
    expect(url).toContain('QuotaRequestBlade');
  });
});

// ── fetchPricingInfo (public pricing API) ─────────────────────────────────────

describe('fetchPricingInfo', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns pricePerHour and skuAvailableInRegion=true when SKU is found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Items: [{ armSkuName: 'Standard_NC4as_T4_v3', skuName: 'Standard NCS Family', retailPrice: 0.526, currencyCode: 'USD', type: 'Consumption' }],
      }),
    } as Response);

    const result = await fetchPricingInfo('eastus', 'standardNCSFamily');
    expect(result.skuAvailableInRegion).toBe(true);
    expect(result.pricePerHour).toBeCloseTo(0.526);
    expect(result.currency).toBe('USD');
  });

  it('returns skuAvailableInRegion=false when no matching SKU is found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Items: [{ armSkuName: 'Standard_D4s_v3', skuName: 'Standard D4s v3', retailPrice: 0.192 }] }),
    } as Response);

    const result = await fetchPricingInfo('eastus', 'standardNCADSA100v4Family');
    expect(result.skuAvailableInRegion).toBe(false);
    expect(result.pricePerHour).toBeNull();
  });

  it('returns skuAvailableInRegion=true (fail-open) when API is unavailable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));
    const result = await fetchPricingInfo('eastus', 'standardNCSFamily');
    expect(result.skuAvailableInRegion).toBe(true);
    expect(result.pricePerHour).toBeNull();
  });

  it('picks the lowest price when multiple items match', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Items: [
          { armSkuName: 'Standard_NC24ads_A100_v4', skuName: 'Standard NCS Family', retailPrice: 3.67, currencyCode: 'USD' },
          { armSkuName: 'Standard_NC4as_T4_v3', skuName: 'Standard NCS Family', retailPrice: 0.526, currencyCode: 'USD' },
        ],
      }),
    } as Response);

    const result = await fetchPricingInfo('eastus', 'standardNCSFamily');
    expect(result.pricePerHour).toBeCloseTo(0.526);
  });

  it('returns null pricePerHour when API returns non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    const result = await fetchPricingInfo('eastus', 'standardNCSFamily');
    expect(result.pricePerHour).toBeNull();
    expect(result.skuAvailableInRegion).toBe(true); // fail-open
  });
});

// ── Tool invoke tests (fetch-mocked) ──────────────────────────────────────────

const SUB_ID = '00000000-0000-0000-0000-000000000000';
const REGION = 'eastus';
const SKU = 'standardNCSFamily';

function makeRunCtx(token = 'test-token') {
  return { context: { tokens: { azure: token } } };
}

describe('azure.quota_lookup tool invoke', () => {
  const invokeFn = (quotaLookupTool.tool as FunctionTool).invoke as (
    ctx: unknown,
    input: string,
  ) => Promise<unknown>;

  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.restoreAllMocks(); });

  async function invoke(ctx: unknown, input: object): Promise<Record<string, unknown>> {
    const raw = await invokeFn(ctx, JSON.stringify(input));
    return (typeof raw === 'string' ? JSON.parse(raw) : raw) as Record<string, unknown>;
  }

  function mockPricing(price = 0.526) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Items: [{ armSkuName: 'Standard_NC4as_T4_v3', skuName: 'Standard NCS Family', retailPrice: price, currencyCode: 'USD' }] }),
    } as Response);
  }

  it('always populates pricing alongside quota data', async () => {
    mockPricing();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ currentValue: 4, limit: 24, name: { value: SKU, localizedValue: '' } }] }),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });
    expect(result['quotaUnknown']).toBe(false);
    expect(result['pricePerHour']).toBeCloseTo(0.526);
    expect(result['skuAvailableInRegion']).toBe(true);
    expect(result['available']).toBe(20);
    expect(result['limit']).toBe(24);
    expect(result['currentUsage']).toBe(4);
  });

  it('returns 100% utilization when quota is fully consumed', async () => {
    mockPricing();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ currentValue: 48, limit: 48, name: { value: SKU, localizedValue: '' } }] }),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });
    expect(result['available']).toBe(0);
    expect(result['utilizationPercent']).toBe(100);
    expect(result['requestUrl']).toContain('portal.azure.com');
  });

  it('returns null requestUrl when quota is fully unused', async () => {
    mockPricing();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ currentValue: 0, limit: 48, name: { value: SKU, localizedValue: '' } }] }),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });
    expect(result['available']).toBe(48);
    expect(result['requestUrl']).toBeNull();
  });

  it('returns quotaUnknown=true + pricing when no Azure token is present', async () => {
    mockPricing(3.67);
    const result = await invoke({ context: {} }, { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });

    expect(result['quotaUnknown']).toBe(true);
    expect(result['error']).toBeNull();
    expect(result['pricePerHour']).toBeCloseTo(3.67);
    expect(result['skuAvailableInRegion']).toBe(true);
    expect(result['requestUrl']).toContain('portal.azure.com');
  });

  it('quotaUnknown=true + skuAvailableInRegion=false when pricing API finds no match', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Items: [{ armSkuName: 'Standard_D4s_v3', skuName: 'Standard D Series', retailPrice: 0.192 }] }),
    } as Response);

    const result = await invoke({ context: {} }, { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });
    expect(result['quotaUnknown']).toBe(true);
    expect(result['skuAvailableInRegion']).toBe(false);
    expect(result['pricePerHour']).toBeNull();
  });

  it('returns error + pricing when the ARM API returns a non-ok HTTP status', async () => {
    mockPricing();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false, status: 403,
      text: async () => '{"error":{"code":"AuthorizationFailed"}}',
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU, armSkuName: null });
    expect(result['error']).toMatch(/403/);
    expect(result['quotaUnknown']).toBe(false);
    expect(result['pricePerHour']).toBeCloseTo(0.526); // pricing still present even on ARM failure
  });

  it('returns error + pricing when SKU family is not found in quota response', async () => {
    mockPricing();
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ currentValue: 0, limit: 48, name: { value: 'standardNCv3Family', localizedValue: '' } }] }),
    } as Response);

    // armSkuName ensures the pricing lookup finds the SKU even when skuFamily is unknown
    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: 'unknownSkuFamily', armSkuName: 'Standard_NC4as_T4_v3' });
    expect(result['error']).toMatch(/unknownSkuFamily/);
    expect(result['pricePerHour']).toBeCloseTo(0.526);
  });
});
