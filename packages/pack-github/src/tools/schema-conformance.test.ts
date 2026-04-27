/**
 * @file schema-conformance.test.ts
 * @suite pack-github — OpenAI strict-mode schema conformance (#127)
 *
 * Guards all github.* tool input schemas against OpenAI Responses API
 * strict-mode violations.  Phase 2 of #114 (parent: #127).
 */

import { describe, it } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  assertStrictlyConformant,
  type SchemaNode,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import { apiGetTool } from './api-get.js';

function getParams(t: { tool: unknown }): SchemaNode {
  return (t.tool as FunctionTool).parameters as SchemaNode;
}

describe('pack-github tool input schemas — OpenAI strict-mode conformance (#127)', () => {
  it('github.api_get — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(apiGetTool), 'github.api_get');
  });
});
