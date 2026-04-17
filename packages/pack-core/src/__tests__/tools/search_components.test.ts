/**
 * @file search_components.test.ts
 * @suite Phase C — core.search_components tool
 *
 * Tests query filtering against the negotiated A2UI catalog.
 *
 * The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/search_components.ts (Phase C of #477).
 *
 * MIGRATION: once search_components.ts ships, replace the vi.mock block with:
 *   import { searchComponentsTool } from '../../tools/search_components.js';
 * and delete the mock factory below.
 *
 * @depends Phase C of #477
 * @depends SessionCtx.negotiatedCatalog (A2UICatalog)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSessionCtx } from './_session-stub.js';

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/search_components.js', () => {
  return {
    searchComponentsTool: {
      name: 'core.search_components',
      mcpExposed: false,
      tool: {
        name: 'core.search_components',
        description: 'Search for UI components available in the negotiated A2UI catalog.',
        execute: vi.fn(
          async (
            { query }: { query: string },
            runCtx?: { context?: ReturnType<typeof makeSessionCtx> } | ReturnType<typeof makeSessionCtx>,
          ): Promise<{ ok: boolean; results: string[] }> => {
            const session =
              runCtx && 'context' in (runCtx as object)
                ? (runCtx as { context: ReturnType<typeof makeSessionCtx> }).context
                : (runCtx as ReturnType<typeof makeSessionCtx> | undefined);

            const components = session?.negotiatedCatalog?.components ?? [];
            const normalised = query.trim().toLowerCase();
            const results = normalised
              ? [...components].filter((c) => c.toLowerCase().includes(normalised))
              : [...components];

            return { ok: true, results };
          },
        ),
      },
    },
  };
});

import { searchComponentsTool } from '../../tools/search_components.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.search_components', () => {
  const execute = () => searchComponentsTool.tool.execute;
  let session: ReturnType<typeof makeSessionCtx>;

  // The _session-stub catalog has: ['Button', 'Text', 'CodeBlock', 'AuthCard', 'ProgressSteps']

  beforeEach(() => {
    session = makeSessionCtx();
    vi.clearAllMocks();
  });

  // ── Query matching ────────────────────────────────────────────────────────

  describe('query matching component name', () => {
    it('returns matching component when query equals name (case-insensitive)', async () => {
      const result = await execute()({ query: 'Button' }, { context: session });

      expect(result.ok).toBe(true);
      expect(result.results).toContain('Button');
    });

    it('returns matching component for lowercase query', async () => {
      const result = await execute()({ query: 'button' }, { context: session });

      expect(result.results).toContain('Button');
    });

    it('returns matching component for partial match', async () => {
      const result = await execute()({ query: 'Block' }, { context: session });

      expect(result.results).toContain('CodeBlock');
    });

    it('returns only components whose name contains the query', async () => {
      const result = await execute()({ query: 'Auth' }, { context: session });

      expect(result.results).toEqual(['AuthCard']);
    });

    it('returns multiple results when query matches several names', async () => {
      // 'e' appears in Text, CodeBlock, ProgressSteps, AuthCard
      const result = await execute()({ query: 'e' }, { context: session });

      expect(result.results.length).toBeGreaterThan(1);
      expect(result.results).toContain('Text');
    });
  });

  // ── Empty query returns all ───────────────────────────────────────────────

  describe('empty query returns all components', () => {
    it('returns all catalog components for empty string', async () => {
      const result = await execute()({ query: '' }, { context: session });

      expect(result.ok).toBe(true);
      expect(result.results).toEqual([
        'Button',
        'Text',
        'CodeBlock',
        'AuthCard',
        'ProgressSteps',
      ]);
    });

    it('returns all components for whitespace-only query', async () => {
      const result = await execute()({ query: '   ' }, { context: session });

      expect(result.results).toHaveLength(5);
    });
  });

  // ── No match returns empty array ─────────────────────────────────────────

  describe('no match', () => {
    it('returns empty results array for query with no matches', async () => {
      const result = await execute()(
        { query: 'xyzzy-nonexistent' },
        { context: session },
      );

      expect(result.ok).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('returns empty array when catalog has no components', async () => {
      const emptySession = makeSessionCtx({
        negotiatedCatalog: { id: 'empty', components: [], userActions: [] },
      });

      const result = await execute()({ query: 'Button' }, { context: emptySession });

      expect(result.results).toEqual([]);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('tool name is core.search_components', () => {
      expect(searchComponentsTool.tool.name).toBe('core.search_components');
    });

    it('contribution name is core.search_components', () => {
      expect(searchComponentsTool.name).toBe('core.search_components');
    });
  });
});
