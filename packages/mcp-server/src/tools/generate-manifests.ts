/**
 * @module @kickstart/mcp-server/tools/generate-manifests
 *
 * Tool handler: Generate Kubernetes manifests from conversation state.
 */

import {
  generateKubernetesManifests,
  generateGitHubActionsWorkflow,
} from "@kickstart/core";
import type {
  SessionState,
  AppDefinition,
  AzureContext,
  GitHubContext,
  GeneratorOutput,
  CodeBlockComponent,
  ColumnComponent,
} from "@kickstart/core";
import { createA2UIResource } from "../a2ui.js";

/**
 * Generate deployment manifests from the accumulated conversation state.
 *
 * Requires the session to have a complete AppDefinition and AzureContext.
 * Returns generated files as A2UI CodeBlock components.
 */
export async function handleGenerateManifests(
  sessions: Map<string, SessionState>,
  sessionId: string,
): Promise<{ content: Array<{ type: "text"; text: string } | { type: "resource"; resource: { uri: string; mimeType: string; text: string } }> }> {
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      content: [{ type: "text", text: `❌ Session \`${sessionId}\` not found. Start a new conversation with the \`kickstart\` tool.` }],
    };
  }

  const app = session.appDefinition as AppDefinition;
  const azure = session.azureContext as AzureContext | undefined;

  // Validate we have enough info
  if (!app.name || !app.runtime) {
    return {
      content: [{ type: "text", text: "⚠️ Not enough information to generate manifests. Complete the Understand and Clarify phases first." }],
    };
  }

  if (!azure?.subscriptionId || !azure?.resourceGroup || !azure?.region) {
    return {
      content: [{ type: "text", text: "⚠️ Azure context is incomplete. Complete the Needs phase to select subscription, resource group, and region." }],
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

  const a2uiResource = createA2UIResource(
    uiColumn,
    `a2ui://kickstart/session/${sessionId}/manifests`,
  );

  const summary = allOutputs.map((o) => `- ${o.summary}`).join("\n");

  return {
    content: [
      { type: "text", text: `📦 **Generated deployment artifacts:**\n\n${summary}` },
      a2uiResource,
    ],
  };
}
