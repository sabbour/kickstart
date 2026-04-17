/**
 * @file emit_ui.test.ts
 * @suite Phase C — core.emit_ui tool
 *
 * Tests A2UI v0.9 message validation, session recording, and Zod rejection
 * of malformed messages.
 *
 * The tool module is stubbed via vi.mock until Fry ships
 * packages/pack-core/src/tools/emit_ui.ts (Phase C of #477).
 *
 * MIGRATION: once emit_ui.ts ships, replace the vi.mock block with:
 *   import { emitUiTool } from '../../tools/emit_ui.js';
 * and delete the mock factory below.
 *
 * @depends Phase C of #477
 * @depends #475 A2UIMessageSchema on @kickstart/harness
 * @depends #476 SessionCtx.recordA2UIEmission
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { A2UIMessageSchema, A2UI_VERSION } from '@kickstart/harness';
import { makeSessionCtx } from './_session-stub.js';

// ── Module stub (remove when Phase C ships) ──────────────────────────────────

vi.mock('../../tools/emit_ui.js', async () => {
  const { A2UIMessageSchema } = await import('@kickstart/harness');
  const { ZodError } = await import('zod');

  return {
    emitUiTool: {
      name: 'core.emit_ui',
      mcpExposed: false,
      tool: {
        name: 'core.emit_ui',
        description: 'Emit an A2UI v0.9 message to the session UI channel.',
        execute: vi.fn(
          async (
            { message }: { message: unknown },
            runCtx?: { context?: ReturnType<typeof makeSessionCtx> } | ReturnType<typeof makeSessionCtx>,
          ): Promise<{ ok: boolean; error?: string }> => {
            const parsed = A2UIMessageSchema.safeParse(message);
            if (!parsed.success) {
              throw new ZodError(parsed.error.issues);
            }
            // Support both { context: session } (SDK RunContext) and direct session
            const session =
              runCtx && 'context' in (runCtx as object)
                ? (runCtx as { context: ReturnType<typeof makeSessionCtx> }).context
                : (runCtx as ReturnType<typeof makeSessionCtx> | undefined);
            session?.recordA2UIEmission(parsed.data);
            return { ok: true };
          },
        ),
      },
    },
  };
});

import { emitUiTool } from '../../tools/emit_ui.js';

// ── Valid message fixtures ─────────────────────────────────────────────────

const validCreateSurface = {
  version: A2UI_VERSION,
  createSurface: {
    surfaceId: 'surface-001',
    catalogId: 'test-catalog',
  },
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
  updateDataModel: {
    surfaceId: 'surface-001',
    path: 'app.name',
    value: 'Kickstart',
  },
};

const validDeleteSurface = {
  version: A2UI_VERSION,
  deleteSurface: {
    surfaceId: 'surface-001',
  },
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('core.emit_ui', () => {
  const execute = () => emitUiTool.tool.execute;
  let session: ReturnType<typeof makeSessionCtx>;

  beforeEach(() => {
    session = makeSessionCtx();
    vi.clearAllMocks();
  });

  // ── Valid A2UI v0.9 messages ──────────────────────────────────────────────

  describe('valid A2UI v0.9 messages', () => {
    it('createSurface message returns { ok: true }', async () => {
      const result = await execute()(
        { message: validCreateSurface },
        { context: session },
      );
      expect(result.ok).toBe(true);
    });

    it('createSurface pushes one entry onto session.a2uiEmissions', async () => {
      await execute()({ message: validCreateSurface }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('updateComponents message is recorded on session', async () => {
      await execute()({ message: validUpdateComponents }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('updateDataModel message is recorded on session', async () => {
      await execute()({ message: validUpdateDataModel }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('deleteSurface message is recorded on session', async () => {
      await execute()({ message: validDeleteSurface }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(1);
    });

    it('the recorded emission equals the A2UIMessageSchema-parsed output', async () => {
      await execute()({ message: validCreateSurface }, { context: session });

      const expected = A2UIMessageSchema.parse(validCreateSurface);
      expect(session.a2uiEmissions[0]).toEqual(expected);
    });
  });

  // ── Multiple emissions accumulate in order ────────────────────────────────

  describe('multiple emissions', () => {
    it('two calls accumulate two entries in order', async () => {
      await execute()({ message: validCreateSurface }, { context: session });
      await execute()({ message: validUpdateComponents }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(2);
    });

    it('three calls preserve insertion order', async () => {
      await execute()({ message: validCreateSurface }, { context: session });
      await execute()({ message: validUpdateDataModel }, { context: session });
      await execute()({ message: validDeleteSurface }, { context: session });

      expect(session.a2uiEmissions).toHaveLength(3);
      // Verify they arrived in order by checking the op discriminator on parsed output
      const ops = session.a2uiEmissions.map((e: Record<string, unknown>) => Object.keys(e)[0]);
      expect(ops).toEqual(['createSurface', 'updateDataModel', 'deleteSurface']);
    });
  });

  // ── Zod rejection — invalid messages ────────────────────────────────────

  describe('invalid messages → Zod rejection', () => {
    it('rejects a message with wrong version', async () => {
      await expect(
        execute()(
          { message: { version: 'v0.1', createSurface: { surfaceId: 'x', catalogId: 'y' } } },
          { context: session },
        ),
      ).rejects.toThrow();
    });

    it('rejects a message with unknown op key', async () => {
      await expect(
        execute()(
          { message: { version: A2UI_VERSION, unknownOp: { surfaceId: 'x' } } },
          { context: session },
        ),
      ).rejects.toThrow();
    });

    it('rejects createSurface missing required surfaceId', async () => {
      await expect(
        execute()(
          { message: { version: A2UI_VERSION, createSurface: { catalogId: 'cat' } } },
          { context: session },
        ),
      ).rejects.toThrow();
    });

    it('rejects updateComponents with empty components array', async () => {
      await expect(
        execute()(
          {
            message: {
              version: A2UI_VERSION,
              updateComponents: { surfaceId: 'x', components: [] },
            },
          },
          { context: session },
        ),
      ).rejects.toThrow();
    });

    it('does not push to a2uiEmissions when message is invalid', async () => {
      await expect(
        execute()(
          { message: { version: A2UI_VERSION, badOp: {} } },
          { context: session },
        ),
      ).rejects.toThrow();

      expect(session.a2uiEmissions).toHaveLength(0);
    });

    it('rejects null message', async () => {
      await expect(
        execute()({ message: null }, { context: session }),
      ).rejects.toThrow();
    });

    it('rejects completely empty object', async () => {
      await expect(
        execute()({ message: {} }, { context: session }),
      ).rejects.toThrow();
    });
  });

  // ── Metadata ──────────────────────────────────────────────────────────────

  describe('ToolContribution shape', () => {
    it('tool name is core.emit_ui', () => {
      expect(emitUiTool.tool.name).toBe('core.emit_ui');
    });

    it('contribution name is core.emit_ui', () => {
      expect(emitUiTool.name).toBe('core.emit_ui');
    });
  });
});
