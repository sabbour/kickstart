/**
 * @file schema-conformance.test.ts
 * @suite pack-aks-automatic — OpenAI strict-mode schema conformance (#127)
 *
 * Guards all aks.* tool input schemas against OpenAI Responses API
 * strict-mode violations.  Phase 2 of #114 (parent: #127).
 */

import { describe, it } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  assertStrictlyConformant,
  type SchemaNode,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import { validateManifestsTool } from './validate-manifests.js';
import { validateSafeguardsTool } from './validate-safeguards.js';
import { buildArchitectureDiagramTool } from './build-architecture-diagram.js';

function getParams(t: { tool: unknown }): SchemaNode {
  return (t.tool as FunctionTool).parameters as SchemaNode;
}

describe('pack-aks-automatic tool input schemas — OpenAI strict-mode conformance (#127)', () => {
  it('aks.validate_manifests — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(validateManifestsTool), 'aks.validate_manifests');
  });

  it('aks.validate_safeguards — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(validateSafeguardsTool), 'aks.validate_safeguards');
  });

  it('aks.build_architecture_diagram — no strict-mode violations', () => {
    assertStrictlyConformant(
      getParams(buildArchitectureDiagramTool),
      'aks.build_architecture_diagram',
    );
  });
});
