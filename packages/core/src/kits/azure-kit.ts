/**
 * @module @kickstart/core/kits/azure-kit
 *
 * AzureKit — bundles Azure-specific tools, connectors, and system-prompt
 * augmentations into a single registerable unit.
 *
 * Provided tools:
 *   - azure_resource_list  (discover existing resources before recommending)
 *   - azure_resource_get   (inspect a specific resource's configuration)
 *   - estimate_cost        (budget estimation before deployment)
 *
 * Provided connectors:
 *   - AzureARMConnector    (Azure Resource Manager REST API)
 *   - PricingConnector     (Azure Retail Pricing API, no auth required)
 *
 * Component registrations (rendered by packages/web):
 *   - azureLoginCard       (MSAL sign-in card with subscription auto-select)
 *   - azureResourcePicker  (cascading subscription → RG → resource selector)
 *   - azureResourceForm    (dynamic ARM-driven form for resource creation)
 *   - azureAction          (write-with-confirm pattern for ARM operations)
 */

import type { IntegrationKit } from './types.js';
import type { KitAuthRequirement } from './types.js';
import { Phase } from '../engine/types.js';
import { azureResourceList } from '../tools/azure-resource-list.js';
import { azureResourceGet } from '../tools/azure-resource-get.js';
import { estimateCost } from '../tools/estimate-cost.js';
import { AzureARMConnector } from '../connectors/AzureARMConnector.js';
import { PricingConnector } from '../connectors/PricingConnector.js';

const azureAuth: KitAuthRequirement[] = [
  {
    provider: 'azure-msal',
    scopes: ['https://management.azure.com/.default'],
    optional: false,
  },
];

