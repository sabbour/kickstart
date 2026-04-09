/**
 * @module @kickstart/core/tools/generate-kubernetes-manifest
 *
 * Generate Kubernetes manifests for an app configuration.
 * Delegates to the existing generateKubernetesManifests generator.
 */

import type { Tool } from "../types.js";
import { generateKubernetesManifests } from "../generators/index.js";
import type { AppDefinition, AzureContext } from "../types.js";

interface GenerateKubernetesManifestArgs {
  appName: string;
  runtime: string;
  port: number;
  resourceTier?: "dev" | "standard" | "production";
  needsDatabase?: boolean;
  databaseType?: string;
  needsIngress?: boolean;
  customDomain?: string;
  envVars?: string[];
  subscriptionId?: string;
  resourceGroup?: string;
  region?: string;
  clusterName?: string;
}

export const generateKubernetesManifest: Tool<GenerateKubernetesManifestArgs> = {
  name: "generate_kubernetes_manifest",
  description:
    "Generate Kubernetes YAML manifests (Deployment, Service, optional Ingress) for deploying an application to AKS. Returns ready-to-apply YAML files.",
  parameters: {
    type: "object",
    properties: {
      appName: {
        type: "string",
        description: "Application name (used as Kubernetes resource names)",
      },
      runtime: {
        type: "string",
        enum: ["node", "python", "dotnet", "java", "go", "rust", "static"],
        description: "Application runtime/language",
      },
      port: {
        type: "number",
        description: "Port the application listens on",
      },
      resourceTier: {
        type: "string",
        enum: ["dev", "standard", "production"],
        description: "Resource tier — controls replica count and CPU/memory limits. Defaults to 'dev'.",
      },
      needsDatabase: {
        type: "boolean",
        description: "Whether the app requires a database",
      },
      databaseType: {
        type: "string",
        enum: ["postgres", "mysql", "mongodb", "redis", "cosmosdb"],
        description: "Database type if needsDatabase is true",
      },
      needsIngress: {
        type: "boolean",
        description: "Whether to generate an Ingress resource for public HTTP access",
      },
      customDomain: {
        type: "string",
        description: "Custom domain for the Ingress host rule (e.g. myapp.example.com)",
      },
      envVars: {
        type: "array",
        items: { type: "string" },
        description: "Environment variable names the app requires (values left blank in output)",
      },
      subscriptionId: {
        type: "string",
        description: "Azure subscription ID",
      },
      resourceGroup: {
        type: "string",
        description: "Azure resource group name",
      },
      region: {
        type: "string",
        description: "Azure region (e.g. eastus)",
      },
      clusterName: {
        type: "string",
        description: "AKS cluster name",
      },
    },
    required: ["appName", "runtime", "port"],
  },

  async execute(args: GenerateKubernetesManifestArgs): Promise<unknown> {
    // Coerce appName to string — prevents TypeError if LLM passes a number
    const safeAppName = typeof args.appName === "string" ? args.appName : String(args.appName ?? "app");

    const app: AppDefinition = {
      name: safeAppName,
      description: `${args.appName} application`,
      runtime: (args.runtime as AppDefinition["runtime"]) ?? "node",
      port: args.port,
      needsDatabase: args.needsDatabase ?? false,
      databaseType: args.databaseType as AppDefinition["databaseType"],
      needsIngress: args.needsIngress ?? false,
      customDomain: args.customDomain,
      envVars: args.envVars ?? [],
      resourceTier: args.resourceTier ?? "dev",
    };

    const azure: AzureContext = {
      subscriptionId: args.subscriptionId ?? "00000000-0000-0000-0000-000000000000",
      resourceGroup: args.resourceGroup ?? "my-resource-group",
      region: args.region ?? "eastus",
      clusterName: args.clusterName,
      tenantId: "00000000-0000-0000-0000-000000000000",
    };

    const output = generateKubernetesManifests({ app, azure });

    return {
      generator: output.generator,
      summary: output.summary,
      files: output.files.map((f) => ({
        path: f.path,
        language: f.language,
        content: f.content,
      })),
    };
  },
};
