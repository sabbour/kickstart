import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { validateArmPath } from './arm-get.js';
import { getAzureToken, armAuthHeaders, pollArmLro } from '../services/azure-auth.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const ARM_BASE_URL = 'https://management.azure.com';

const ArmDeployResourceInputSchema = z.object({
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
  // OpenAI strict-mode forbids open-keyed objects (z.record), so the ARM
  // body is passed as a JSON-encoded string and parsed inside execute().
  body: z
    .string()
    .describe(
      'Full ARM resource body for the PUT request, JSON-encoded as a string. ' +
      'Example: \'{"location":"eastus","properties":{...}}\'.',
    ),
});

const ArmDeployResourceOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  location: z.string().nullable(),
  provisioningState: z.string().nullable(),
  // Open-keyed object (z.record / z.unknown) violates I1+I3+I4. Encode as a
  // JSON string; callers parse if needed.
  properties: z
    .string()
    .nullable()
    .describe('JSON-encoded resource-specific properties returned by ARM'),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const armDeployResourceTool: ToolContribution = {
  name: 'azure.arm_deploy_resource',
  tool: tool({
    name: 'azure.arm_deploy_resource',
    description:
      'Creates or fully replaces a specific Azure resource via ARM PUT. ' +
      'Requires prior confirmation via the azure:deploy-resource user action. ' +
      'Path is validated against the ARM allowlist and denylist before any network call.',
    parameters: ArmDeployResourceInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof ArmDeployResourceOutputSchema>> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Zapp C1: two-step ARM path validation (decodeURIComponent → allowlist → denylist)
      const safePath = validateArmPath(input.resourcePath);

      const token = getAzureToken(session);
      const url = `${ARM_BASE_URL}${safePath}?api-version=${encodeURIComponent(input.apiVersion)}`;

      // Validate that `body` is well-formed JSON; the model passes it as a
      // string under OpenAI strict-mode (which forbids open-keyed objects).
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(input.body);
      } catch (err) {
        throw new Error(
          `azure.arm_deploy_resource: body must be a valid JSON string. ${(err as Error).message}`,
          { cause: err },
        );
      }
      if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
        throw new Error(
          'azure.arm_deploy_resource: body must decode to a JSON object (got '
            + (parsedBody === null ? 'null' : Array.isArray(parsedBody) ? 'array' : typeof parsedBody)
            + ').',
        );
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: armAuthHeaders(token),
        body: JSON.stringify(parsedBody),
        signal: AbortSignal.timeout(30_000),
      });

      if (response.status === 201 || response.status === 200) {
        const data = (await response.json()) as Record<string, unknown>;
        return parseResourceResponse(data, safePath);
      }

      // LRO — ARM accepted but operation is async
      if (response.status === 202) {
        const operationUrl = response.headers.get('Azure-AsyncOperation') ?? response.headers.get('Location');
        if (!operationUrl) {
          throw new Error('ARM PUT returned 202 but no polling URL');
        }
        const lroResult = await pollArmLro(operationUrl, token);
        return parseResourceResponse(lroResult, safePath);
      }

      const err = await response.text().catch(() => '');
      throw new Error(`ARM PUT ${safePath} → HTTP ${response.status}: ${err.slice(0, 500)}`);
    },
  }),
};

function parseResourceResponse(
  data: Record<string, unknown>,
  safePath: string,
): z.infer<typeof ArmDeployResourceOutputSchema> {
  const props = data['properties'] as Record<string, unknown> | undefined;
  return ArmDeployResourceOutputSchema.parse({
    id: data['id'] ?? safePath,
    name: data['name'] ?? '',
    type: data['type'] ?? '',
    location: data['location'] ?? null,
    provisioningState: props?.['provisioningState'] ?? null,
    properties: props != null ? JSON.stringify(props) : null,
  });
}
