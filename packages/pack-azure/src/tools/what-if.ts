import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { validateArmPath } from './arm-get.js';
import { getAzureToken } from '../services/azure-auth.js';

// ── Schema ────────────────────────────────────────────────────────────────────

const ARM_BASE_URL = 'https://management.azure.com';

function parseJsonField(name: string, value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (err) {
    throw new Error(
      `azure.what_if: ${name} must be a valid JSON string. ${(err as Error).message}`,
      { cause: err },
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `azure.what_if: ${name} must decode to a JSON object (got `
        + (parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed)
        + ').',
    );
  }
  return parsed as Record<string, unknown>;
}

const WhatIfInputSchema = z.object({
  scopePath: z
    .string()
    .describe(
      'ARM scope path for the deployment (resource group or subscription level). ' +
      'Example: /subscriptions/{uuid}/resourceGroups/{rg}',
    ),
  // OpenAI strict-mode forbids open-keyed objects (z.record), so the ARM
  // template and parameters are passed as JSON-encoded strings and parsed
  // inside execute().
  template: z
    .string()
    .describe('ARM or Bicep-compiled JSON template object to evaluate, encoded as a JSON string'),
  parameters: z
    .string()
    .nullable()
    .optional()
    .describe('Optional ARM template parameters object, encoded as a JSON string'),
  deploymentName: z
    .string()
    .nullable()
    .optional()
    .describe('Optional deployment name for tracking'),
});

const WhatIfChangeSchema = z.object({
  resourceId: z.string(),
  changeType: z.enum(['Create', 'Delete', 'Deploy', 'Modify', 'Ignore', 'Unsupported', 'NoChange']),
  before: z.record(z.string(), z.unknown()).optional(),
  after: z.record(z.string(), z.unknown()).optional(),
  delta: z.array(z.record(z.string(), z.unknown())).optional(),
});

const WhatIfOutputSchema = z.object({
  changes: z.array(WhatIfChangeSchema),
  createCount: z.number(),
  deleteCount: z.number(),
  modifyCount: z.number(),
  noChangeCount: z.number(),
  hasDestructiveChanges: z.boolean(),
  summary: z.string(),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const whatIfTool: ToolContribution = {
  name: 'azure.what_if',
  tool: tool({
    name: 'azure.what_if',
    description:
      'Runs an ARM deployment what-if analysis to preview changes before deploying. ' +
      'Returns a list of resource changes (Create/Delete/Modify/Deploy) without making any real changes. ' +
      'Always run this before azure:deploy.',
    parameters: WhatIfInputSchema,
    execute: async (input, runCtx): Promise<z.infer<typeof WhatIfOutputSchema>> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Two-step ARM path validation (Zapp C1 — same constraint as arm-get)
      const safePath = validateArmPath(input.scopePath);

      const token = getAzureToken(session);

      const deploymentName = input.deploymentName ?? `kickstart-whatif-${Date.now()}`;
      const isRgScope = safePath.toLowerCase().includes('/resourcegroups/');

      // Build the what-if URL for the correct scope:
      // - RG scope:  .../resourceGroups/{rg}/providers/Microsoft.Resources/deployments/{name}/whatIf
      // - Sub scope: .../subscriptions/{sub}/providers/Microsoft.Resources/deployments/{name}/whatIf
      // safePath already encodes the full scope prefix, so the same template works for both.
      const whatIfUrl = isRgScope
        ? `${ARM_BASE_URL}${safePath}/providers/Microsoft.Resources/deployments/${deploymentName}/whatIf?api-version=2021-04-01`
        : `${ARM_BASE_URL}${safePath}/providers/Microsoft.Resources/deployments/${deploymentName}/whatIf?api-version=2021-04-01&%24expand=resourceChanges`;

      const body = {
        properties: {
          mode: 'Incremental',
          template: parseJsonField('template', input.template),
          parameters: input.parameters ? parseJsonField('parameters', input.parameters) : {},
        },
      };

      const response = await fetch(whatIfUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      if (response.status === 202) {
        // LRO — poll the operation URL
        const operationUrl = response.headers.get('Azure-AsyncOperation') ?? response.headers.get('Location');
        if (!operationUrl) {
          throw new Error('What-if returned 202 but no polling URL');
        }
        return await pollWhatIfResult(operationUrl, token);
      }

      if (!response.ok) {
        const err = await response.text().catch(() => '');
        throw new Error(`What-if POST ${safePath} → HTTP ${response.status}: ${err.slice(0, 500)}`);
      }

      const data = (await response.json()) as { properties?: { changes?: unknown[] } };
      return parseWhatIfResponse(data);
    },
  }),
};

async function pollWhatIfResult(operationUrl: string, token: string, maxAttempts = 20): Promise<z.infer<typeof WhatIfOutputSchema>> {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(3000);
    const resp = await fetch(operationUrl, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) continue;
    const data = (await resp.json()) as { status?: string; properties?: { changes?: unknown[] } };
    if (data.status === 'Succeeded') {
      return parseWhatIfResponse(data);
    }
    if (data.status === 'Failed') {
      throw new Error('What-if operation failed');
    }
  }
  throw new Error('What-if polling timed out');
}

function parseWhatIfResponse(data: { properties?: { changes?: unknown[] } }): z.infer<typeof WhatIfOutputSchema> {
  const rawChanges = (data.properties?.changes ?? []) as Array<Record<string, unknown>>;
  const changes = rawChanges.map((c) =>
    WhatIfChangeSchema.parse({
      resourceId: c['resourceId'] ?? '',
      changeType: c['changeType'] ?? 'Unsupported',
      before: c['before'] as Record<string, unknown> | undefined,
      after: c['after'] as Record<string, unknown> | undefined,
      delta: c['delta'] as Array<Record<string, unknown>> | undefined,
    }),
  );

  const createCount = changes.filter((c) => c.changeType === 'Create').length;
  const deleteCount = changes.filter((c) => c.changeType === 'Delete').length;
  const modifyCount = changes.filter((c) => c.changeType === 'Modify').length;
  const noChangeCount = changes.filter((c) => c.changeType === 'Deploy' || c.changeType === 'NoChange').length;
  const hasDestructiveChanges = deleteCount > 0;

  const summary = [
    createCount > 0 ? `${createCount} to create` : null,
    modifyCount > 0 ? `${modifyCount} to modify` : null,
    deleteCount > 0 ? `⚠️ ${deleteCount} to delete` : null,
    noChangeCount > 0 ? `${noChangeCount} unchanged` : null,
  ]
    .filter(Boolean)
    .join(', ') || 'No changes';

  return { changes, createCount, deleteCount, modifyCount, noChangeCount, hasDestructiveChanges, summary };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
