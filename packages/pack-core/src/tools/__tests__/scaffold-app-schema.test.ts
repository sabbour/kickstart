/**
 * @file scaffold-app-schema.test.ts
 * @suite core.scaffold_app — OpenAI strict-mode schema conformance (#127)
 *
 * Guards the scaffold_app tool input schema against Responses API strict-mode
 * violations (I2: all properties in required, I3: additionalProperties:false).
 * The ProposedServicesSchema and PlanSchema previously used .passthrough()
 * (I3 violation) and .optional() without .nullable() (I2 violation).
 *
 * Phase 2 of #114 (parent: #127).
 */

import { describe, it } from 'vitest';
import { tool } from '@openai/agents';
import type { FunctionTool } from '@openai/agents';
import {
  assertStrictlyConformant,
  type SchemaNode,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import { ScaffoldAppInputSchema } from '../scaffold_app.js';

// Materialise the JSON schema the same way the SDK does at runtime.
const _probe = tool({
  name: 'core_scaffold_app_schema_probe',
  description: 'Schema conformance probe — not a real tool',
  parameters: ScaffoldAppInputSchema,
  // eslint-disable-next-line @typescript-eslint/require-await
  execute: async () => 'unused',
}) as unknown as FunctionTool;

const scaffoldAppSchema = _probe.parameters as SchemaNode;

describe('core.scaffold_app input schema — OpenAI strict-mode conformance (#127)', () => {
  it('has no strict-mode violations (I2: required, I3: additionalProperties)', () => {
    assertStrictlyConformant(scaffoldAppSchema, 'core.scaffold_app');
  });
});
