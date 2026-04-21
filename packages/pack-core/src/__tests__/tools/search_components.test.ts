/**
 * @file search_components.test.ts
 * @suite Phase C — core.search_components tool
 *
 * Tests query filtering against a ComponentRegistry using the
 * createSearchComponentsTool factory.
 * Tool is invoked via FunctionTool.invoke(runCtx, jsonInput).
 *
 * @depends Phase C of #477 (search_components.ts must exist)
 * @depends ComponentContribution shape from @aks-kickstart/harness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { RunContext } from '@openai/agents';
import { createSearchComponentsTool, type ComponentRegistry } from '../../tools/search_components.js';
import { makeSessionCtx } from './_session-stub.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRegistry(names: string[]): ComponentRegistry {
  return {
    components: names.map((name) => ({
      name,
      propertySchema: z.object({}),
      renderer: null,
    })),
  };
}

const CATALOG_NAMES = ['Button', 'Text', 'CodeBlock', 'AuthCard', 'ProgressSteps'];

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.search_components', () => {
  let tool: ReturnType<typeof createSearchComponentsTool>;

  const invoke = (query: string) =>
    tool.tool.invoke(new RunContext(makeSessionCtx()), JSON.stringify({ query }));

  beforeEach(() => {
    tool = createSearchComponentsTool(makeRegistry(CATALOG_NAMES));
  });

  // ── Query matching ────────────────────────────────────────────────────────

  describe('query matching component name', () => {
    it('returns JSON with matching component when query equals name (case-insensitive)', async () => {
      const raw = await invoke('Button');
      const result = JSON.parse(String(raw));
      expect(result.matches).toEqual(expect.arrayContaining([{ name: 'Button' }]));
    });

    it('returns matching component for lowercase query', async () => {
      const raw = await invoke('button');
      const result = JSON.parse(String(raw));
      const names = result.matches.map((m: { name: string }) => m.name);
      expect(names).toContain('Button');
    });

    it('returns matching component for partial match', async () => {
      const raw = await invoke('Block');
      const result = JSON.parse(String(raw));
      const names = result.matches.map((m: { name: string }) => m.name);
      expect(names).toContain('CodeBlock');
    });

    it('returns only components whose name contains the query', async () => {
      const raw = await invoke('Auth');
      const result = JSON.parse(String(raw));
      const names = result.matches.map((m: { name: string }) => m.name);
      expect(names).toEqual(['AuthCard']);
    });

    it('total field matches the number of matches', async () => {
      const raw = await invoke('Button');
      const result = JSON.parse(String(raw));
      expect(result.total).toBe(result.matches.length);
    });
  });

  // ── Wildcard "*" returns all components ──────────────────────────────────

  describe('"*" query returns all components', () => {
    it('returns all catalog components for "*"', async () => {
      const raw = await invoke('*');
      const result = JSON.parse(String(raw));
      const names = result.matches.map((m: { name: string }) => m.name).sort();
      expect(names).toEqual([...CATALOG_NAMES].sort());
    });

    it('total equals the full catalog size', async () => {
      const raw = await invoke('*');
      const result = JSON.parse(String(raw));
      expect(result.total).toBe(CATALOG_NAMES.length);
    });
  });

  // ── No match returns empty array ─────────────────────────────────────────

  describe('no match', () => {
    it('returns JSON with empty matches array for query with no matches', async () => {
      const raw = await invoke('xyzzy-nonexistent');
      const result = JSON.parse(String(raw));
      expect(Array.isArray(result.matches)).toBe(true);
      expect(result.matches).toHaveLength(0);
    });

    it('returns empty matches when registry is empty', async () => {
      const emptyTool = createSearchComponentsTool(makeRegistry([]));
      const raw = await emptyTool.tool.invoke(
        new RunContext(makeSessionCtx()),
        JSON.stringify({ query: 'Button' }),
      );
      const result = JSON.parse(String(raw));
      expect(result.matches).toHaveLength(0);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_search_components', () => {
      expect(tool.tool.name).toBe('core_search_components');
    });

    it('contribution name is core.search_components', () => {
      expect(tool.name).toBe('core.search_components');
    });
  });
});
