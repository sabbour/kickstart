/**
 * @file emit_ui.test.ts
 * @suite Phase C — core.emit_ui tool
 *
 * Tests A2UI v0.9 message validation, session recording, and error handling
 * against the real implementation.
 *
 * NOTE: The SDK wraps execution errors in a string result rather than
 * rejecting. Error-case tests check the returned string.
 *
 * @depends Phase C of #477 (emit_ui.ts must exist)
 * @depends #475 A2UIMessageSchema on @aks-kickstart/harness
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { A2UIMessageSchema, A2UI_VERSION } from '@aks-kickstart/harness';
import { emitUiTool } from '../../tools/emit_ui.js';
import { makeSessionCtx } from './_session-stub.js';

// ── Valid message fixtures ─────────────────────────────────────────────────

const validCreateSurface = {
  version: A2UI_VERSION,
  createSurface: { surfaceId: 'surface-001', catalogId: 'test-catalog' },
};

const validUpdateComponents = {
  version: A2UI_VERSION,
  updateComponents: {
    surfaceId: 'surface-001',
    components: [{ type: 'Button', label: 'Click me' }],
  },
};

const validUpdateDataModel = {
  version: A2UI_VERSION,
  updateDataModel: { surfaceId: 'surface-001', path: 'app.name', value: 'Kickstart' },
};

const validDeleteSurface = {
  version: A2UI_VERSION,
  deleteSurface: { surfaceId: 'surface-001' },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.emit_ui', () => {
  let session: ReturnType<typeof makeSessionCtx>;

  const invoke = (message: unknown) =>
    emitUiTool.tool.invoke(new RunContext(session), JSON.stringify({ message }));

  beforeEach(() => {
    session = makeSessionCtx();
    vi.clearAllMocks();
  });

  // ── Valid messages — return value ─────────────────────────────────────────

  describe('valid A2UI v0.9 messages — return value', () => {
    it('createSurface returns a string acknowledgement containing "createSurface"', async () => {
      const result = await invoke(validCreateSurface);
      expect(String(result)).toContain('createSurface');
    });

    it('updateComponents returns a string acknowledgement', async () => {
      expect(String(await invoke(validUpdateComponents))).toContain('updateComponents');
    });

    it('updateDataModel returns a string acknowledgement', async () => {
      expect(String(await invoke(validUpdateDataModel))).toContain('updateDataModel');
    });

    it('deleteSurface returns a string acknowledgement', async () => {
      expect(String(await invoke(validDeleteSurface))).toContain('deleteSurface');
    });
  });

  // ── Valid messages — session recording ────────────────────────────────────

  describe('valid A2UI v0.9 messages — session recording', () => {
    it('createSurface pushes exactly one entry onto session.a2uiEmissions', async () => {
      await invoke(validCreateSurface);
      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('updateComponents is recorded on the session', async () => {
      await invoke(validUpdateComponents);
      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('the recorded emission equals the A2UIMessageSchema-parsed output', async () => {
      await invoke(validCreateSurface);
      const expected = A2UIMessageSchema.parse(validCreateSurface);
      expect(session.a2uiEmissions[0]).toEqual(expected);
    });
  });

  // ── Multiple emissions accumulate in order ────────────────────────────────

  describe('multiple emissions accumulate in array order', () => {
    it('two calls accumulate two entries in order', async () => {
      await invoke(validCreateSurface);
      await invoke(validUpdateComponents);
      expect(session.a2uiEmissions).toHaveLength(2);
    });

    it('three calls preserve insertion order', async () => {
      await invoke(validCreateSurface);
      await invoke(validUpdateDataModel);
      await invoke(validDeleteSurface);
      expect(session.a2uiEmissions).toHaveLength(3);
    });
  });

  // ── Invalid messages → error string ──────────────────────────────────────

  describe('invalid message → error result string', () => {
    it('wrong version returns an error result', async () => {
      const result = String(
        await invoke({ version: 'v0.1', createSurface: { surfaceId: 'x', catalogId: 'y' } }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('unknown op key returns an error result', async () => {
      const result = String(
        await invoke({ version: A2UI_VERSION, unknownOp: { surfaceId: 'x' } }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('createSurface missing surfaceId returns an error result', async () => {
      const result = String(
        await invoke({ version: A2UI_VERSION, createSurface: { catalogId: 'cat' } }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('updateComponents with empty components array returns an error result', async () => {
      const result = String(
        await invoke({ version: A2UI_VERSION, updateComponents: { surfaceId: 'x', components: [] } }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('does not push to a2uiEmissions when message is invalid', async () => {
      await invoke({ version: A2UI_VERSION, badOp: {} });
      expect(session.a2uiEmissions).toHaveLength(0);
    });

    it('null message returns an error result', async () => {
      const result = String(await invoke(null));
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('empty object returns an error result', async () => {
      const result = String(await invoke({}));
      expect(result).toMatch(/An error occurred|invalid/i);
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('SDK tool name is core_emit_ui', () => {
      expect(emitUiTool.tool.name).toBe('core_emit_ui');
    });

    it('ToolContribution logical name is core.emit_ui', () => {
      expect(emitUiTool.name).toBe('core.emit_ui');
    });
  });
});
