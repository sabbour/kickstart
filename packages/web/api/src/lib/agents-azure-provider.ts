/**
 * @module @kickstart/api/lib/agents-azure-provider
 *
 * Spike checkpoint #1 — Azure model-provider compatibility with @openai/agents SDK.
 *
 * Wraps the existing Azure OpenAI env config into an `OpenAIProvider` backed by
 * an `AzureOpenAI` client. The deployment name passed to `getModel()` maps directly
 * to `/openai/deployments/{deployment}` on the Azure endpoint.
 *
 * Security: AzureOpenAI client is created server-side only; API key never leaves
 * the server. Tracing is disabled to prevent prompt/token data from being forwarded
 * to external trace collectors.
 */

import { AzureOpenAI } from "openai";
import { OpenAIProvider, setTracingDisabled } from "@openai/agents";

// Disable SDK tracing globally — no prompts, tool payloads, or completions
// should be forwarded to external collectors without explicit operator opt-in.
setTracingDisabled(true);

const AZURE_API_VERSION = "2024-12-01-preview";

/**
 * Build an `OpenAIProvider` that routes all model calls through the Azure OpenAI
 * endpoint configured in environment variables. The deployment name used at
 * agent-creation time becomes the Azure deployment path.
 *
 * @throws if required Azure env vars are missing.
 */
export function createAzureModelProvider(): OpenAIProvider {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;

  if (!endpoint || !apiKey) {
    throw new Error(
      "createAzureModelProvider: AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required.",
    );
  }

  const azureClient = new AzureOpenAI({
    endpoint: endpoint.replace(/\/+$/, ""),
    apiKey,
    apiVersion: AZURE_API_VERSION,
    // dangerouslyAllowBrowser must stay false (server-only)
  });

  return new OpenAIProvider({
    // AzureOpenAI extends OpenAI — cast needed due to cross-package ESM/CJS resolution modes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    openAIClient: azureClient as any,
    // Use Chat Completions (not Responses API) for Azure compat with 2024-12-01-preview
    useResponses: false,
  });
}

/**
 * Return the default deployment name for the agents SDK runner, resolving
 * in order: AZURE_OPENAI_CHAT_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT → throws.
 */
export function getAgentsDeployment(): string {
  const deployment =
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ||
    process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!deployment) {
    throw new Error(
      "getAgentsDeployment: set AZURE_OPENAI_CHAT_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.",
    );
  }
  return deployment;
}

/**
 * Return the generate/codex deployment name, resolving in order:
 * AZURE_OPENAI_CODEX_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT → throws.
 */
export function getAgentsGenerateDeployment(): string {
  const deployment =
    process.env.AZURE_OPENAI_CODEX_DEPLOYMENT ||
    process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!deployment) {
    throw new Error(
      "getAgentsGenerateDeployment: set AZURE_OPENAI_CODEX_DEPLOYMENT or AZURE_OPENAI_DEPLOYMENT.",
    );
  }
  return deployment;
}

/**
 * Quick health check: validate that the Azure provider can reach the model.
 * Returns `{ ok: true }` on success, `{ ok: false, error }` on failure.
 *
 * Intended for use only in spike/validation paths — not called on the hot request path.
 */
export async function validateAzureProviderCompatibility(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const { Agent, Runner } = await import("@openai/agents");
    const provider = createAzureModelProvider();
    const deployment = getAgentsDeployment();

    const probe = new Agent({
      name: "azure-compat-probe",
      instructions: "You are a minimal probe. Reply only with the word 'ok'.",
      model: deployment,
    });

    const runner = new Runner({ modelProvider: provider });
    const result = await runner.run(probe, "ping", { maxTurns: 1 });

    // We just need a non-empty response — content doesn't matter
    const output = result.finalOutput ?? "";
    if (typeof output !== "string" || output.length === 0) {
      return { ok: false, error: "Empty output from Azure probe" };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
