import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

const RETAIL_PRICES_URL = 'https://prices.azure.com/api/retail/prices';

const PricingLookupInputSchema = z.object({
  serviceFamily: z
    .string()
    .describe('Azure service family, e.g. "Compute", "Storage", "Networking", "Databases"'),
  serviceName: z
    .string()
    .describe('Service name, e.g. "Virtual Machines", "Azure Kubernetes Service", "Azure SQL Database"'),
  skuName: z
    .string()
    .nullable()
    .optional()
    .describe('Optional SKU name filter, e.g. "D2s v3", "Standard_LRS"'),
  armRegionName: z
    .string()
    .nullable()
    .optional()
    .describe('ARM region name, e.g. "eastus", "westeurope". Omit for global pricing.'),
  currencyCode: z
    .string()
    .default('USD')
    .describe('ISO 4217 currency code, e.g. "USD", "EUR". Defaults to USD.'),
});

const PricingItemSchema = z.object({
  skuName: z.string(),
  productName: z.string(),
  meterName: z.string(),
  unitPrice: z.number(),
  unitOfMeasure: z.string(),
  retailPrice: z.number(),
  currencyCode: z.string(),
  armRegionName: z.string().optional(),
  type: z.string().optional(),
});

const PricingLookupOutputSchema = z.object({
  items: z.array(PricingItemSchema),
  count: z.number(),
  currencyCode: z.string(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const pricingLookupTool: ToolContribution = {
  name: 'azure.pricing_lookup',
  tool: tool({
    name: 'azure.pricing_lookup',
    description:
      'Looks up Azure retail prices for a service and optional SKU using the Azure Retail Prices API. ' +
      'Returns unit prices in the requested currency. Does not require authentication.',
    parameters: PricingLookupInputSchema,
    execute: async (input): Promise<z.infer<typeof PricingLookupOutputSchema>> => {
      const filterParts: string[] = [
        `serviceFamily eq '${input.serviceFamily}'`,
        `serviceName eq '${input.serviceName}'`,
      ];
      if (input.skuName) {
        filterParts.push(`contains(skuName, '${input.skuName}')`);
      }
      if (input.armRegionName) {
        filterParts.push(`armRegionName eq '${input.armRegionName}'`);
      }
      // Exclude spot/low-priority prices by default
      filterParts.push(`priceType eq 'Consumption'`);

      const params = new URLSearchParams({
        'api-version': '2023-01-01-preview',
        '$filter': filterParts.join(' and '),
        currencyCode: input.currencyCode ?? 'USD',
        '$top': '20',
      });

      const url = `${RETAIL_PRICES_URL}?${params.toString()}`;
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`Pricing API HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as {
        Items?: unknown[];
        Count?: number;
        currencyCode?: string;
      };

      const items = (data.Items ?? []).slice(0, 20).map((item) =>
        PricingItemSchema.parse(item),
      );

      return {
        items,
        count: items.length,
        currencyCode: input.currencyCode ?? 'USD',
      };
    },
  }),
};
