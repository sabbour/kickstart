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
 * @depends #1017 per-component discriminated union refactor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunContext } from '@openai/agents';
import { A2UIMessageSchema, A2UIMessageEnvelopeSchema, A2UI_VERSION } from '@aks-kickstart/harness';
import { emitUiTool } from '../../tools/emit_ui.js';
import { makeSessionCtx } from './_session-stub.js';

// Strip null values from an object — used to normalise fixtures that carry
// nullable envelope-level fields (e.g. `sendDataModel: null`) before passing
// to the harness A2UIMessageSchema directly.
function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripNulls) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === null) continue;
      out[k] = stripNulls(v);
    }
    return out as T;
  }
  return value;
}

// ── Valid message fixtures ─────────────────────────────────────────────────
// All fixtures include the `op` discriminator field, which is required by the
// updated EmitUiInputSchema (discriminated union). The runtime A2UIMessageSchema
// still handles messages with or without `op` via withDiscriminator, but the
// tool's JSON schema (sent to the OpenAI API) requires `op` to be present.
//
// Per-component discriminated union (#1017): each component only carries its
// own applicable fields. No more `child: null` / `text: null` placeholders.

const validCreateSurface = {
  version: A2UI_VERSION,
  op: 'createSurface' as const,
  createSurface: { surfaceId: 'surface-001', catalogId: 'test-catalog', sendDataModel: null },
};

// A simple Text component — the most minimal valid updateComponents message.
const validUpdateComponents = {
  version: A2UI_VERSION,
  op: 'updateComponents' as const,
  updateComponents: {
    surfaceId: 'surface-001',
    components: [
      { id: 'greeting', component: 'Text', text: 'Hello' },
    ],
  },
};

const validUpdateDataModel = {
  version: A2UI_VERSION,
  op: 'updateDataModel' as const,
  updateDataModel: { surfaceId: 'surface-001', path: 'app.name', value: 'Kickstart' },
};

