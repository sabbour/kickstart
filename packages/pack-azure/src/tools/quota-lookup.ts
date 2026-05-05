import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { strictOptional } from '@aks-kickstart/harness/runtime/z-strict';
import { armAuthHeaders, armBaseUrl } from '../services/azure-auth.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUOTA_API_VERSION = '2024-03-01';
const PRICING_API = 'https://prices.azure.com/api/retail/prices';
const PRICING_API_VERSION = '2023-01-01-preview';

// ── Input / Output schemas ────────────────────────────────────────────────────

const QuotaLookupInputSchema = z.object({
  subscriptionId: z
    .string()
    .describe('Azure subscription GUID, e.g. "00000000-0000-0000-0000-000000000000"'),
  region: z
    .string()
    .describe('ARM region name, e.g. "eastus", "westeurope"'),
  skuFamily: z
    .string()
    .describe(
      'SKU family name to filter by, e.g. "standardNCSFamily", "standardNCv3Family". ' +
      'Matched case-insensitively against the usage name.value field.',
    ),
  armSkuName: strictOptional(z.string()).describe(
    'Specific ARM SKU name for the pricing lookup, e.g. "Standard_NC96ads_A100_v4". ' +
    'If omitted, the pricing API is queried by skuFamily pattern instead.',
  ),
});

const QuotaLookupOutputSchema = z.object({
  // ── Pricing (always populated via the public Azure Retail Prices API) ─────
  pricePerHour: strictOptional(z.number()).describe(
    'Pay-as-you-go price per hour in USD for the cheapest matching SKU. ' +
    'Use this for cost estimates in the architecture plan.',
  ),
  currency: strictOptional(z.string()).describe('Currency for pricePerHour (typically "USD").'),
  skuAvailableInRegion: z.boolean().describe(
    'Whether the SKU family is sold in this region per the Azure Retail Prices API. ' +
    'Note: regional availability does NOT mean the user has quota allocated.',
  ),

  // ── Quota (populated only when an ARM token is present) ───────────────────
  quotaUnknown: z.boolean().describe(
    'True when per-subscription quota could not be checked (no ARM token). ' +
    'The agent MUST NOT halt — continue with the plan but warn the user to ' +
    'verify and potentially request GPU quota before deploying.',
  ),
  available: z.number().describe('Available quota units (limit minus current usage). 0 when quotaUnknown.'),
  limit: z.number().describe('Total quota limit for the SKU family. 0 when quotaUnknown.'),
  currentUsage: z.number().describe('Currently consumed quota units. 0 when quotaUnknown.'),
  utilizationPercent: z.number().describe('Percentage of quota consumed (0–100). 0 when quotaUnknown.'),
  requestUrl: strictOptional(z.string()).describe(
    'Azure Portal URL to request a quota increase.',
  ),
  error: strictOptional(z.string()).describe(
    'Error message when the quota lookup could not complete (auth failure, SKU not found, API error). ' +
    'Pricing data may still be present even when this is set.',
  ),
});

// ── Internal interfaces ───────────────────────────────────────────────────────

interface AzureUsage {
  currentValue: number;
  limit: number;
  name: { value: string; localizedValue: string };
}

interface AzureUsagesResponse {
  value?: AzureUsage[];
}

interface PricingItem {
  armSkuName?: string;
  skuName?: string;
  retailPrice?: number;
  currencyCode?: string;
}

