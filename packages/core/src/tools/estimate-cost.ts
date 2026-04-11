/**
 * @module @kickstart/core/tools/estimate-cost
 *
 * Estimate monthly Azure cost for an AKS deployment configuration.
 * Stub implementation — real pricing calls wired by APIConnector (B-11).
 */

import type { Tool, ToolContext } from "../types.js";

interface EstimateCostArgs {
  region: string;
  nodeCount: number;
  vmSize: string;
  resourceTier?: "dev" | "standard" | "production";
  needsDatabase?: boolean;
  databaseType?: string;
  needsIngress?: boolean;
}

/** VM size → approximate hourly USD cost (stub pricing table) */
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

export const estimateCost: Tool<EstimateCostArgs> = {
  name: "estimate_cost",
  description:
    "Estimate the monthly Azure cost for an AKS cluster configuration. Returns a cost breakdown by service (compute, networking, storage, database). Use this to give users a budget estimate before deployment.",
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
    // Stub — APIConnector (B-11) will replace with real Azure Pricing API calls
    const hourlyVm = VM_HOURLY_COST[args.vmSize] ?? 0.192;
    const monthlyCompute = hourlyVm * args.nodeCount * 730; // 730h/month
    const monthlyLb = args.needsIngress ? 18.25 : 0; // standard LB
    const monthlyDatabase = args.needsDatabase && args.databaseType
      ? (DATABASE_MONTHLY_COST[args.databaseType] ?? 50)
      : 0;
    const monthlyStorage = args.nodeCount * 5; // ~5 USD per node for OS disk
    const monthlyTotal = monthlyCompute + monthlyLb + monthlyDatabase + monthlyStorage;

    return {
      region: args.region,
      currency: "USD",
      breakdown: {
        compute: {
          description: `${args.nodeCount}x ${args.vmSize} nodes`,
          monthlyCost: Math.round(monthlyCompute * 100) / 100,
        },
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
      _stub: true,
    };
  },
};
