import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { strictOptional } from '@aks-kickstart/harness/runtime/z-strict';
import { getAzureToken, armAuthHeaders, armBaseUrl } from '../services/azure-auth.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const QUOTA_API_VERSION = '2024-03-01';

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
});

const QuotaLookupOutputSchema = z.object({
  available: z.number().describe('Available quota units (limit minus current usage)'),
  limit: z.number().describe('Total quota limit for the SKU family'),
  currentUsage: z.number().describe('Currently consumed quota units'),
  utilizationPercent: z.number().describe('Percentage of quota consumed (0–100)'),
  requestUrl: strictOptional(z.string()).describe(
    'Azure Portal URL to request a quota increase; present only when available < limit',
  ),
  error: strictOptional(z.string()).describe(
    'Error message when the lookup could not complete (auth failure, SKU not found, API error)',
  ),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AzureUsage {
  currentValue: number;
  limit: number;
  name: {
    value: string;
    localizedValue: string;
  };
}

interface AzureUsagesResponse {
  value?: AzureUsage[];
}

/**
 * Builds the Azure Portal quota-increase blade URL for the given subscription/region.
 */
export function buildQuotaRequestUrl(subscriptionId: string, region: string): string {
  const params = new URLSearchParams({
    subscriptionId,
    location: region,
    resourceType: 'Microsoft.Compute/virtualMachines',
  });
  return `https://portal.azure.com/#blade/Microsoft_Azure_Capacity/QuotaRequestBlade?${params.toString()}`;
}

/**
 * Finds the first usage entry whose name.value contains skuFamily (case-insensitive).
 */
export function findSkuUsage(usages: AzureUsage[], skuFamily: string): AzureUsage | undefined {
  const needle = skuFamily.toLowerCase();
  return usages.find((u) => u.name.value.toLowerCase().includes(needle));
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const quotaLookupTool: ToolContribution = {
  name: 'azure.quota_lookup',
  tool: tool({
    name: 'azure.quota_lookup',
    description:
      'Looks up Azure Compute quota for a given SKU family in a subscription and region. ' +
      'Returns available units, the total limit, current usage, and utilization percentage. ' +
      'Useful for pre-flight checks before recommending GPU or compute-intensive deployments.',
    parameters: QuotaLookupInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof QuotaLookupOutputSchema>> => {
      try {
        const session = runCtx?.context as SessionCtx | undefined;
        const token = getAzureToken(session);

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
            error:
              `ARM Compute usages HTTP ${response.status} for ` +
              `${input.region}: ${body.slice(0, 500)}`,
            available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
          };
        }

        const data = (await response.json()) as AzureUsagesResponse;
        const usages = data.value ?? [];

        const match = findSkuUsage(usages, input.skuFamily);
        if (!match) {
          return {
            error:
              `SKU family "${input.skuFamily}" not found in ${input.region}. ` +
              `Available families: ${usages.map((u) => u.name.value).join(', ') || '(none)'}`,
            available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
          };
        }

        const currentUsage = match.currentValue;
        const limit = match.limit;
        const available = limit - currentUsage;
        const utilizationPercent =
          limit > 0 ? Math.round((currentUsage / limit) * 10000) / 100 : 0;

        const requestUrl =
          available < limit
            ? buildQuotaRequestUrl(input.subscriptionId, input.region)
            : null;

        return { available, limit, currentUsage, utilizationPercent, requestUrl, error: null };
      } catch (err) {
        return {
          error: (err as Error).message,
          available: 0, limit: 0, currentUsage: 0, utilizationPercent: 0, requestUrl: null,
        };
      }
    },
  }),
};
