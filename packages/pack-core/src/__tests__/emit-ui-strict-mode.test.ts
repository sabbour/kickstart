/**
 * @file emit-ui-strict-mode.test.ts
 * @suite OpenAI strict-mode regressions for `core.emit_ui` (#998, #1032)
 *
 * The universal pack-wide schema-conformance test in
 * `packages/web/api/src/startup/schema-conformance.test.ts` already walks
 * every registered tool — including `core.emit_ui` — through the four
 * shared invariant collectors in
 * `@aks-kickstart/harness/runtime/schema-conformance`. That makes the old
 * per-pack hand-rostered conformance suites redundant.
 *
 * What stays here is exactly the part the universal walker can't express:
 *
 *   - T4 (#1032) — a negative-control proof that a tool with `z.record(...)`
 *     in its parameters trips the walker. This guards the walker itself,
 *     not pack-core, but it is the cheapest place to keep the regression
 *     anchored to the original bug.
 *   - T5 (#1032) — `emit_ui.action.event.payload` retains its nullable
 *     `anyOf: [..., { type: 'null' }]` wrapper after the SDK converter.
 *     A schema lint, not a regression catch (the "nullable dropped" claim
 *     in the original DP was retracted in Amendment #1, N3).
 *   - #998 — the `createSurface` discriminated-union branch of `emit_ui`
 *     keeps `sendDataModel` in `required`. Targeted because the original
 *     bug was specifically about an optional field buried under
 *     `z.discriminatedUnion`.
 *
 * Originally requested by Nibbler (QA) on DP #998 / DP #1032 / Amendment #1.
 */

import { describe, it, expect } from 'vitest';
import { tool } from '@openai/agents';
import { z } from 'zod';
import type { FunctionTool } from '@openai/agents';
import {
  collectMissingProperties,
  collectAdditionalPropertiesViolations,
  walkSchema,
  getToolJsonSchema,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import type { SchemaNode } from '@aks-kickstart/harness/runtime/schema-conformance';
import { emitUiTool } from '../tools/index.js';

describe('core.emit_ui — OpenAI strict-mode regressions (#998, #1032)', () => {
  // T5 — emit_ui.action.event.payload retains its nullable wrapper.
  it('T5: action.event.payload keeps anyOf[..., {type:null}] after conversion (#1032)', () => {
    const schema = getToolJsonSchema(emitUiTool) as SchemaNode;
    expect(schema).toBeTruthy();

    const nullableHits: string[] = [];
    walkSchema(schema, 'root', (node, path) => {
      if (!path.endsWith('.payload')) return;
      const anyOfHasNull =
        Array.isArray(node.anyOf) && (node.anyOf as SchemaNode[]).some((b) => b.type === 'null');
      const typeArrayHasNull =
        Array.isArray(node.type) && (node.type as unknown[]).includes('null');
      if (anyOfHasNull || typeArrayHasNull) {
        nullableHits.push(path);
      }
    });

    expect(
      nullableHits.length,
      'emit_ui payload should carry a nullable wrapper (anyOf with type:null, or type array including null) somewhere in the schema',
    ).toBeGreaterThan(0);
  });

  // T4 — negative control. A tool with `z.record(...)` in its parameters
  // MUST be flagged by the shared walker for invariants I1 and/or I3.
  it('T4: walker flags z.record(...) parameter trees as strict-mode violations (#1032)', () => {
    const badTool = tool({
      name: 'negative_control_record',
      description: 'Intentionally bad shape — z.record does not satisfy strict mode.',
      parameters: z.object({
        // Exact shape that broke #1032: open-keyed record.
        bag: z.record(z.string(), z.string()),
      }),
      // eslint-disable-next-line @typescript-eslint/require-await
      execute: async () => 'noop',
    });
    const schema = (badTool as FunctionTool).parameters as SchemaNode;

    const missingProps = collectMissingProperties(schema);
    const apViolations = collectAdditionalPropertiesViolations(schema);
    expect(
      missingProps.length + apViolations.length,
      'walker must flag z.record(...) as a strict-mode violation',
    ).toBeGreaterThan(0);
  });

  // #998 — drill into the `createSurface` discriminated-union branch.
  it('createSurface branch includes sendDataModel in required (#998)', () => {
    const schema = getToolJsonSchema(emitUiTool);
    expect(schema).toBeTruthy();

    const message = (schema as Record<string, unknown>).properties as Record<string, unknown>;
    const msgSchema = message.message as Record<string, unknown>;
    const branches = (msgSchema.anyOf ?? msgSchema.oneOf) as Array<Record<string, unknown>>;
    const createSurfaceBranch = branches.find((b) => {
      const props = b.properties as Record<string, Record<string, unknown>> | undefined;
      return props?.op?.const === 'createSurface';
    });
    expect(createSurfaceBranch, 'createSurface branch not found').toBeTruthy();
    const csObj = (createSurfaceBranch!.properties as Record<string, Record<string, unknown>>)
      .createSurface;
    expect(csObj.required).toContain('sendDataModel');
  });
});
