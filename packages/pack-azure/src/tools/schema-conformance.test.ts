/**
 * @file schema-conformance.test.ts
 * @suite pack-azure — OpenAI strict-mode schema conformance (#127)
 *
 * Guards all azure.* tool input schemas against OpenAI Responses API
 * strict-mode violations using the SDK's own `toStrictJsonSchema()` transform
 * (via `assertStrictlyConformant()`).  A single violation causes the entire
 * /api/converse path to fail at runtime — this suite catches them at authoring
 * time.
 *
 * Phase 2 of #114 (parent: #127).
 */

import { describe, it } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  assertStrictlyConformant,
  type SchemaNode,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import { validateBicepTool } from './validate-bicep.js';
import { pricingLookupTool } from './pricing-lookup.js';
import { estimateCostTool } from './estimate-cost.js';
import { whatIfTool } from './what-if.js';
import { proposeServicesTool } from './propose-services.js';
import { armGetTool } from './arm-get.js';
import { armUpdateResourceTool } from './arm-update-resource.js';
import { armDeployResourceTool } from './arm-deploy-resource.js';

function getParams(t: { tool: unknown }): SchemaNode {
  return (t.tool as FunctionTool).parameters as SchemaNode;
}

describe('pack-azure tool input schemas — OpenAI strict-mode conformance (#127)', () => {
  it('azure.validate_bicep — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(validateBicepTool), 'azure.validate_bicep');
  });

  it('azure.pricing_lookup — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(pricingLookupTool), 'azure.pricing_lookup');
  });

  it('azure.estimate_cost — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(estimateCostTool), 'azure.estimate_cost');
  });

  it('azure.what_if — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(whatIfTool), 'azure.what_if');
  });

  it('azure.propose_services — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(proposeServicesTool), 'azure.propose_services');
  });

  it('azure.arm_get — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(armGetTool), 'azure.arm_get');
  });

  it('azure.arm_update_resource — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(armUpdateResourceTool), 'azure.arm_update_resource');
  });

  it('azure.arm_deploy_resource — no strict-mode violations', () => {
    assertStrictlyConformant(getParams(armDeployResourceTool), 'azure.arm_deploy_resource');
  });
});
