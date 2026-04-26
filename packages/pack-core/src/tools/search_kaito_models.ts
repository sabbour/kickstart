import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';

export const KAITO_SUPPORTED_MODELS_URL =
  'https://raw.githubusercontent.com/kaito-project/kaito/main/presets/workspace/models/supported_models.yaml';

export interface KaitoModelSummary {
  name: string;
  type?: string;
  runtime?: string;
  tag?: string;
  version?: string;
  deprecated?: boolean;
  downloadAuthRequired?: boolean;
  downloadAtRuntime?: boolean;
}

const SearchKaitoModelsInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .describe('Model name fragment to search for in the current KAITO supported model catalog. Use "*" to list supported presets.'),
});

function parseScalar(value: string): string | boolean {
  const trimmed = value.trim().replace(/^["']|["']$/g, '');
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  return trimmed;
}

function applyModelField(model: KaitoModelSummary, key: string, rawValue: string): void {
  const value = parseScalar(rawValue);
  switch (key) {
    case 'type':
      if (typeof value === 'string') model.type = value;
      break;
    case 'runtime':
      if (typeof value === 'string') model.runtime = value;
      break;
    case 'tag':
      if (typeof value === 'string') model.tag = value;
      break;
    case 'version':
      if (typeof value === 'string') model.version = value;
      break;
    case 'deprecated':
      if (typeof value === 'boolean') model.deprecated = value;
      break;
    case 'downloadAuthRequired':
      if (typeof value === 'boolean') model.downloadAuthRequired = value;
      break;
    case 'downloadAtRuntime':
      if (typeof value === 'boolean') model.downloadAtRuntime = value;
      break;
  }
}

export function parseKaitoSupportedModels(yaml: string): KaitoModelSummary[] {
  const models: KaitoModelSummary[] = [];
  let current: KaitoModelSummary | null = null;

  for (const line of yaml.split(/\r?\n/)) {
    const nameMatch = line.match(/^\s*-\s+name:\s*(.+?)\s*$/);
    if (nameMatch) {
      current = { name: (nameMatch[1] ?? '').trim().replace(/^["']|["']$/g, '') };
      if (current.name && current.name !== 'base') {
        models.push(current);
      }
      continue;
    }

    if (!current || current.name === 'base') continue;

    const fieldMatch = line.match(/^\s+([A-Za-z][A-Za-z0-9]*):\s*(.+?)\s*$/);
    if (fieldMatch) {
      applyModelField(current, fieldMatch[1] ?? '', fieldMatch[2] ?? '');
    }
  }

  return models;
}

export const searchKaitoModelsTool: ToolContribution = {
  name: 'core.search_kaito_models',
  tool: tool({
    name: 'core.search_kaito_models',
    description:
      'Fetches the official KAITO supported_models.yaml catalog and searches the current supported workspace preset models. ' +
      'Use this before recommending KAITO model choices so responses are based on the live upstream catalog rather than a static list.',
    parameters: SearchKaitoModelsInputSchema,
    execute: async (input): Promise<string> => {
      const response = await fetch(KAITO_SUPPORTED_MODELS_URL, {
        headers: {
          'Accept': 'text/plain,*/*',
          'User-Agent': 'Kickstart/2 (https://github.com/azure-management-and-platforms/kickstart)',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        throw new Error(`search_kaito_models: HTTP ${response.status} ${response.statusText}`);
      }

      const models = parseKaitoSupportedModels(await response.text());
      const needle = input.query.toLowerCase();
      const matches = needle === '*'
        ? models
        : models.filter((model) => model.name.toLowerCase().includes(needle));

      return JSON.stringify({
        sourceUrl: KAITO_SUPPORTED_MODELS_URL,
        query: input.query,
        total: matches.length,
        matches,
      });
    },
  }),
};
