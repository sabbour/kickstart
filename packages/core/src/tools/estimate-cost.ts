/**
 * @module @kickstart/core/tools/estimate-cost
 *
 * Estimate monthly Azure cost for an AKS deployment configuration.
 * Queries the Azure Retail Prices API via PricingConnector for live pricing,
 * falling back to stubs when the API is unreachable.
 */

import type { Tool, ToolContext } from "../types.js";
import { defaultConnectorRegistry } from "../connectors/index.js";
import type { PricingConnector, VmPriceResult } from "../connectors/PricingConnector.js";

interface EstimateCostArgs {
  region: string;
  nodeCount: number;
  vmSize: string;
  resourceTier?: "dev" | "standard" | "production";
  needsDatabase?: boolean;
  databaseType?: string;
  needsIngress?: boolean;
}

interface CostLineItem {
  description: string;
  monthlyCost: number;
  payAsYouGo?: number;
  reserved1Year?: number;
  reserved3Years?: number;
}

/** VM size → approximate hourly USD cost (stub pricing table — fallback only) */
const VM_HOURLY_COST: Record<string, number> = {
  Standard_B2s: 0.048,
  Standard_B4ms: 0.192,
  Standard_D2s_v3: 0.096,
  Standard_D4s_v3: 0.192,
  Standard_D8s_v3: 0.384,
  Standard_D2as_v5: 0.096,
  Standard_D4as_v5: 0.192,
};

const DATABASE_MONTHLY_COST: Record<string, number> = {
  postgres: 50,
  mysql: 50,
  mongodb: 60,
  redis: 30,
  cosmosdb: 25,
};

const HOURS_PER_MONTH = 730;

export const estimateCost: Tool<EstimateCostArgs> = {
  name: "estimate_cost",
  description:
    "Estimate the monthly Azure cost for an AKS cluster configuration. Returns a cost breakdown by service (compute, networking, storage, database) using live Azure pricing when available. Use this to give users a budget estimate before deployment.",
  parameters: {
    type: "object",
    properties: {
      region: {
        type: "string",
        description: "Azure region for pricing (e.g. eastus, westeurope)",
      },
      nodeCount: {
        type: "number",
        description: "Number of AKS agent nodes",
      },
      vmSize: {
        type: "string",
        description: "VM size for agent nodes, e.g. Standard_D4s_v3",
      },
      resourceTier: {
        type: "string",
        enum: ["dev", "standard", "production"],
        description: "Resource tier — affects default node count and addons",
      },
      needsDatabase: {
        type: "boolean",
        description: "Whether a managed database service is included",
      },
      databaseType: {
        type: "string",
        enum: ["postgres", "mysql", "mongodb", "redis", "cosmosdb"],
        description: "Database type for cost estimation",
      },
      needsIngress: {
        type: "boolean",
        description: "Whether a public load balancer / ingress is included",
      },
    },
    required: ["region", "nodeCount", "vmSize"],
  },

  async execute(args: EstimateCostArgs, _context: ToolContext): Promise<unknown> {
    const pricing = defaultConnectorRegistry.get("pricing") as PricingConnector | undefined;

    // Attempt live VM pricing
    let vmPrice: VmPriceResult | null = null;
    let source: "live" | "stub" = "stub";

    if (pricing) {
      try {
        vmPrice = await pricing.lookupVmPrice(args.vmSize, args.region);
        if (vmPrice) source = "live";
      } catch {
        // Fall through to stub
      }
    }

    const hourlyVm = vmPrice?.payAsYouGo ?? VM_HOURLY_COST[args.vmSize] ?? 0.192;
    const monthlyCompute = hourlyVm * args.nodeCount * HOURS_PER_MONTH;
    const monthlyLb = args.needsIngress ? 18.25 : 0;
    const monthlyDatabase = args.needsDatabase && args.databaseType
      ? (DATABASE_MONTHLY_COST[args.databaseType] ?? 50)
      : 0;
    const monthlyStorage = args.nodeCount * 5;
    const monthlyTotal = monthlyCompute + monthlyLb + monthlyDatabase + monthlyStorage;

    // Build compute line item with pricing tiers
    const compute: CostLineItem = {
      description: `${args.nodeCount}x ${args.vmSize} nodes`,
      monthlyCost: Math.round(monthlyCompute * 100) / 100,
    };
    if (vmPrice) {
      compute.payAsYouGo = Math.round(monthlyCompute * 100) / 100;
      if (vmPrice.reserved1Year != null) {
        compute.reserved1Year = Math.round(
          vmPrice.reserved1Year * args.nodeCount * HOURS_PER_MONTH * 100,
        ) / 100;
      }
      if (vmPrice.reserved3Years != null) {
        compute.reserved3Years = Math.round(
          vmPrice.reserved3Years * args.nodeCount * HOURS_PER_MONTH * 100,
        ) / 100;
      }
    }

    return {
      region: args.region,
      currency: "USD",
      source,
      breakdown: {
        compute,
        networking: {
          description: args.needsIngress ? "Standard Load Balancer" : "No public LB",
          monthlyCost: monthlyLb,
        },
        storage: {
          description: `OS disk storage (${args.nodeCount} nodes)`,
          monthlyCost: monthlyStorage,
        },
        database: {
          description: args.needsDatabase
            ? `${args.databaseType ?? "database"} managed service`
            : "No database",
          monthlyCost: monthlyDatabase,
        },
      },
      estimatedMonthlyTotal: Math.round(monthlyTotal * 100) / 100,
    };
  },
};
