import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { findSkuUsage, buildQuotaRequestUrl, quotaLookupTool } from './quota-lookup.js';
import type { FunctionTool } from '@openai/agents';

// ── Helper unit tests ─────────────────────────────────────────────────────────

const SAMPLE_USAGES = [
  { currentValue: 4, limit: 24, name: { value: 'standardNCSFamily', localizedValue: 'Standard NCS Family' } },
  { currentValue: 0, limit: 48, name: { value: 'standardNCv3Family', localizedValue: 'Standard NCv3 Family' } },
  { currentValue: 48, limit: 48, name: { value: 'standardNCSv3Family', localizedValue: 'Standard NCSv3 Family' } },
];

describe('findSkuUsage', () => {
  it('finds an exact (case-insensitive) match', () => {
    const result = findSkuUsage(SAMPLE_USAGES, 'standardNCSFamily');
    expect(result?.name.value).toBe('standardNCSFamily');
  });

  it('matches case-insensitively', () => {
    const result = findSkuUsage(SAMPLE_USAGES, 'STANDARDNCSV3FAMILY');
    expect(result?.name.value).toBe('standardNCSv3Family');
  });

  it('returns undefined for an unknown SKU family', () => {
    const result = findSkuUsage(SAMPLE_USAGES, 'standardND96amsr_A100_v4Family');
    expect(result).toBeUndefined();
  });

  it('returns the first matching entry when multiple entries match the substring', () => {
    const result = findSkuUsage(SAMPLE_USAGES, 'standardNCS');
    // 'standardNCSFamily' appears first and contains the needle
    expect(result?.name.value).toBe('standardNCSFamily');
  });

  it('returns undefined for an empty usages array', () => {
    expect(findSkuUsage([], 'standardNCSFamily')).toBeUndefined();
  });
});

describe('buildQuotaRequestUrl', () => {
  it('contains the subscription ID', () => {
    const url = buildQuotaRequestUrl('00000000-0000-0000-0000-000000000000', 'eastus');
    expect(url).toContain('00000000-0000-0000-0000-000000000000');
  });

  it('contains the region', () => {
    const url = buildQuotaRequestUrl('sub-id', 'westeurope');
    expect(url).toContain('westeurope');
  });

  it('points to the Azure Portal quota blade', () => {
    const url = buildQuotaRequestUrl('sub-id', 'eastus');
    expect(url).toContain('portal.azure.com');
    expect(url).toContain('QuotaRequestBlade');
  });

  it('encodes resourceType as Microsoft.Compute/virtualMachines', () => {
    const url = buildQuotaRequestUrl('sub-id', 'eastus');
    expect(url).toContain('Microsoft.Compute');
  });
});

// ── Tool invoke tests (fetch-mocked) ──────────────────────────────────────────

const SUB_ID = '00000000-0000-0000-0000-000000000000';
const REGION = 'eastus';
const SKU = 'standardNCSFamily';

function makeRunCtx(token = 'test-token') {
  return { context: { tokens: { azure: token } } };
}

function makeUsagesResponse(usages: unknown[]) {
  return { value: usages };
}

describe('azure.quota_lookup tool invoke', () => {
  const invokeFn = (quotaLookupTool.tool as FunctionTool).invoke as (
    ctx: unknown,
    input: string,
  ) => Promise<unknown>;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function invoke(ctx: unknown, input: object): Promise<Record<string, unknown>> {
    const raw = await invokeFn(ctx, JSON.stringify(input));
    return raw as Record<string, unknown>;
  }

  it('returns correct available/limit/utilization for partial usage', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeUsagesResponse([
          { currentValue: 4, limit: 24, name: { value: SKU, localizedValue: 'Standard NCS Family' } },
        ]),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU });

    expect(result['error']).toBeNull();
    expect(result['available']).toBe(20);
    expect(result['limit']).toBe(24);
    expect(result['currentUsage']).toBe(4);
    expect((result['utilizationPercent'] as number)).toBeCloseTo(16.67, 1);
    expect(result['requestUrl']).toContain('portal.azure.com');
  });

  it('returns zero available and 100% utilization when quota is fully consumed', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeUsagesResponse([
          { currentValue: 48, limit: 48, name: { value: SKU, localizedValue: 'Standard NCS Family' } },
        ]),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU });

    expect(result['error']).toBeNull();
    expect(result['available']).toBe(0);
    expect(result['utilizationPercent']).toBe(100);
    expect(result['requestUrl']).toBeDefined();
  });

  it('returns null requestUrl when quota is fully unused (available === limit)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeUsagesResponse([
          { currentValue: 0, limit: 48, name: { value: SKU, localizedValue: 'Standard NCS Family' } },
        ]),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU });

    expect(result['error']).toBeNull();
    expect(result['available']).toBe(48);
    expect(result['utilizationPercent']).toBe(0);
    expect(result['requestUrl']).toBeNull();
  });

  it('returns { error } when SKU family is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeUsagesResponse([
          { currentValue: 0, limit: 48, name: { value: 'standardNCv3Family', localizedValue: 'Standard NCv3 Family' } },
        ]),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: 'unknownSkuFamily' });

    expect(result['error']).toMatch(/unknownSkuFamily/);
    expect(result['available']).toBe(0);
  });

  it('error field lists available families when SKU is not found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () =>
        makeUsagesResponse([
          { currentValue: 0, limit: 48, name: { value: 'standardNCv3Family', localizedValue: '' } },
        ]),
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: 'nope' });

    expect(result['error']).toMatch(/standardNCv3Family/);
  });

  it('returns { error } when the ARM API returns a non-ok HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => '{"error":{"code":"AuthorizationFailed"}}',
    } as Response);

    const result = await invoke(makeRunCtx(), { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU });

    expect(result['error']).toMatch(/403/);
    expect(result['available']).toBe(0);
  });

  it('returns { error } when no Azure token is present in the session', async () => {
    const result = await invoke({ context: {} }, { subscriptionId: SUB_ID, region: REGION, skuFamily: SKU });

    expect(result['error']).toMatch(/No Azure access token/);
    expect(result['available']).toBe(0);
  });
});

