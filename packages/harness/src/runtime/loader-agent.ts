import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { parseFrontmatterFile } from './frontmatter.js';
import type { AgentContribution, AsToolRef, ContributionSource, Handoff, ModelRef } from '../types/agent.js';
import type { Pack } from '../types/pack.js';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';

const modelRefSchema = z.union([
  z.object({ envVar: z.string().min(1) }).strict(),
  z.object({ id: z.string().min(1) }).strict(),
]);

const handoffSchema = z.object({
  label: z.string().min(1),
  agent: z.string().min(1),
  prompt: z.string().min(1).optional(),
  send: z.boolean().optional(),
  model: modelRefSchema.optional(),
}).strict();

const asToolRefSchema = z.object({
  agent: z.string().min(1),
  description: z.string().min(1).optional(),
  toolName: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  maxTurns: z.number().int().min(1).optional(),
}).strict();

const agentFrontmatterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  model: modelRefSchema,
  tools: z.array(z.string().min(1)).default([]),
  userActions: z.array(z.string().min(1)).default([]).optional(),
  handoffs: z.array(handoffSchema).default([]),
  asTools: z.array(asToolRefSchema).optional(),
  'user-invocable': z.boolean().default(false),
  'model-invocable': z.boolean().optional(),
  'disable-model-invocation': z.boolean().optional(),
  'x-kickstart': z.object({
    mcpExposed: z.boolean().optional(),
  }).strict().optional(),
}).strict();

export interface AgentLoadScope {
  tools: ReadonlyMap<string, ToolContribution>;
  userActions: ReadonlyMap<string, UserActionContribution>;
}

function assertPackOwnedAgentName(pack: Pack, name: string): void {
  if (!name.startsWith(`${pack.name}.`)) {
    throw new Error(`Agent ${name} must be namespaced under pack ${pack.name}.`);
  }
}

function validatePathLikeName(value: string, label: string): string {
  if (value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new Error(`${label} contains an invalid path-like segment: ${value}`);
  }
  return value;
}

function relativeSourcePath(baseDir: string, filePath: string): ContributionSource {
  return {
    kind: 'file',
    path: relative(resolve(baseDir), resolve(filePath)).replace(/\\/g, '/'),
  };
}

function resolveToolAllowlist(
  pack: Pack,
  requested: readonly string[],
  scope: AgentLoadScope,
): string[] {
  return requested.map((reference) => {
    if (reference.includes('..')) {
      throw new Error(`Tool reference contains invalid traversal segment: ${reference}`);
    }

    if (reference.includes(':')) {
      const userAction = scope.userActions.get(reference);
      if (!userAction) {
        throw new Error(`Unresolved user action reference for ${pack.name}: ${reference}`);
      }
      return userAction.name;
    }

    if (!reference.includes('.')) {
      throw new Error(`Unsupported allowlist reference sigil for ${reference}`);
    }

    const tool = scope.tools.get(reference);
    if (!tool) {
      throw new Error(`Unresolved tool reference for ${pack.name}: ${reference}`);
    }
    return tool.name;
  });
}

export function loadAgentFile(
  pack: Pack,
  filePath: string,
  scope: AgentLoadScope,
): AgentContribution {
  const baseDir = pack.agentsDir ? fileURLToPath(pack.agentsDir) : undefined;
  if (!baseDir) {
    throw new Error(`Pack ${pack.name} has no agentsDir configured.`);
  }

  const { attributes, body } = parseFrontmatterFile(baseDir, filePath);
  const parsed = agentFrontmatterSchema.parse(attributes);
  validatePathLikeName(parsed.name, 'Agent name');
  assertPackOwnedAgentName(pack, parsed.name);
  if (parsed['model-invocable'] !== undefined && parsed['disable-model-invocation'] !== undefined) {
    throw new Error(
      `Agent ${parsed.name} cannot declare both "model-invocable" and "disable-model-invocation".`,
    );
  }
  const modelInvocable = parsed['model-invocable'] ?? !parsed['disable-model-invocation'];
  const allowlist = [...parsed.tools, ...(parsed.userActions ?? [])];

  return {
    name: parsed.name,
    description: parsed.description,
    model: parsed.model as ModelRef,
    toolAllowlist: resolveToolAllowlist(pack, allowlist, scope),
    handoffs: parsed.handoffs as Handoff[],
    ...(parsed.asTools && parsed.asTools.length > 0 ? { asTools: parsed.asTools as AsToolRef[] } : {}),
    userInvocable: parsed['user-invocable'],
    modelInvocable,
    instructionsBase: body,
    outputType: 'AgentOutput',
    ...(parsed['x-kickstart']?.mcpExposed !== undefined ? { mcpExposed: parsed['x-kickstart'].mcpExposed } : {}),
    source: relativeSourcePath(baseDir, filePath),
  };
}
