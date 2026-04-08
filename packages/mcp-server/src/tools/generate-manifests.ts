/**
 * @module @kickstart/mcp-server/tools/generate-manifests
 *
 * Tool handler: Generate Kubernetes manifests from conversation state.
 * After generation, validates against deployment safeguards (D13) and
 * returns results as an A2UI Card with pass/fail indicators.
 */

import {
  generateKubernetesManifests,
  generateGitHubActionsWorkflow,
  DEPLOYMENT_SAFEGUARDS,
} from "@kickstart/core";
import type {
  SessionState,
  AppDefinition,
  AzureContext,
  GitHubContext,
  GeneratorOutput,
  GeneratedFile,
  DeploymentSafeguard,
  CodeBlockComponent,
  ColumnComponent,
  CardComponent,
  TextComponent,
  RowComponent,
} from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";
import type { A2UICapability } from "../a2ui.js";

// ── Safeguard validation helpers ────────────────────────────────────

interface SafeguardResult {
  safeguard: DeploymentSafeguard;
  passed: boolean;
  detail?: string;
}

/** Run lightweight static checks against generated K8s manifest content. */
function validateManifests(files: GeneratedFile[], tier: string): SafeguardResult[] {
  const yamlContent = files
    .filter((f) => f.language === "yaml")
    .map((f) => f.content)
    .join("\n---\n");

  return DEPLOYMENT_SAFEGUARDS.map((sg): SafeguardResult => {
    switch (sg.rule) {
      case "resource-limits-required":
        return { safeguard: sg, passed: yamlContent.includes("resources:") && yamlContent.includes("limits:") };
      case "health-probes-required":
        return { safeguard: sg, passed: yamlContent.includes("livenessProbe:") && yamlContent.includes("readinessProbe:") };
      case "run-as-non-root":
        return { safeguard: sg, passed: yamlContent.includes("runAsNonRoot: true") };
      case "no-privilege-escalation":
        return { safeguard: sg, passed: yamlContent.includes("allowPrivilegeEscalation: false") };
      case "no-host-networking":
        return { safeguard: sg, passed: !yamlContent.includes("hostNetwork: true") };
      case "no-latest-image-tag":
        return { safeguard: sg, passed: !/:latest\b/.test(yamlContent) };
      case "read-only-root-filesystem":
        return { safeguard: sg, passed: yamlContent.includes("readOnlyRootFilesystem: true") };
      case "gateway-api-for-ingress":
        return { safeguard: sg, passed: yamlContent.includes("HTTPRoute") || !yamlContent.includes("kind: Ingress") };
      case "workload-identity-required":
        return { safeguard: sg, passed: yamlContent.includes("azure.workload.identity") || !yamlContent.includes("kind: Secret") };
      case "acr-with-acrpull":
        return { safeguard: sg, passed: !yamlContent.includes("imagePullSecrets:") };
      case "resource-quotas-production":
        return { safeguard: sg, passed: tier !== "production" || yamlContent.includes("kind: ResourceQuota") };
      case "network-policies-production":
        return { safeguard: sg, passed: tier !== "production" || yamlContent.includes("kind: NetworkPolicy") };
      case "pod-disruption-budget-production":
        return { safeguard: sg, passed: tier !== "production" || yamlContent.includes("kind: PodDisruptionBudget") };
      default:
        return { safeguard: sg, passed: true };
    }
  });
}

/** Build an A2UI Card showing safeguard validation results. */
function buildSafeguardCard(results: SafeguardResult[]): CardComponent {
  const rows: RowComponent[] = results.map((r) => {
    const icon = r.passed ? "✅" : r.safeguard.severity === "error" ? "❌" : "⚠️";
    const status: TextComponent = {
      type: "Text",
      id: `sg-${r.safeguard.id}-status`,
      content: `${icon} **${r.safeguard.id}**: ${r.safeguard.friendlyLabel}`,
    };
    return {
      type: "Row" as const,
      id: `sg-${r.safeguard.id}-row`,
      children: [status],
    };
  });

  const passCount = results.filter((r) => r.passed).length;
  const header: TextComponent = {
    type: "Text",
    id: "sg-header",
    content: `**Deployment best practices:** ${passCount}/${results.length} passed`,
    variant: "heading",
  };

  return {
    type: "Card",
    id: "safeguard-results",
    title: "Deployment Improvements",
    children: [header, ...rows],
  };
}

