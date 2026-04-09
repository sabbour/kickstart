/**
 * @module @kickstart/core/tools/azure-resource-get
 *
 * Get details of a specific Azure resource by resource ID.
 * Stub implementation — real calls wired by APIConnector (B-11).
 */

import type { Tool } from "../types.js";

interface AzureResourceGetArgs {
  resourceId: string;
  apiVersion?: string;
}

export const azureResourceGet: Tool<AzureResourceGetArgs> = {
  name: "azure_resource_get",
  description:
    "Get detailed properties of a specific Azure resource by its full resource ID. Use this to inspect cluster configuration, SKU, network settings, or any resource-specific details.",
  parameters: {
    type: "object",
    properties: {
      resourceId: {
        type: "string",
        description:
          "Full Azure resource ID, e.g. /subscriptions/{subId}/resourceGroups/{rg}/providers/Microsoft.ContainerService/managedClusters/{name}",
      },
      apiVersion: {
        type: "string",
        description: "ARM API version to use. Defaults to a sensible latest version for the resource type.",
      },
    },
    required: ["resourceId"],
  },

  async execute(args: AzureResourceGetArgs): Promise<unknown> {
    // Stub — APIConnector (B-11) will replace with real ARM calls
    const parts = args.resourceId.split("/");
    const resourceName = parts[parts.length - 1] ?? "unknown";
    const resourceType = parts.length >= 9 ? `${parts[6]}/${parts[7]}` : "Unknown/Resource";

    return {
      id: args.resourceId,
      name: resourceName,
      type: resourceType,
      location: "eastus",
      properties: {
        provisioningState: "Succeeded",
        kubernetesVersion: "1.31.0",
        agentPoolProfiles: [
          {
            name: "agentpool",
            count: 3,
            vmSize: "Standard_D4s_v3",
            osType: "Linux",
          },
        ],
      },
      _stub: true,
    };
  },
};
