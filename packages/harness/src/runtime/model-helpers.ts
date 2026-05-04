/**
 * Shared leaf module for model-provider construction and output-text extraction.
 *
 * Extracted from runner.ts to break the circular dependency between
 * runner.ts (which imports asTool from as-tool.ts) and as-tool.ts (which
 * previously imported buildModelProvider/resolveOutputText from runner.ts).
 *
 * Import graph (after extraction):
 *   runner.ts   → model-helpers.ts   (one-way)
 *   as-tool.ts  → model-helpers.ts   (one-way)
 *
 * Keep this module free of any imports from runner.ts or as-tool.ts.
 */

import { OpenAIProvider } from '@openai/agents';

// ---------------------------------------------------------------------------
// Responses-API feature flag
// ---------------------------------------------------------------------------

export function isResponsesApiEnabled(): boolean {
  const val = (process.env.KICKSTART_USE_RESPONSES ?? '').toLowerCase().trim();
  return val === '1' || val === 'true' || val === 'yes' || val === 'on';
}

// ---------------------------------------------------------------------------
// Azure OpenAI base URL
// ---------------------------------------------------------------------------

/**
 * Build the Azure OpenAI baseURL for use with the OpenAI-compatible SDK.
 *
 * Targets the v1 endpoint shape:
 *   https://{resource}.openai.azure.com/openai/v1
 *
 * The SDK appends `/chat/completions`, producing the correct path.
 */
export function buildAzureBaseUrl(endpoint: string): string {
  const trimmed = endpoint.replace(/\/$/, '');
  return `${trimmed}/openai/v1`;
}

// ---------------------------------------------------------------------------
// Model provider factory
// ---------------------------------------------------------------------------

export function buildModelProvider(): OpenAIProvider {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const useResponses = isResponsesApiEnabled();

  if (endpoint && apiKey) {
    const azureBaseUrl = buildAzureBaseUrl(endpoint);
    console.log('[runner] Building model provider: Azure OpenAI');
    return new OpenAIProvider({
      apiKey,
      baseURL: azureBaseUrl,
      useResponses,
    });
  }

  console.log('[runner] Building model provider: Standard OpenAI (or dev/test fallback)');
  return new OpenAIProvider({ useResponses });
}

// ---------------------------------------------------------------------------
// Output-text extraction
// ---------------------------------------------------------------------------

/**
 * Extract a plain-text message from AgentOutput-typed final output.
 *
 * Priority:
 *  1. `finalOutput.message` (structured AgentOutput)
 *  2. `fullText` fallback (passed from the caller's streaming accumulator)
 */
export function resolveOutputText(finalOutput: unknown, fullText: string): string {
  // Plain string output (e.g., outputType: 'text' with MCP sampling)
  if (typeof finalOutput === 'string') {
    return finalOutput || fullText;
  }
  if (
    finalOutput !== null &&
    typeof finalOutput === 'object' &&
    'message' in finalOutput &&
    typeof (finalOutput as { message?: unknown }).message === 'string'
  ) {
    return (finalOutput as { message: string }).message;
  }
  if (
    finalOutput !== null &&
    typeof finalOutput === 'object' &&
    (!('message' in finalOutput) ||
      (finalOutput as { message?: unknown }).message === null)
  ) {
    return '';
  }
  return fullText;
}