interface PricingResponse {
  Items?: PricingItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function buildQuotaRequestUrl(subscriptionId: string, region: string): string {
  const params = new URLSearchParams({
    subscriptionId,
    location: region,
    resourceType: 'Microsoft.Compute/virtualMachines',
  });
  return `https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaRequestBlade?${params.toString()}`;
}

export function findSkuUsage(usages: AzureUsage[], skuFamily: string): AzureUsage | undefined {
  const needle = skuFamily.toLowerCase();
  return usages.find((u) => u.name.value.toLowerCase().includes(needle));
}

/**
 * Calls the public Azure Retail Prices API (no auth required) to get pricing info
 * and confirm that the SKU family is sold in the target region.
 */
export async function fetchPricingInfo(
  region: string,
  skuFamily: string,
  armSkuName?: string | null,
): Promise<{ skuAvailableInRegion: boolean; pricePerHour: number | null; currency: string | null }> {
  try {
    const needle = armSkuName?.toLowerCase()
      ?? skuFamily.toLowerCase().replace(/^standard/, '').replace(/family$/, '').trim();

    const filter = armSkuName
      ? `armRegionName eq '${region}' and armSkuName eq '${armSkuName}' and priceType eq 'Consumption'`
      : `armRegionName eq '${region}' and serviceName eq 'Virtual Machines' and priceType eq 'Consumption'`;

    const url = `${PRICING_API}?api-version=${PRICING_API_VERSION}&$filter=${encodeURIComponent(filter)}&$top=100`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!resp.ok) return { skuAvailableInRegion: true, pricePerHour: null, currency: null };

    const data = (await resp.json()) as PricingResponse;
    const items = (data.Items ?? []).filter(
      (i) =>
        (i.armSkuName ?? '').toLowerCase().includes(needle) ||
        (i.skuName ?? '').toLowerCase().includes(needle),
    );

    if (!items.length) return { skuAvailableInRegion: false, pricePerHour: null, currency: null };

    const sorted = items
      .filter((i) => typeof i.retailPrice === 'number' && i.retailPrice > 0)
      .sort((a, b) => (a.retailPrice ?? Infinity) - (b.retailPrice ?? Infinity));

    const cheapest = sorted[0];
    return {
      skuAvailableInRegion: true,
      pricePerHour: cheapest?.retailPrice ?? null,
      currency: cheapest?.currencyCode ?? null,
    };
  } catch {
    // Fail open — don't let a public API failure block the flow
    return { skuAvailableInRegion: true, pricePerHour: null, currency: null };
  }
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const quotaLookupTool: ToolContribution = {
  name: 'azure.quota_lookup',
  tool: tool({
    name: 'azure.quota_lookup',
    description:
      'Checks Azure Compute GPU quota for a SKU family and region. ' +
      'Always fetches pay-as-you-go pricing from the public Azure Retail Prices API (no auth required) ' +
      'so that pricePerHour is available for cost estimates regardless of auth state. ' +
      'Also checks per-subscription quota via ARM when an ARM token is present; ' +
      'otherwise sets quotaUnknown=true — the agent should continue the plan but warn the user ' +
      'to verify and request GPU quota before deploying.',
    parameters: QuotaLookupInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof QuotaLookupOutputSchema>> => {
      // Always fetch public pricing first (no auth)
      const pricing = await fetchPricingInfo(input.region, input.skuFamily, input.armSkuName);

      const session = runCtx?.context as SessionCtx | undefined;
      const tokens = (session as unknown as { tokens?: Record<string, string> })?.tokens;
      const token = tokens?.['azure'] ?? tokens?.['azure-token'];

      // ── No ARM token: pricing-only path ──────────────────────────────────
      if (!token) {
        return {
          ...pricing,
          quotaUnknown: true,
          available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0,
          requestUrl: buildQuotaRequestUrl(input.subscriptionId, input.region),
          error: null,
        };
      }

      // ── ARM token present: full quota check ───────────────────────────────
      try {
        const url =
          `${armBaseUrl()}/subscriptions/${encodeURIComponent(input.subscriptionId)}` +
          `/providers/Microsoft.Compute/locations/${encodeURIComponent(input.region)}` +
          `/usages?api-version=${QUOTA_API_VERSION}`;

        const response = await fetch(url, {
          headers: armAuthHeaders(token),
          signal: AbortSignal.timeout(30_000),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          return {
            ...pricing,
            quotaUnknown: false,
            error: `ARM Compute usages HTTP ${response.status} for ${input.region}: ${body.slice(0, 500)}`,
            available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
          };
        }

        const data = (await response.json()) as AzureUsagesResponse;
        const usages = data.value ?? [];
        const match = findSkuUsage(usages, input.skuFamily);

        if (!match) {
          return {
            ...pricing,
            quotaUnknown: false,
            error:
              `SKU family "${input.skuFamily}" not found in ${input.region}. ` +
              `Available families: ${usages.map((u) => u.name.value).join(', ') || '(none)'}`,
            available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
          };
        }

        const currentUsage = match.currentValue;
        const limit = match.limit;
        const available = limit - currentUsage;
        const utilizationPercent = limit > 0 ? Math.round((currentUsage / limit) * 10000) / 100 : 0;
        const requestUrl = available < limit ? buildQuotaRequestUrl(input.subscriptionId, input.region) : null;

        return {
          ...pricing,
          quotaUnknown: false,
          available, limit, currentUsage, utilizationPercent, requestUrl, error: null,
        };
      } catch (err) {
        return {
          ...pricing,
          quotaUnknown: false,
          error: (err as Error).message,
          available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
        };
      }
    },
  }),
};
