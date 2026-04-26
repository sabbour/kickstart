import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RunContext } from '@openai/agents';
import {
  KAITO_SUPPORTED_MODELS_URL,
  parseKaitoSupportedModels,
  searchKaitoModelsTool,
} from '../../tools/search_kaito_models.js';
import { makeSessionCtx } from './_session-stub.js';

const SAMPLE_CATALOG = `
models:
  - name: base
    type: text-generation
    runtime: tfs
  - name: llama-3.1-8b-instruct
    type: text-generation
    runtime: tfs
    downloadAuthRequired: true
    tag: 0.2.0
  - name: phi-4
    type: text-generation
    runtime: tfs
    downloadAtRuntime: false
    tag: 0.2.0
  - name: mistral-7b-instruct
    type: text-generation
    runtime: tfs
    deprecated: true
    tag: 0.1.0
`;

function makeResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    text: async () => body,
  } as unknown as Response;
}

const invoke = (query: string) =>
  searchKaitoModelsTool.tool.invoke(new RunContext(makeSessionCtx()), JSON.stringify({ query }));

describe('core.search_kaito_models', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('parses model summaries from the KAITO supported models catalog', () => {
    const models = parseKaitoSupportedModels(SAMPLE_CATALOG);

    expect(models.map((model) => model.name)).toEqual([
      'llama-3.1-8b-instruct',
      'phi-4',
      'mistral-7b-instruct',
    ]);
    expect(models[0]?.downloadAuthRequired).toBe(true);
    expect(models[1]?.downloadAtRuntime).toBe(false);
    expect(models[2]?.deprecated).toBe(true);
  });

  it('fetches the official KAITO catalog and filters by query', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(SAMPLE_CATALOG));

    const result = JSON.parse(String(await invoke('phi'))) as {
      sourceUrl: string;
      total: number;
      matches: Array<{ name: string; tag?: string }>;
    };

    expect(globalThis.fetch).toHaveBeenCalledWith(
      KAITO_SUPPORTED_MODELS_URL,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(result.sourceUrl).toBe(KAITO_SUPPORTED_MODELS_URL);
    expect(result.total).toBe(1);
    expect(result.matches[0]).toMatchObject({ name: 'phi-4', tag: '0.2.0' });
  });

  it('supports "*" to list current preset models', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(makeResponse(SAMPLE_CATALOG));

    const result = JSON.parse(String(await invoke('*'))) as { total: number };

    expect(result.total).toBe(3);
  });

  it('ToolContribution logical name is core.search_kaito_models', () => {
    expect(searchKaitoModelsTool.name).toBe('core.search_kaito_models');
  });
});
