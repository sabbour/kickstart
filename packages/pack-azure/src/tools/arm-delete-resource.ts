import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';
import { validateArmPath } from './arm-get.js';
import { getAzureToken, armAuthHeaders, pollArmLro } from '../services/azure-auth.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const ARM_BASE_URL = 'https://management.azure.com';

const ArmDeleteResourceInputSchema = z.object({
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
});

const ArmDeleteResourceOutputSchema = z.object({
  resourceId: z.string(),
  deletedAt: z.string().describe('ISO timestamp of when the delete was confirmed'),
  status: z.enum(['Deleted', 'Accepted']),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const armDeleteResourceTool: ToolContribution = {
  name: 'azure.arm_delete_resource',
  tool: tool({
    name: 'azure.arm_delete_resource',
    description:
      'Deletes a specific Azure resource via ARM DELETE. ' +
      'Requires prior confirmation via the azure:delete-resource user action. ' +
      'Path is validated against the ARM allowlist and denylist before any network call.',
    parameters: ArmDeleteResourceInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof ArmDeleteResourceOutputSchema>> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Zapp C1: two-step ARM path validation (decodeURIComponent → allowlist → denylist)
      const safePath = validateArmPath(input.resourcePath);

      const token = getAzureToken(session);
      const url = `${ARM_BASE_URL}${safePath}?api-version=${encodeURIComponent(input.apiVersion)}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      });

      // 204 = synchronous delete succeeded
      if (response.status === 204 || response.status === 200) {
        return ArmDeleteResourceOutputSchema.parse({
          resourceId: safePath,
          deletedAt: new Date().toISOString(),
          status: 'Deleted',
        });
      }

      // LRO — ARM accepted but deletion is async
      if (response.status === 202) {
        const operationUrl = response.headers.get('Azure-AsyncOperation') ?? response.headers.get('Location');
        if (!operationUrl) {
          throw new Error('ARM DELETE returned 202 but no polling URL');
        }
        await pollArmLro(operationUrl, token);
        return ArmDeleteResourceOutputSchema.parse({
          resourceId: safePath,
          deletedAt: new Date().toISOString(),
          status: 'Deleted',
        });
      }

      const err = await response.text().catch(() => '');
      throw new Error(`ARM DELETE ${safePath} → HTTP ${response.status}: ${err.slice(0, 500)}`);
    },
  }),
};
