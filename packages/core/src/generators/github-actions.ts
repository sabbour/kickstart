/**
 * @module @kickstart/core/generators/github-actions
 *
 * Generates GitHub Actions CI/CD workflows for building and deploying
 * the app to AKS.
 */

import type { GeneratorInput, GeneratorOutput } from "./types.js";

/**
 * Generate a GitHub Actions workflow for building and deploying to AKS.
 *
 * @param input - Application, Azure, and GitHub context
 * @returns Generated workflow files
 *
 * @remarks
 * Phase 1 stub — generates a basic build-and-deploy workflow.
 * Future: matrix builds, staging environments, approval gates.
 */
export function generateGitHubActionsWorkflow(
  input: GeneratorInput,
): GeneratorOutput {
  const { app, azure, github } = input;
  const imageName = app.name.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const acrName = `${azure.resourceGroup.replace(/[^a-zA-Z0-9]/g, "")}acr`;

  const workflow = `name: Build and Deploy to AKS

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

env:
  ACR_NAME: ${acrName}
  IMAGE_NAME: ${imageName}
  AKS_CLUSTER: ${azure.clusterName || "aks-cluster"}
  RESOURCE_GROUP: ${azure.resourceGroup}
  NAMESPACE: ${imageName}

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${azure.subscriptionId}

      - name: Build and push to ACR
        run: |
          az acr build \\
            --registry \${{ env.ACR_NAME }} \\
            --image \${{ env.IMAGE_NAME }}:\${{ github.sha }} \\
            .

      - name: Set AKS context
        uses: azure/aks-set-context@v4
        with:
          resource-group: \${{ env.RESOURCE_GROUP }}
          cluster-name: \${{ env.AKS_CLUSTER }}

      - name: Deploy to AKS
        run: |
          kubectl set image deployment/\${{ env.IMAGE_NAME }} \\
            \${{ env.IMAGE_NAME }}=\${{ env.ACR_NAME }}.azurecr.io/\${{ env.IMAGE_NAME }}:\${{ github.sha }} \\
            -n \${{ env.NAMESPACE }}
`;

  return {
    generator: "github-actions",
    files: [
      {
        path: ".github/workflows/deploy-aks.yaml",
        content: workflow,
        language: "yaml",
      },
    ],
    summary: `Generated GitHub Actions workflow for ${app.name} → ACR → AKS (${github?.repoUrl || "repo TBD"})`,
  };
}
