/**
 * @module @kickstart/core/tools/azure-resource-list
 *
 * List Azure resources in a subscription or resource group.
 * Stub implementation — real calls wired by APIConnector (B-11).
 */

import type { Tool } from "../types.js";

interface AzureResourceListArgs {
  subscriptionId: string;
  resourceGroup?: string;
  resourceType?: string;
}

export const azureResourceList: Tool<AzureResourceListArgs> = {
  name: "azure_resource_list",
  description:
    "List Azure resources in a subscription or resource group. Use this to discover what resources already exist before recommending new deployments.",
  parameters: {
    type: "object",
    properties: {
      subscriptionId: {
        type: "string",
        description: "Azure subscription ID (GUID format)",
      },
      resourceGroup: {
        type: "string",
        description: "Optional resource group name. If omitted, lists all resources in the subscription.",
      },
      resourceType: {
        type: "string",
        description: "Optional resource type filter, e.g. 'Microsoft.ContainerService/managedClusters'",
      },
    },
    required: ["subscriptionId"],
  },

  async execute(args: AzureResourceListArgs): Promise<unknown> {
    // Stub — APIConnector (B-11) will replace with real ARM calls
    return {
      subscriptionId: args.subscriptionId,
      resourceGroup: args.resourceGroup ?? null,
      resources: [
        {
          id: `/subscriptions/${args.subscriptionId}/resourceGroups/sample-rg/providers/Microsoft.ContainerService/managedClusters/sample-aks`,
          name: "sample-aks",
          type: "Microsoft.ContainerService/managedClusters",
          location: "eastus",
          tags: { environment: "dev" },
        },
        {
          id: `/subscriptions/${args.subscriptionId}/resourceGroups/sample-rg/providers/Microsoft.ContainerRegistry/registries/sampleacr`,
          name: "sampleacr",
          type: "Microsoft.ContainerRegistry/registries",
          location: "eastus",
          tags: {},
        },
      ],
      _stub: true,
    };
  },
};
