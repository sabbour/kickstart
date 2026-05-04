---
sidebar_position: 12
---

# Skills Reference

> Auto-generated from each pack's `SKILL.md` files. Do not edit by hand — run `npm --prefix docs-site run build` (or invoke `node docs-site/scripts/generate-skills-reference.mjs` directly).

See [Packs, skills & actions](../packs-and-skills.md) for the resolution rules and [Prompt pipeline](../../architecture/prompt-pipeline.md) for how skills are assembled into the per-turn system prompt.

## core

| Skill | applies to | priority | description |
|---|---|---|---|
| `a2ui-media-discipline` | `core.*` | 80 | Rules for referencing media assets (video, audio, images) in A2UI component examples. Enforces local-only media URLs to maintain strict CSP compliance. |
| `a2ui-output-discipline` | `*` | 85 | Rules for emitting A2UI v0.9 messages via core.emit_ui. Enforces the v0.9 adjacency-list shape, correct hierarchy fields, and spec-compliant action payloads. |
| `collaborator-voice` | `*` | 90 | Voice and tone guidelines for all Kickstart agents. Establishes a warm, collaborative, jargon-light communication style that meets users where they are. |
| `file-generation-batching` | `core.codesmith` | 80 | Rules for batching write_file calls efficiently. Prevents chatty incremental file writes and ensures the artifact store is updated atomically per logical unit of work. |
| `gen-gha-workflow` | `*` | 90 | Generate GitHub Actions CI/CD workflows with OIDC + Azure Managed Identity authentication. Emits deterministic, production-ready .github/workflows/*.yml files with zero embedded secrets. |
| `phase-acceleration` | `*` | 70 | Rules for when agents may skip confirmations, condense phases, or proceed autonomously. Prevents unnecessary friction when context is sufficient to proceed confidently. |
| `teach-then-ask` | `*` | 75 | Interaction pattern that requires agents to briefly explain context or reasoning before asking the user a question. Reduces cognitive load and builds trust. |

## azure

| Skill | applies to | priority | description |
|---|---|---|---|
| `azure.arm-basics` | `azure.*` | 80 | Fundamentals of the Azure Resource Manager API — resource IDs, REST paths, and response shapes. |
| `azure.bicep-authoring` | `azure.architect` | 85 | Writing idiomatic, safe, and reviewable Bicep templates for Azure resources. |
| `azure.cost-estimation` | `azure.*` | 75 | How to estimate Azure resource costs using the Retail Prices API and total-cost-of-ownership patterns. |
| `azure.deployment-review` | `azure.ops` | 85 | How to review and validate Azure deployments before executing them using what-if and pre-flight checks. |
| `azure.identity` | `azure.*` | 80 | Azure authentication patterns — MSAL, managed identity, service principals, and token acquisition. |
| `azure.monitoring-basics` | `azure.*` | 65 | Setting up observability for Azure resources with Azure Monitor, Log Analytics, and Application Insights. |
| `azure.networking-fundamentals` | `azure.*` | 70 | Core Azure networking concepts — VNets, subnets, NSGs, private endpoints, and DNS. |
| `azure.resource-management` | `azure.*` | 70 | Best practices for organizing, tagging, and governing Azure resources at scale. |
| `azure.security-hardening` | `azure.*` | 75 | Azure security baseline — RBAC, Key Vault, managed identity, network isolation, and Microsoft Defender. |

## aks

| Skill | applies to | priority | description |
|---|---|---|---|
| `acr-integration` | `aks.*` | 70 | ACR integration for AKS Automatic. Teaches attaching an ACR, image reference conventions (digest pinning, no :latest), and pull-secret-free authentication via the managed identity. |
| `aks-automatic-cluster-creation` | `aks.*` | 65 | How to create an AKS Automatic cluster. Teaches the minimum and recommended arguments, Microsoft-managed defaults (auto-upgrade, auto node-provisioning, maintenance windows), and day-2 expectations (no manual node pool management). |
| `aks-terminology-rules` | `aks.*` | 70 | Terminology rules for pre-deploy conversations. Use product-facing terms (app, workload, deployment, URL) before deployment; Kubernetes terms (pod, ingress, HPA) only after deployment or when the user explicitly asks. |
| `deployment-safeguards` | `aks.*` | 90 | Deployment safeguards are the built-in Azure Policy assignments enforced by AKS Automatic. Teaches each rule and severity and how to author manifests that satisfy them (single source of truth: safeguards.json). |
| `gateway-api-mandatory` | `aks.*` | 85 | Gateway API is the mandatory ingress mechanism for AKS Automatic. Teaches Gateway and HTTPRoute authoring, listener configuration, and cross-namespace references. Forbids legacy Ingress. |
| `kaito-gpu-models` | `aks.*` | 75 | KAITO (Kubernetes AI Toolchain Operator) for GPU workloads and OSS model serving on AKS Automatic. Teaches workspace definitions, supported preset models, and GPU node auto-provisioning. |
| `workload-identity-mandatory` | `aks.*` | 85 | Workload Identity is mandatory for AKS Automatic. Teaches the Azure Workload Identity wiring — managed identity, federated credential, service account annotation, and pod label. Forbids secretKeyRef for Azure credentials. |

---

Columns:

- **applies to** — agent-name globs from `x-kickstart.appliesTo`. `*` means all agents.
- **priority** — higher priorities win the greedy `fitSkillsInBudget` order. See `packages/harness/src/runtime/token-budget.ts`.
