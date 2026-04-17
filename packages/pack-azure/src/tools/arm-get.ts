import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';

// ── ARM path security (Zapp C1) ───────────────────────────────────────────────

/**
 * Allowlist: path must be subscription-UUID scoped.
 * Accepts:
 *   /subscriptions/{uuid}
 *   /subscriptions/{uuid}/resourceGroups/{rg}
 *   /subscriptions/{uuid}/resourceGroups/{rg}/providers/{ns}/{type}/{name}[/{sub-type}/{sub-name}...]
 */
export const ARM_PATH_RE =
  /^\/subscriptions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/resourceGroups\/[^/]+)?(?:\/providers\/[^/]+\/[^/]+\/[^/]+(?:\/[^/]+\/[^/]+)*)?$/i;

/**
 * Denylist: rejects path traversals and privileged control-plane paths.
 */
export const ARM_PATH_DENY =
  /(\.\.|%2e%2e|%252e|\/\/|microsoft\.authorization\/roleassignments|microsoft\.authorization\/roledefinitions)/i;

export function validateArmPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath);
  if (!ARM_PATH_RE.test(decoded)) {
    throw new Error('ARM path not in allowlist — must be subscription-scoped: /subscriptions/{uuid}/...');
  }
  if (ARM_PATH_DENY.test(decoded)) {
    throw new Error('ARM path contains a forbidden segment (traversal or privileged path)');
  }
  return decoded;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const ARM_BASE_URL = 'https://management.azure.com';

const ArmGetInputSchema = z.object({
  path: z
    .string()
    .describe(
      'Full ARM resource path, subscription-scoped. ' +
      'Example: /subscriptions/{uuid}/resourceGroups/{rg}/providers/Microsoft.Network/virtualNetworks/{name}',
    ),
  apiVersion: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(-preview)?$/, 'Must be an API version like 2023-01-01 or 2023-01-01-preview')
    .describe('ARM API version, e.g. "2023-01-01"'),
});

const ArmGetOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  location: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  tags: z.record(z.string(), z.string()).optional(),
  raw: z.unknown(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const armGetTool: ToolContribution = {
  name: 'azure.arm_get',
  tool: tool({
    name: 'azure.arm_get',
    description:
      'Reads an Azure resource via the ARM REST API. ' +
      'Path must be subscription-scoped (includes subscription UUID). ' +
      'Requires an Azure access token in the session token store.',
    parameters: ArmGetInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof ArmGetOutputSchema>> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Two-step ARM path validation (Zapp C1)
      const safePath = validateArmPath(input.path);

      const token = (session as unknown as { tokens?: Record<string, string> })?.tokens?.['azure']
        ?? (session as unknown as { tokens?: Record<string, string> })?.tokens?.['azure-token'];
      if (!token) {
        throw new Error('No Azure token found in session. Please authenticate first via azure:select_subscription.');
      }

      const url = `${ARM_BASE_URL}${safePath}?api-version=${encodeURIComponent(input.apiVersion)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ARM GET ${safePath} → HTTP ${response.status}: ${body.slice(0, 500)}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      return ArmGetOutputSchema.parse({
        id: data['id'] ?? safePath,
        name: data['name'] ?? '',
        type: data['type'] ?? '',
        location: data['location'],
        properties: data['properties'] as Record<string, unknown> | undefined,
        tags: data['tags'] as Record<string, string> | undefined,
        raw: data,
      });
    },
  }),
};