export const azureKit: IntegrationKit = {
  name: 'azure',
  description:
    'Azure integration kit — ARM resource discovery, cost estimation, and AKS deployment guidance.',

  tools: [
    azureResourceList,
    azureResourceGet,
    estimateCost,
  ],

  connectors: [
    new AzureARMConnector(),
    new PricingConnector(),
  ],

  prompts: [
    // AKS Automatic domain knowledge (general — all phases)
    'When recommending AKS deployments, always prefer AKS Automatic (aksAutomatic) over manual cluster configuration. ' +
    'AKS Automatic manages node provisioning, scaling, and upgrades without user intervention.',

    // Resource discovery guidance
    'Before recommending new Azure resources, use azure_resource_list to discover what already exists in the ' +
    'target subscription. Re-use existing AKS clusters and ACR registries whenever appropriate.',

    // Cost transparency
    'When the user asks about cost or before proposing a deployment plan, use estimate_cost to provide a ' +
    'monthly budget estimate. Always surface the cost breakdown (compute, networking, storage, database).',

    // Deployment safeguards
    'Never expose Kubernetes YAML or kubectl commands directly to the user. Translate all infrastructure ' +
    'operations into plain-language deployment steps. K8s complexity is hidden behind AKS Automatic.',

    // KAITO (Kubernetes AI Toolchain Operator)
    'When the user wants to run AI/ML workloads (open-source LLMs, inference, fine-tuning), recommend the ' +
    'KAITO add-on for AKS. KAITO automates GPU node provisioning, downloads model images from the KAITO model ' +
    'registry, and deploys inference endpoints — users only write a Workspace CRD specifying the model name ' +
    '(e.g. falcon-7b, llama-2-13b, mistral-7b, phi-3). KAITO supports preset models and custom model imports.',

    // RAGEngine
    'For retrieval-augmented generation (RAG) scenarios, recommend RAGEngine — an AKS add-on that pairs with KAITO. ' +
    'RAGEngine manages the end-to-end RAG pipeline: document ingestion, embedding generation, vector store indexing ' +
    '(Azure AI Search or in-cluster FAISS), and query-time retrieval + LLM completion. Users define a RAGEngine CRD ' +
    'referencing their KAITO Workspace and a document source (Azure Blob, Git repo, or inline).',

    // Fine-tuning
    'KAITO supports fine-tuning open-source models on AKS GPU nodes. Users specify a Workspace CRD with ' +
    'tuning.method (LoRA or QLoRA), a training dataset (Azure Blob or HuggingFace), and hyperparameters. ' +
    'KAITO handles checkpoint management, GPU scheduling, and model export. Fine-tuned models can be served ' +
    'immediately as a KAITO inference Workspace or pushed to ACR as a custom model image.',
  ],

  phasePrompts: {
    [Phase.Discover]: [
      'Call azure_resource_list early if the user mentions they have an Azure subscription. ' +
      'This lets you discover existing AKS clusters and ACR registries so you can re-use them rather than recommending new ones. ' +
      'Never ask "do you have existing Azure resources?" — just check.',
    ],

    [Phase.Design]: [
      'Prefer AKS Automatic (sku: Automatic, tier: Standard) for all new deployments. ' +
      'Recommend managed Azure services: Azure Database for PostgreSQL, Azure Cache for Redis, Azure Service Bus, Azure AI Search. ' +
      'Use azure_resource_list to discover existing resources before proposing new ones. ' +
      'Present the architecture with ArchitectureDiagram + CostEstimate using estimate_cost tool output.',
      'For AI/ML workloads: recommend KAITO add-on for model inference (GPU node provisioning is automatic), ' +
      'RAGEngine for RAG pipelines, and KAITO fine-tuning for custom model training. ' +
      'Include GPU node pool costs in the estimate_cost breakdown when KAITO is part of the architecture.',
    ],

    [Phase.Generate]: [
      'Generate AKS Automatic-compatible deployment files. Required elements for every app:\n' +
      '  • Gateway API: GatewayClass "approuting-istio", Gateway + HTTPRoute (never legacy Ingress)\n' +
      '  • Workload Identity: User-Assigned Managed Identity + Federated Credential (never connection strings)\n' +
      '  • ACR integration: AcrPull role binding for kubelet (never imagePullSecrets)\n' +
      '  • HPA: min 2 replicas, max 10, CPU threshold 70%\n' +
      '  • PDB: minAvailable 1\n' +
      'Do NOT set dnsPrefix, networkProfile, or nodeResourceGroup on the AKS Automatic cluster resource.\n' +
      'For AI/ML workloads with KAITO:\n' +
      '  • Generate a Workspace CRD (apiVersion: kaito.sh/v1alpha1, kind: Workspace) with the model preset name\n' +
      '  • Set resource.instanceType to the appropriate GPU VM size (e.g. Standard_NC12s_v3 for 7B models)\n' +
      '  • For RAG: generate a RAGEngine CRD referencing the KAITO Workspace and document source\n' +
      '  • For fine-tuning: set tuning.method (lora/qlora), tuning.input (dataset source), and tuning.output',
    ],

    [Phase.Review]: [
      'Use estimate_cost to provide a final monthly cost breakdown before the user approves the plan. ' +
      'Present costs as a CostEstimate component (compute, database, networking, storage line items). ' +
      'Validate all generated files against deployment safeguards — surface violations as "deployment improvements" not "Kubernetes issues".',
    ],

    [Phase.Handoff]: [
      'After code is pushed to GitHub, remind the user that the GitHub Actions workflow will deploy ' +
      'automatically on every push to the default branch. No manual Azure steps needed beyond initial OIDC setup. ' +
      'The workflow uses OIDC Workload Identity Federation — this eliminates long-lived secrets but still requires ' +
      'one-time setup: an Entra app registration (or User-Assigned Managed Identity) with a federated credential ' +
      'for the GitHub repo, and three GitHub repository secrets (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID). ' +
      'Guide the user through this setup if it has not been done yet.',
    ],

    [Phase.Deploy]: [
      'Use azure_resource_list to confirm the target subscription and resource group before deploying. ' +
      'Use azure_resource_get to check AKS cluster status if the user already has one. ' +
      'Show a DeploymentProgress component tracking: image build → push to ACR → AKS rolling update → health check.',
    ],
  },

  components: [
    {
      type: 'azureLoginCard',
      description:
        'MSAL sign-in card with automatic subscription discovery.\n' +
        'Props:\n' +
        '  - displayName (optional string): Display name shown on the avatar and user info. Defaults to "Azure User".\n' +
        '  - showTokenInfo (optional boolean): Show authentication timestamp. Never exposes raw tokens.\n' +
        '  - onSignIn (optional action): Callback fired after successful MSAL sign-in.\n' +
        '  - onSignOut (optional action): Callback fired when the user signs out.',
    },
    {
      type: 'azureResourcePicker',
      description:
        'Cascading subscription → resource group → resource selector with search/filter.\n' +
        'Props:\n' +
        '  - subscriptionId (optional string): Pre-select a subscription. If omitted, shows subscription dropdown.\n' +
        '  - resourceGroup (optional string): Pre-select a resource group. If omitted, shows resource group dropdown.\n' +
        '  - resourceType (optional string): Filter resources by ARM type (e.g. "Microsoft.ContainerService/managedClusters").\n' +
        '  - label (optional string): Header text above the resource list. Defaults to "Select an Azure resource".\n' +
        '  - onSelect (optional action): Callback fired when the user selects a resource.',
    },
    {
      type: 'azureResourceForm',
      description:
        'Dynamic form for creating Azure resources. Generates fields based on resource type.\n' +
        'Props:\n' +
        '  - title (optional string): Form title. Defaults to "Create Azure Resource".\n' +
        '  - subscriptionId (optional string): Target subscription ID.\n' +
        '  - resourceGroup (optional string): Target resource group name.\n' +
        '  - resourceType (optional string): ARM resource type (e.g. "Microsoft.ContainerService/managedClusters").\n' +
        '  - apiVersion (optional string): ARM API version for the resource type.',
    },
    {
      type: 'azureAction',
      description:
        'Write-with-confirm pattern for ARM operations. Shows action preview before execution.\n' +
        'Destructive operations (DELETE) require typing the resource name to confirm.\n' +
        'Only allows operations targeting allowlisted ARM resource types.\n' +
        'Props:\n' +
        '  - title (string): Action title displayed in the card header.\n' +
        '  - description (optional string): Description of what the action will do.\n' +
        '  - method (enum: PUT|POST|PATCH|DELETE): HTTP method for the ARM operation.\n' +
        '  - path (string): ARM resource path (e.g. "/subscriptions/{subId}/resourceGroups/{rg}/providers/...").\n' +
        '  - body (optional object): Request body for PUT/POST/PATCH operations.\n' +
        '  - apiVersion (optional string): ARM API version. Defaults to "2021-04-01".\n' +
        '  - confirmLabel (optional string): Custom label for the confirm button.\n' +
        '  - onSuccess (optional action): Callback fired on successful operation.\n' +
        '  - onError (optional action): Callback fired on operation failure.',
    },
  ],

  auth: azureAuth,
};
