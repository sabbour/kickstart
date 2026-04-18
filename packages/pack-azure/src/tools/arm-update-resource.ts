import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';
import { validateArmPath } from './arm-get.js';
import { getAzureToken, armAuthHeaders, pollArmLro } from '../services/azure-auth.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const ARM_BASE_URL = 'https://management.azure.com';

const ArmUpdateResourceInputSchema = z.object({
  resourcePath: z
    .string()
    .describe(
      'Full ARM resource path, subscription-scoped. ' +
      'Example: /subscriptions/{uuid}/resourceGroups/{rg}/providers/Microsoft.Compute/virtualMachines/{name}',
    ),
  apiVersion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(-preview)?$/, 'Must be an API version like 2023-01-01 or 2023-01-01-preview')
    .describe('ARM API version, e.g. "2023-03-01"'),
  patch: z
    .record(z.string(), z.unknown())
    .describe('Partial ARM resource body — only the fields to change'),
});

const ArmUpdateResourceOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  location: z.string().optional(),
  provisioningState: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const armUpdateResourceTool: ToolContribution = {
  name: 'azure.arm_update_resource',
  tool: tool({
    name: 'azure.arm_update_resource',
    description:
      'Partially updates a specific Azure resource via ARM PATCH. ' +
      'Requires prior confirmation via the azure:update-resource user action. ' +
      'Path is validated against the ARM allowlist and denylist before any network call.',
    parameters: ArmUpdateResourceInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof ArmUpdateResourceOutputSchema>> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Zapp C1: two-step ARM path validation (decodeURIComponent → allowlist → denylist)
      const safePath = validateArmPath(input.resourcePath);

      const token = getAzureToken(session);
      const url = `${ARM_BASE_URL}${safePath}?api-version=${encodeURIComponent(input.apiVersion)}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: armAuthHeaders(token),
        body: JSON.stringify(input.patch),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 200) {
        const data = (await response.json()) as Record<string, unknown>;
        return parseResourceResponse(data, safePath);
      }

      // LRO — ARM accepted but patch is async
      if (response.status === 202) {
        const operationUrl = response.headers.get('Azure-AsyncOperation') ?? response.headers.get('Location');
        if (!operationUrl) {
          throw new Error('ARM PATCH returned 202 but no polling URL');
        }
        const lroResult = await pollArmLro(operationUrl, token);
        return parseResourceResponse(lroResult, safePath);
      }

      const err = await response.text().catch(() => '');
      throw new Error(`ARM PATCH ${safePath} → HTTP ${response.status}: ${err.slice(0, 500)}`);
    },
  }),
};

function parseResourceResponse(
  data: Record<string, unknown>,
  safePath: string,
): z.infer<typeof ArmUpdateResourceOutputSchema> {
  const props = data['properties'] as Record<string, unknown> | undefined;
  return ArmUpdateResourceOutputSchema.parse({
    id: data['id'] ?? safePath,
    name: data['name'] ?? '',
    type: data['type'] ?? '',
    location: data['location'],
    provisioningState: props?.['provisioningState'],
    properties: props,
  });
}
