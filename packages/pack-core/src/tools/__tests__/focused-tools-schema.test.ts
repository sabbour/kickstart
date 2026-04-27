/**
 * @file focused-tools-schema.test.ts
 * @suite strict-mode schema guard for the 4 focused UI tools (#112)
 *
 * Mirrors the emit_ui-schema.test.ts pattern.  Each new tool is walked for:
 *   T1 — no $ref node has sibling keywords
 *   T2 — assertStrictlyConformant() passes (OpenAI SDK transform)
 */

import { describe, it, expect } from 'vitest';
import type { FunctionTool } from '@openai/agents';
import {
  assertStrictlyConformant,
  walkSchema,
  getToolJsonSchema,
} from '@aks-kickstart/harness/runtime/schema-conformance';
import type { SchemaNode } from '@aks-kickstart/harness/runtime/schema-conformance';
import { showCardTool } from '../show_card.js';
import { showFormTool } from '../show_form.js';
import { confirmTool } from '../confirm.js';
import { navigateTool } from '../navigate.js';

const tools = [
  { name: 'core.show_card', tool: showCardTool },
  { name: 'core.show_form', tool: showFormTool },
  { name: 'core.confirm', tool: confirmTool },
  { name: 'core.navigate', tool: navigateTool },
] as const;

for (const { name, tool } of tools) {
  describe(`${name} schema — strict-mode guard (#112)`, () => {
    const schema = (tool.tool as FunctionTool).parameters as SchemaNode;

    it('T1: no $ref node has sibling keywords', () => {
      const violations: string[] = [];
      walkSchema(schema, 'root', (n, p) => {
        if ('$ref' in n && Object.keys(n).length > 1) {
          const siblings = Object.keys(n)
            .filter((k) => k !== '$ref')
            .join(', ');
          violations.push(`${p}: $ref has siblings {${siblings}}`);
        }
      });
      expect(
        violations,
        `${name}: $ref nodes with sibling keywords — OpenAI strict-mode will reject:\n  - ${violations.join('\n  - ')}`,
      ).toHaveLength(0);
    });

    it('T2: assertStrictlyConformant passes (OpenAI SDK transform)', () => {
      const jsonSchema = getToolJsonSchema(tool);
      expect(() => assertStrictlyConformant(jsonSchema as SchemaNode, name)).not.toThrow();
    });
  });
}