// ── Main handler ────────────────────────────────────────────────────

/**
 * Generate deployment manifests from the accumulated conversation state.
 *
 * Requires the session to have a complete AppDefinition and AzureContext.
 * Returns generated files as A2UI CodeBlock components and validates
 * against deployment safeguards.
 */
export async function handleGenerateManifests(
  sessions: Map<string, SessionState>,
  sessionId: string,
  capability: A2UICapability = "kickstart",
): Promise<{ content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      content: [{ type: "text", text: `❌ Session \`${sessionId}\` not found. Start a new conversation with the \`kickstart\` tool.` }],
    };
  }

  const app = session.appDefinition as AppDefinition;
  const azure = session.azureContext as AzureContext | undefined;

  if (!app.name || !app.runtime) {
    return {
      content: [{ type: "text", text: "⚠️ Not enough information to generate manifests. Complete the Discover and Design phases first." }],
    };
  }

  if (!azure?.subscriptionId || !azure?.resourceGroup || !azure?.region) {
    return {
      content: [{ type: "text", text: "⚠️ Azure context is incomplete. Provide subscription, resource group, and region before generating." }],
    };
  }

  const input = {
    app,
    azure,
    github: session.githubContext as GitHubContext | undefined,
  };

  // Generate manifests
  const k8sOutput = generateKubernetesManifests(input);
  const ghOutput = generateGitHubActionsWorkflow(input);
  const allOutputs: GeneratorOutput[] = [k8sOutput, ghOutput];

  // Validate K8s manifests against deployment safeguards
  const safeguardResults = validateManifests(k8sOutput.files, app.resourceTier ?? "standard");
  const failures = safeguardResults.filter((r) => !r.passed);

  // Build A2UI CodeBlock components for each file
  const codeBlocks: CodeBlockComponent[] = allOutputs.flatMap((output) =>
    output.files.map((file) => ({
      type: "CodeBlock" as const,
      id: `code-${file.path.replace(/[^a-z0-9]/gi, "-")}`,
      code: file.content,
      language: file.language,
      filename: file.path,
      action: "copy" as const,
    })),
  );

  const uiColumn: ColumnComponent = {
    type: "Column",
    id: "generated-files",
    children: codeBlocks,
    gap: "16px",
  };

  const content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> = [];

  const summary = allOutputs.map((o) => `- ${o.summary}`).join("\n");
  content.push({ type: "text", text: `📦 **Generated deployment artifacts:**\n\n${summary}` });

  const manifestResource = createA2UIResource(
    uiColumn,
    `a2ui://kickstart/session/${sessionId}/manifests`,
    capability,
  );
  if (manifestResource) content.push(manifestResource);

  // Add safeguard validation card
  const safeguardCard = buildSafeguardCard(safeguardResults);
  const safeguardResource = createA2UIResource(
    safeguardCard,
    `a2ui://kickstart/session/${sessionId}/safeguards`,
    capability,
  );
  if (safeguardResource) content.push(safeguardResource);

  // Text fallback for safeguard results
  const passCount = safeguardResults.filter((r) => r.passed).length;
  let safeguardText = `\n\n🛡️ **Deployment best practices:** ${passCount}/${safeguardResults.length} passed`;
  if (failures.length > 0) {
    safeguardText += `\n\n**Improvements available:**\n${failures.map((f) => `- ${f.safeguard.friendlyLabel}${f.safeguard.autoFix ? " *(auto-fix available)*" : ""}`).join("\n")}`;
  }
  content.push({ type: "text", text: safeguardText });

  return { content };
}
