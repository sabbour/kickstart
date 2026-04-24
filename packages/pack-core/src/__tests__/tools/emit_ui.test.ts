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
    // #1075 / D11 — many existing tests invoke `updateComponents` /
    // `updateDataModel` / `deleteSurface` against a surfaceId without first
    // issuing a `createSurface`. The new idempotency guard requires the
    // target surface to be live, so we pre-seed the non-create-fixture
    // surfaceIds this file uses. `surface-001` is deliberately NOT preseeded
    // because fixtures exercise both `createSurface surface-001` (where the
    // id must start unused) and `updateComponents surface-001` standalone
    // (where it must start live) — the latter seeds inline.
    for (const id of ['main', 's', 'triage-surface', 'x']) {
      session.liveSurfaceIds.add(id);
    }
    vi.clearAllMocks();
  });

  // Convenience for the handful of tests that exercise a non-create fixture
  // on `surface-001` without a preceding createSurface.
  const seedSurface001 = () => session.liveSurfaceIds.add('surface-001');

  // ── Valid messages — return value ─────────────────────────────────────────

  describe('valid A2UI v0.9 messages — return value', () => {
    it('createSurface returns a string acknowledgement containing "createSurface"', async () => {
      const result = await invoke(validCreateSurface);
      expect(String(result)).toContain('createSurface');
    });

    it('updateComponents returns a string acknowledgement', async () => {
      seedSurface001();
      expect(String(await invoke(validUpdateComponents))).toContain('updateComponents');
    });

    it('updateDataModel returns a string acknowledgement', async () => {
      seedSurface001();
      expect(String(await invoke(validUpdateDataModel))).toContain('updateDataModel');
    });

    it('deleteSurface returns a string acknowledgement', async () => {
      seedSurface001();
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
      seedSurface001();
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
              action: { event: { name: 'ok', payload: {
                confirmed: true, id: null, value: null, action: null, target: null,
              } } } },
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

    // T2.5 (#1032 / DP Amendment #1, Nibbler N5) — closed-object payload:
    // unknown keys sent by the LLM must be silently stripped by zod BEFORE
    // the harness sees the message. OpenAI strict mode advertises
    // `additionalProperties: false`, but zod's default strip behaviour is
    // what enforces the contract at runtime. This locks in the stripping
    // semantic so a future `.passthrough()` or schema widening can't
    // regress it without a test failure.
    it('emit_ui: strips unknown payload keys (additionalProperties: false contract)', async () => {
      const result = await invoke({
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 's',
          components: [
            { id: 'btn', component: 'Button', child: 'lbl',
              action: { event: { name: 'ok', payload: {
                confirmed: true,
                id: null, value: null, action: null, target: null,
                // Unknown key — must be stripped, must NOT end up on the
                // recorded emission or the harness message.
                unknownKey: 'dropped',
              } as unknown as {
                confirmed: boolean | null;
                id: string | null;
                value: unknown;
                action: string | null;
                target: string | null;
              } } } },
            { id: 'lbl', component: 'Text', text: 'OK' },
          ],
        },
      });
      expect(String(result)).toContain('updateComponents');
      expect(session.a2uiEmissions).toHaveLength(1);

      const emitted = session.a2uiEmissions[0] as {
        updateComponents: { components: Array<Record<string, unknown>> };
      };
      const btn = emitted.updateComponents.components[0] as {
        action: { event: { name: string; payload: Record<string, unknown> } };
      };
      // stripNulls removes the null siblings, leaving only `confirmed`.
      expect(btn.action.event.payload).toEqual({ confirmed: true });
      expect(btn.action.event.payload).not.toHaveProperty('unknownKey');
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
        // #1075 — non-create ops need `surface-001` live; createSurface needs it NOT live.
        if (op !== 'createSurface') seedSurface001();
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
              action: { event: { name: 'submit', payload: {
                confirmed: null, id: null, value: 'yes', action: null, target: null,
              } } } },
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

  // ── #1075 / D11 — emit_ui idempotency + surface cap ─────────────────────
  //
  // Covers:
  //   • Leela DP v1 cases 1–5 (dedupe / distinct / update-before-create /
  //     delete-clears-slot / race proxy).
  //   • Nibbler's 5 additive conditions (parameterized missing-surface,
  //     recovery-path wording, parse-before-guard ordering, race sets
  //     assertion — condition 5 "skip appendComponents" is honoured by
  //     intentionally NOT adding such a test).
  //   • Leela DP v2 cases 7–9 (surfaceId length lower / upper bounds,
  //     session-scoped live-surface cap).

  describe('#1075 — surface lifecycle idempotency (D11)', () => {
    let freshSession: ReturnType<typeof makeSessionCtx>;
    const freshInvoke = (message: unknown) =>
      emitUiTool.tool.invoke(new RunContext(freshSession), JSON.stringify({ message }));

    beforeEach(() => {
      // Use an un-seeded session for this block so the guard semantics are
      // exercised end-to-end without the shared preseed.
      freshSession = makeSessionCtx();
    });

    // Leela v1 case 1
    it('rejects a second createSurface with the same surfaceId', async () => {
      const first = String(await freshInvoke(validCreateSurface));
      expect(first).toContain('createSurface');
      const second = String(await freshInvoke(validCreateSurface));
      expect(second).toMatch(/already exists/);
      expect(second).toMatch(/use updateComponents to modify it/);
      expect(freshSession.a2uiEmissions).toHaveLength(1);
      expect(freshSession.liveSurfaceIds.has('surface-001')).toBe(true);
    });

    // Leela v1 case 2
    it('createSurface on two distinct surfaceIds both succeed', async () => {
      await freshInvoke(validCreateSurface);
      await freshInvoke({
        ...validCreateSurface,
        createSurface: { ...validCreateSurface.createSurface, surfaceId: 'surface-002' },
      });
      expect(freshSession.a2uiEmissions).toHaveLength(2);
      expect(freshSession.liveSurfaceIds).toEqual(new Set(['surface-001', 'surface-002']));
    });

    // Leela v1 case 3 + Nibbler condition 1 (parameterized over three ops) +
    // Nibbler condition 2 (assert recovery-path wording, not just the throw).
    const nonCreateFixtures = [
      { op: 'updateComponents', fixture: validUpdateComponents },
      { op: 'updateDataModel', fixture: validUpdateDataModel },
      { op: 'deleteSurface', fixture: validDeleteSurface },
    ] as const;

    for (const { op, fixture } of nonCreateFixtures) {
      it(`${op} on a non-existent surface rejects with the recovery path in the message`, async () => {
        const result = String(await freshInvoke(fixture));
        expect(result).toMatch(/does not exist/);
        expect(result).toMatch(/call createSurface first/);
        expect(freshSession.a2uiEmissions).toHaveLength(0);
      });
    }

    // Assert the recovery-path wording on the duplicate-createSurface branch
    // too (Nibbler condition 2 for the create path).
    it('createSurface rejection message names updateComponents as the recovery path', async () => {
      await freshInvoke(validCreateSurface);
      const result = String(await freshInvoke(validCreateSurface));
      expect(result).toMatch(/use updateComponents to modify it/);
    });

    // Leela v1 case 4
    it('deleteSurface frees the slot — create → delete → create succeeds', async () => {
      await freshInvoke(validCreateSurface);
      await freshInvoke(validDeleteSurface);
      const third = String(await freshInvoke(validCreateSurface));
      expect(third).toContain('createSurface');
      expect(freshSession.a2uiEmissions).toHaveLength(3);
      expect(freshSession.liveSurfaceIds).toEqual(new Set(['surface-001']));
    });

    // Leela v1 case 5 + Nibbler condition 4 (assert the set + emissions, not
    // just thrown count). Two concurrent createSurface calls with the same
    // id — exactly one wins.
    it('race: two concurrent createSurface calls — exactly one wins', async () => {
      const results = await Promise.all([
        freshInvoke(validCreateSurface).then(String),
        freshInvoke(validCreateSurface).then(String),
      ]);
      const oks = results.filter((r) => r.includes('createSurface') && !/already exists/.test(r));
      const rejects = results.filter((r) => /already exists/.test(r));
      expect(oks).toHaveLength(1);
      expect(rejects).toHaveLength(1);
      expect(freshSession.liveSurfaceIds.size).toBe(1);
      expect(freshSession.a2uiEmissions).toHaveLength(1);
    });

    // Nibbler condition 3 — parse-before-guard ordering. A schema-invalid
    // payload whose surfaceId would otherwise dedupe must throw the
    // validation error (not the dedupe error), proving the guard cannot run
    // on un-validated input and cannot mutate the live set from a malformed
    // payload.
    it('schema validation runs before the guard (malformed envelope → invalid, not dedupe)', async () => {
      await freshInvoke(validCreateSurface);
      const malformed = String(
        await freshInvoke({
          version: A2UI_VERSION,
          op: 'createSurface' as const,
          // Missing `catalogId` — violates the schema.
          createSurface: { surfaceId: 'surface-001' },
        }),
      );
      expect(malformed).toMatch(/An error occurred|invalid/i);
      expect(malformed).not.toMatch(/already exists/);
      // Side-effect-free on malformed input.
      expect(freshSession.liveSurfaceIds.size).toBe(1);
      expect(freshSession.a2uiEmissions).toHaveLength(1);
    });

    // ── Leela DP v2 — surfaceId length bounds ─────────────────────────────

    // Case 7 — empty string rejects at schema layer.
    it('rejects empty surfaceId at schema layer', async () => {
      const result = String(
        await freshInvoke({
          version: A2UI_VERSION,
          op: 'createSurface' as const,
          createSurface: { surfaceId: '', catalogId: 'test-catalog', sendDataModel: null },
        }),
      );
      expect(result).toMatch(/An error occurred|invalid/i);
      expect(freshSession.a2uiEmissions).toHaveLength(0);
      expect(freshSession.liveSurfaceIds.size).toBe(0);
    });

    // Case 8 — 128 chars pass, 129 chars reject.
    it('accepts a 128-char surfaceId and rejects a 129-char one', async () => {
      const id128 = 'a'.repeat(128);
      const id129 = 'a'.repeat(129);
      const ok = String(
        await freshInvoke({
          version: A2UI_VERSION,
          op: 'createSurface' as const,
          createSurface: { surfaceId: id128, catalogId: 'test-catalog', sendDataModel: null },
        }),
      );
      expect(ok).toContain('createSurface');
      const bad = String(
        await freshInvoke({
          version: A2UI_VERSION,
          op: 'createSurface' as const,
          createSurface: { surfaceId: id129, catalogId: 'test-catalog', sendDataModel: null },
        }),
      );
      expect(bad).toMatch(/An error occurred|invalid/i);
      expect(freshSession.liveSurfaceIds.has(id128)).toBe(true);
      expect(freshSession.liveSurfaceIds.has(id129)).toBe(false);
    });

    // Case 9 — session-scoped live-surface cap, live-count semantics.
    it('enforces maxLiveSurfaces and releases slots on deleteSurface', async () => {
      // Override the cap to 3 via a dedicated session instance.
      const capped = makeSessionCtx({ maxLiveSurfaces: 3 });
      const capInvoke = (message: unknown) =>
        emitUiTool.tool.invoke(new RunContext(capped), JSON.stringify({ message }));

      const mk = (id: string) => ({
        version: A2UI_VERSION,
        op: 'createSurface' as const,
        createSurface: { surfaceId: id, catalogId: 'test-catalog', sendDataModel: null },
      });
      const del = (id: string) => ({
        version: A2UI_VERSION,
        op: 'deleteSurface' as const,
        deleteSurface: { surfaceId: id },
      });

      expect(String(await capInvoke(mk('a')))).toContain('createSurface');
      expect(String(await capInvoke(mk('b')))).toContain('createSurface');
      expect(String(await capInvoke(mk('c')))).toContain('createSurface');

      // Fourth create rejects with the cap error, naming the cap value.
      const fourth = String(await capInvoke(mk('d')));
      expect(fourth).toMatch(/session surface cap reached \(3\)/);
      expect(capped.a2uiEmissions).toHaveLength(3);
      expect(capped.liveSurfaceIds.size).toBe(3);

      // deleteSurface frees a slot → next create succeeds (cap is live-count,
      // not lifetime-count).
      expect(String(await capInvoke(del('a')))).toContain('deleteSurface');
      expect(capped.liveSurfaceIds.size).toBe(2);
      expect(String(await capInvoke(mk('d')))).toContain('createSurface');
      expect(capped.liveSurfaceIds).toEqual(new Set(['b', 'c', 'd']));
    });
  });

  // ── Rich component variants (#1130) ──────────────────────────────────────

  describe('rich component variants (DecisionCard, RadioGroup, Questionnaire)', () => {
    beforeEach(async () => {
      // Seed a surface for updateComponents calls
      await invoke(validCreateSurface);
    });

    it('DecisionCard with valid props is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'dc1',
            component: 'DecisionCard',
            title: 'Choose a track',
            recommendation: 'AKS Automatic is the way to go',
            rationale: null,
            alternatives: null,
            badge: null,
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('DecisionCard with all props is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'dc2',
            component: 'DecisionCard',
            title: 'Deploy options',
            recommendation: 'Use AKS Automatic',
            rationale: 'Fully managed, secure by default',
            alternatives: ['Static site', 'Container web app'],
            badge: 'recommended',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('DecisionCard rejects injected props (strict)', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'dc3',
            component: 'DecisionCard',
            title: 'Test',
            recommendation: 'Test',
            rationale: null,
            alternatives: null,
            badge: null,
            injected_prop: 'bad',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('RadioGroup with valid props is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'rg1',
            component: 'RadioGroup',
            options: [
              { id: 'opt1', label: 'Option 1', description: null, recommended: null },
              { id: 'opt2', label: 'Option 2', description: 'Second option', recommended: true },
            ],
            value: null,
            action: { event: { name: 'select', payload: null } },
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('RadioGroup rejects injected props (strict)', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'rg2',
            component: 'RadioGroup',
            options: [{ id: 'a', label: 'A', description: null, recommended: null }],
            value: null,
            action: { event: { name: 'pick', payload: null } },
            extra: 'nope',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('Questionnaire with valid props is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'q1',
            component: 'Questionnaire',
            questions: [
              { id: 'q-model', label: 'Which model?', type: 'choice', choices: [{ id: 'gpt4', label: 'GPT-4o' }], required: true },
              { id: 'q-desc', label: 'Describe your use case', type: null, choices: null, required: null },
            ],
            submitLabel: 'Continue',
            onSubmit: { event: { name: 'submit_answers', payload: null } },
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('Questionnaire rejects injected props (strict)', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'q2',
            component: 'Questionnaire',
            questions: [{ id: 'a', label: 'Q?', type: null, choices: null, required: null }],
            submitLabel: null,
            onSubmit: null,
            hackProp: true,
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toMatch(/An error occurred|invalid/i);
    });
  });

  // ── Phase B rich component variants (SummaryCard, ArchitectureDiagram) ──
  describe('rich component variants — Phase B (SummaryCard, ArchitectureDiagram)', () => {
    beforeEach(async () => {
      await invoke(validCreateSurface);
    });

    it('SummaryCard with minimal props is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'sc1',
            component: 'SummaryCard',
            title: 'Your AKS plan',
            items: [
              { label: 'Platform', value: 'AKS Automatic', badge: null },
            ],
            children: null,
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('SummaryCard with all props including children is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [
            {
              id: 'sc2',
              component: 'SummaryCard',
              title: 'Your AKS plan',
              items: [
                { label: 'Platform', value: 'AKS Automatic', badge: 'success' },
                { label: 'Cost', value: '~$420/mo', badge: 'info' },
              ],
              children: ['diagram-1'],
            },
            {
              id: 'diagram-1',
              component: 'ArchitectureDiagram',
              title: 'Solution Architecture',
              description: 'AKS with KAITO',
              diagram: null,
              nodes: [
                { id: 'aks', label: 'AKS Automatic', type: 'aks' },
                { id: 'kaito', label: 'KAITO Pod', type: null },
              ],
              edges: [
                { from: 'aks', to: 'kaito', label: 'inference' },
              ],
            },
          ],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('SummaryCard rejects injected props (strict)', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'sc3',
            component: 'SummaryCard',
            title: 'Test',
            items: [{ label: 'A', value: 'B', badge: null }],
            children: null,
            hackedField: 'bad',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('ArchitectureDiagram with diagram string is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'ad1',
            component: 'ArchitectureDiagram',
            diagram: 'graph TD\n  A-->B',
            nodes: null,
            edges: null,
            title: 'My Diagram',
            description: null,
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('ArchitectureDiagram with structured nodes/edges is accepted', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'ad2',
            component: 'ArchitectureDiagram',
            diagram: null,
            nodes: [
              { id: 'aks', label: 'AKS Automatic', type: 'aks' },
              { id: 'kaito', label: 'KAITO Pod', type: 'ai' },
              { id: 'ingress', label: 'Ingress', type: 'networking' },
              { id: 'storage', label: 'Azure Files', type: 'storage' },
            ],
            edges: [
              { from: 'ingress', to: 'aks', label: 'HTTPS' },
              { from: 'aks', to: 'kaito', label: 'inference' },
              { from: 'kaito', to: 'storage', label: 'model weights' },
            ],
            title: 'Solution Architecture',
            description: 'AKS Automatic with KAITO',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });

    it('ArchitectureDiagram rejects injected props (strict)', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [{
            id: 'ad3',
            component: 'ArchitectureDiagram',
            diagram: 'graph TD\n  A-->B',
            nodes: null,
            edges: null,
            title: null,
            description: null,
            extraField: 'nope',
          }],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toMatch(/An error occurred|invalid/i);
    });

    it('SummaryCard + ArchitectureDiagram + Buttons compose in adjacency list', async () => {
      const msg = {
        version: A2UI_VERSION,
        op: 'updateComponents' as const,
        updateComponents: {
          surfaceId: 'surface-001',
          components: [
            { id: 'root', component: 'Column', children: ['plan', 'actions'] },
            {
              id: 'plan',
              component: 'SummaryCard',
              title: 'Your AKS plan',
              items: [
                { label: 'Platform', value: 'AKS Automatic', badge: 'success' },
              ],
              children: ['arch'],
            },
            {
              id: 'arch',
              component: 'ArchitectureDiagram',
              title: 'Solution Architecture',
              description: null,
              diagram: null,
              nodes: [
                { id: 'aks', label: 'AKS', type: 'aks' },
                { id: 'app', label: 'App', type: null },
              ],
              edges: [{ from: 'aks', to: 'app', label: null }],
            },
            { id: 'actions', component: 'Row', children: ['approve', 'revise'] },
            { id: 'approve-text', component: 'Text', text: 'Looks right — generate' },
            {
              id: 'approve',
              component: 'Button',
              child: 'approve-text',
              action: {
                event: {
                  name: 'approve_plan',
                  payload: { confirmed: true, id: null, value: null, action: 'approve_plan', target: null },
                },
              },
            },
            { id: 'revise-text', component: 'Text', text: 'Revise' },
            {
              id: 'revise',
              component: 'Button',
              child: 'revise-text',
              action: {
                event: {
                  name: 'revise_plan',
                  payload: { confirmed: null, id: null, value: null, action: 'revise_plan', target: null },
                },
              },
            },
          ],
        },
      };
      const result = String(await invoke(msg));
      expect(result).toContain('updateComponents');
    });
  });
});
