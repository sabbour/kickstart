import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

const ResourceLineItemSchema = z.object({
  name: z.string().describe('Human-readable resource name, e.g. "AKS node pool (3× D4s v3)"'),
  serviceFamily: z.string().describe('Azure service family, e.g. "Compute"'),
  serviceName: z.string().describe('Azure service name, e.g. "Azure Kubernetes Service"'),
  skuName: z.string().describe('SKU name, e.g. "D4s v3"'),
  quantity: z.number().positive().describe('Number of units per month'),
  unitOfMeasure: z.string().describe('Unit, e.g. "1 Hour", "1 GB/Month"'),
  unitPrice: z.number().nonnegative().describe('Price per unit in USD'),
});

const EstimateCostInputSchema = z.object({
  resources: z
    .array(ResourceLineItemSchema)
    .min(1)
    .describe('List of resource line items to include in the estimate'),
  currencyCode: z.string().default('USD').describe('ISO 4217 currency code'),
  region: z.string().nullable().describe('Azure region for context, e.g. "eastus"; pass null if unknown'),
});

const EstimateCostOutputSchema = z.object({
  totalMonthlyUSD: z.number(),
  breakdown: z.array(
    z.object({
      name: z.string(),
      monthlyUSD: z.number(),
      unitPrice: z.number(),
      quantity: z.number(),
      unitOfMeasure: z.string(),
    }),
  ),
  currencyCode: z.string(),
  region: z.string().optional(),
  disclaimer: z.string(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const estimateCostTool: ToolContribution = {
  name: 'azure.estimate_cost',
  tool: tool({
    name: 'azure.estimate_cost',
    description:
      'Estimates the monthly Azure cost for a list of resource line items. ' +
      'Each item specifies a service, SKU, quantity, and unit price. ' +
      'Returns a total and per-resource breakdown. Does not require authentication.',
    parameters: EstimateCostInputSchema,
    execute: async (input): Promise<z.infer<typeof EstimateCostOutputSchema>> => {
      const breakdown = input.resources.map((r) => ({
        name: r.name,
        monthlyUSD: +(r.unitPrice * r.quantity).toFixed(4),
        unitPrice: r.unitPrice,
        quantity: r.quantity,
        unitOfMeasure: r.unitOfMeasure,
      }));

      const totalMonthlyUSD = +breakdown
        .reduce((sum, item) => sum + item.monthlyUSD, 0)
        .toFixed(2);

      return {
        totalMonthlyUSD,
        breakdown,
        currencyCode: input.currencyCode ?? 'USD',
        region: input.region ?? undefined,
        disclaimer:
          'Estimates are based on retail list prices and do not reflect reserved instance discounts, ' +
          'EA/MCA negotiated rates, or actual usage patterns. Actual costs may differ.',
      };
    },
  }),
};