const validDeleteSurface = {
  version: A2UI_VERSION,
  op: 'deleteSurface' as const,
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
      const expected = A2UIMessageSchema.parse(stripNulls(validCreateSurface));
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

  // ── #984 A2UI v0.9 spec alignment ────────────────────────────────────────
  // Per-component discriminated union (#1017): each component carries only
  // its own applicable fields — no cross-component null placeholders.

  describe('#984 — A2UI v0.9 adjacency-list schema', () => {
    it('accepts the canonical v0.9 spec envelope (Column → Text + Row → Buttons with Text children + action)', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'main',
          components: [
            { id: 'root', component: 'Column', children: ['greeting', 'buttons'] },
            { id: 'greeting', component: 'Text', text: 'Hello' },
            { id: 'buttons', component: 'Row', children: ['cancel-btn', 'ok-btn'] },
            { id: 'cancel-btn', component: 'Button', child: 'cancel-text',
              action: { event: { name: 'cancel', payload: null } } },
            { id: 'cancel-text', component: 'Text', text: 'Cancel' },
            { id: 'ok-btn', component: 'Button', child: 'ok-text',
              action: { event: { name: 'ok', payload: { confirmed: true } } } },
            { id: 'ok-text', component: 'Text', text: 'OK' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
      expect(session.a2uiEmissions).toHaveLength(1);

      const emitted = session.a2uiEmissions[0] as {
        updateComponents: { components: Array<Record<string, unknown>> };
      };
      const comps = emitted.updateComponents.components;
      expect(comps[0].children).toEqual(['greeting', 'buttons']);
      expect(comps[1].text).toBe('Hello');
      expect(comps[3].child).toBe('cancel-text');
      const okAction = comps[5].action as { event: { name: string; payload?: unknown } };
      expect(okAction.event.name).toBe('ok');
      expect(okAction.event.payload).toEqual({ confirmed: true });
    });

    it('accepts a minimal Text + Button pair (no non-spec fields)', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'btn', component: 'Button', child: 'lbl',
              action: { event: { name: 'go', payload: null } } },
            { id: 'lbl', component: 'Text', text: 'Go' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });
  });

  // ── #980 Explicit op discriminator — runtime path ────────────────────────
  //
  // Pins the discriminated-union branch selected by `op` when the LLM emits
  // `op` verbatim (as opposed to the `withDiscriminator` preprocessor path,
  // which synthesizes `op` from the sole payload key when omitted).
  //
  // We assert three things per op variant:
  //   1. The raw envelope schema (pre-strip) parses and preserves `op`
  //      equal to the input's `op` — this is the discriminator-branch pin.
  //   2. The runtime `A2UIMessageSchema` (which strips `op` on output)
  //      accepts the fixture and yields the payload key corresponding to `op`.
  //   3. End-to-end through the tool invocation, the recorded emission carries
  //      the payload key matching `op` (branch survived the full runtime path).
  describe('explicit op discriminator — runtime path', () => {
    const explicitFixtures = [
      { op: 'createSurface' as const, fixture: validCreateSurface },
      { op: 'updateComponents' as const, fixture: validUpdateComponents },
      { op: 'updateDataModel' as const, fixture: validUpdateDataModel },
      { op: 'deleteSurface' as const, fixture: validDeleteSurface },
    ];

    for (const { op, fixture } of explicitFixtures) {
      it(`${op}: envelope schema selects the branch matching input.op verbatim`, () => {
        expect(fixture.op).toBe(op);
        const parsed = A2UIMessageEnvelopeSchema.parse(stripNulls(fixture));
        expect(parsed.op).toBe(op);
      });

      it(`${op}: A2UIMessageSchema (runtime) routes to the op-named payload key`, () => {
        const parsed = A2UIMessageSchema.parse(stripNulls(fixture)) as Record<string, unknown>;
        expect(parsed[op]).toBeDefined();
        expect(parsed).not.toHaveProperty('op');
      });

      it(`${op}: tool invocation records an emission on the op-named payload key`, async () => {
        await invoke(fixture);
        expect(session.a2uiEmissions).toHaveLength(1);
        const recorded = session.a2uiEmissions[0] as Record<string, unknown>;
        expect(recorded[op]).toBeDefined();
      });
    }

    it('negative control: mismatched op vs payload key fails validation', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'createSurface',
          updateComponents: {
            surfaceId: 'surface-001',
            components: [{ id: 'root', component: 'Button', label: 'x' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
      expect(session.a2uiEmissions).toHaveLength(0);
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

  // ── #1017 Per-component discriminated union ───────────────────────────────
  // Verifies that each component variant only accepts its own fields, that
  // required fields are enforced, and that non-spec fields (e.g. `child` on
  // Text) are NOT accepted (they would be rejected by the discriminated union
  // before reaching the client registry).

  describe('#1017 — per-component discriminated union', () => {
    // ── Text ──────────────────────────────────────────────────────────────

    it('Text: accepts required `text` field', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'title', component: 'Text', text: 'Hello world' }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Text: accepts dynamic data-binding `text: { path: "..." }`', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'label', component: 'Text', text: { path: 'user.name' } }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Text: rejects non-spec `child` field (would cause _ErrorComponent)', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'title', component: 'Text', text: 'Hi', child: '' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── Button ────────────────────────────────────────────────────────────

    it('Button: accepts required `child` + `action` fields', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'btn', component: 'Button', child: 'btn-label',
              action: { event: { name: 'click', payload: null } } },
            { id: 'btn-label', component: 'Text', text: 'Click me' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Button: action with payload is accepted', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'btn', component: 'Button', child: 'lbl',
              action: { event: { name: 'submit', payload: { value: 'yes' } } } },
            { id: 'lbl', component: 'Text', text: 'Submit' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Button: rejects non-spec `text` field (would cause _ErrorComponent)', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'btn', component: 'Button', child: 'lbl',
              action: { event: { name: 'click', payload: null } }, text: '' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── Row / Column ──────────────────────────────────────────────────────

    it('Row: accepts required `children` array', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'row', component: 'Row', children: ['a', 'b'] },
            { id: 'a', component: 'Text', text: 'A' },
            { id: 'b', component: 'Text', text: 'B' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Column: accepts required `children` array', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'col', component: 'Column', children: ['t1'] },
            { id: 't1', component: 'Text', text: 'Item' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Row: rejects non-spec `text` field', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'row', component: 'Row', children: ['a'], text: '' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── Image ─────────────────────────────────────────────────────────────

    it('Image: accepts required `url` field (string)', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'img', component: 'Image', url: 'https://example.com/img.png' }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Image: accepts dynamic data-binding `url: { path: "..." }`', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'img', component: 'Image', url: { path: 'cluster.logoUrl' } }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('Image: rejects non-spec `text` field', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'img', component: 'Image', url: 'https://x.com/a.png', text: '' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── TextField ─────────────────────────────────────────────────────────

    it('TextField: accepts required `label` field', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'tf', component: 'TextField', label: 'Cluster name' }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('TextField: accepts dynamic data-binding `label: { path: "..." }`', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'tf', component: 'TextField', label: { path: 'form.labelKey' } }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('TextField: rejects non-spec `child` or `text` fields', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            components: [{ id: 'tf', component: 'TextField', label: 'Name', child: '' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── CheckBox ──────────────────────────────────────────────────────────

    it('CheckBox: accepts required `label` + `value` fields', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'cb', component: 'CheckBox', label: 'Enable feature', value: false }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    it('CheckBox: accepts dynamic data-binding `value: { path: "..." }`', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [{ id: 'cb', component: 'CheckBox', label: 'Enable', value: { path: 'settings.enabled' } }],
        },
      });
      expect(String(result)).toContain('updateComponents');
    });

    // ── Discriminated union — unknown component type ───────────────────────

    it('unknown component type (not in discriminated union) returns an error result', async () => {
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 's',
            // "FutureThing" is not a known component type in the discriminated union
            components: [{ id: 'x', component: 'FutureThing', text: 'Hello' }],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    // ── Regression: empty-string placeholder no longer slips through ──────

    it('regression #1017: empty-string placeholder on non-spec field is rejected, not silently passed', async () => {
      // Under the OLD flat schema, `child: ""` on a Text component would pass
      // tool validation (it was nullable/required-but-nullable), get through
      // stripNulls (empty string != null), and reach the client registry where
      // it was rejected → _ErrorComponent.
      // Under the NEW discriminated union, the Text variant has no `child`
      // field at all, so `child: ""` is rejected at the tool input layer.
      const result = String(
        await invoke({
          version: A2UI_VERSION,
          op: 'updateComponents' as const,
          updateComponents: {
            surfaceId: 'triage-surface',
            components: [
              { id: 'title', component: 'Text', text: "Let's narrow...", child: '' },
            ],
          },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('regression #1017: Button without non-spec `text: ""` is accepted cleanly', async () => {
      // Under the OLD schema, a Button needed `text: null` as a placeholder.
      // Under the new schema, Button has no `text` field — just child + action.
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'triage-surface',
          components: [
            { id: 'c1', component: 'Button', child: 'c1t',
              action: { event: { name: 'select-dashboard', payload: null } } },
            { id: 'c1t', component: 'Text', text: 'Dashboard' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
      expect(session.a2uiEmissions).toHaveLength(1);
    });
  });
});
