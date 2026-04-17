import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadAgentFile } from '../runtime/loader-agent.js';
import { loadSkillFile } from '../runtime/loader-skill.js';
import { PackRegistry } from '../runtime/registry.js';
import type { Pack } from '../types/pack.js';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';

const fixtureRoot = join(process.cwd(), 'packages', 'harness', '.registry-test-fixtures');

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function writeFixture(relativePath: string, content: string): string {
  const fullPath = join(fixtureRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function fileDir(relativePath: string): URL {
  const fullPath = join(fixtureRoot, relativePath);
  mkdirSync(fullPath, { recursive: true });
  return pathToFileURL(`${fullPath}/`);
}

function makeTool(name: string): ToolContribution {
  return {
    name,
    tool: {} as ToolContribution['tool'],
  };
}

function makeUserAction(name: string): UserActionContribution {
  return {
    name,
    wireName: name.replace(/:/g, '__'),
    description: `${name} description`,
    parameters: z.object({}).strict(),
    resultSchema: z.object({}).strict(),
  };
}

describe('registry + loaders', () => {
  it('parses agent frontmatter arrays and resolves both tool sigils', () => {
    const agentsDir = fileDir('pack-a/agents');
    const filePath = writeFixture('pack-a/agents/core.triage.agent.md', `---
name: core.triage
description: Triage
model:
  envVar: AZURE_OPENAI_CHAT_DEPLOYMENT
tools:
  - core.emit_ui
  - core:confirm
handoffs:
  - label: Next
    agent: core.codesmith
    send: true
user-invocable: true
disable-model-invocation: false
---

Hello world.
`);

    const pack: Pack = {
      name: 'core',
      version: '1.0.0',
      agentsDir,
    };

    const agent = loadAgentFile(pack, filePath, {
      tools: new Map([['core.emit_ui', makeTool('core.emit_ui')]]),
      userActions: new Map([['core:confirm', makeUserAction('core:confirm')]]),
    });

    expect(agent.toolAllowlist).toEqual(['core.emit_ui', 'core:confirm']);
    expect(agent.handoffs).toHaveLength(1);
    expect(agent.userInvocable).toBe(true);
    expect(agent.modelInvocable).toBe(true);
  });

  it('rejects agent frontmatter with missing required fields or unknown keys', () => {
    const agentsDir = fileDir('pack-b/agents');
    const badFile = writeFixture('pack-b/agents/core.bad.agent.md', `---
name: core.bad
description: Missing tools
model:
  envVar: AZURE_OPENAI_CHAT_DEPLOYMENT
unknown: true
---

Hello world.
`);

    const pack: Pack = { name: 'core', version: '1.0.0', agentsDir };
    expect(() => loadAgentFile(pack, badFile, { tools: new Map(), userActions: new Map() })).toThrow();
  });

  it('rejects path traversal when loading agent files', () => {
    const agentsDir = fileDir('pack-c/agents');
    const outsideFile = writeFixture('pack-c/outside.agent.md', `---
name: core.bad
description: Outside
model:
  envVar: MODEL
tools: []
---

Nope.
`);

    const pack: Pack = { name: 'core', version: '1.0.0', agentsDir };
    expect(() => loadAgentFile(pack, outsideFile, { tools: new Map(), userActions: new Map() })).toThrow(/Path traversal/);
  });

  it('parses skill frontmatter arrays and rejects unknown keys', () => {
    const skillsDir = fileDir('pack-d/skills/example');
    const goodFile = writeFixture('pack-d/skills/example/SKILL.md', `---
name: gateway-api-mandatory
description: Gateway API only
version: 1.0.0
x-kickstart:
  appliesTo:
    - aks.architect
    - core.codesmith
  keywords:
    - gateway
    - httproute
  priority: 80
---

Use Gateway API.
`);

    const badFile = writeFixture('pack-d/skills/example/BAD-SKILL.md', `---
name: bad-skill
description: nope
version: 1.0.0
extra: true
x-kickstart:
  appliesTo:
    - core.triage
  keywords:
    - test
  priority: 1
---

Bad.
`);

    const pack: Pack = { name: 'aks', version: '1.0.0', skillsDir };
    const skill = loadSkillFile(pack, goodFile);
    expect(skill.id).toBe('aks/gateway-api-mandatory');
    expect(skill.appliesTo).toEqual(['aks.architect', 'core.codesmith']);
    expect(() => loadSkillFile(pack, badFile)).toThrow();
  });

  it('rejects cross-pack namespace leakage during registration', () => {
    const registry = new PackRegistry();
    expect(() => registry.register({
      name: 'azure',
      version: '1.0.0',
      tools: [makeTool('core.emit_ui')],
    })).toThrow(/must be namespaced/);
  });

  it('resolves dependency-scoped tools and user actions for agents', () => {
    const registry = new PackRegistry();
    registry.register({
      name: 'core',
      version: '1.0.0',
      tools: [makeTool('core.emit_ui')],
      userActions: [makeUserAction('core:confirm')],
      components: [{ name: 'core/Text', propertySchema: z.object({}).strict(), renderer: null }],
      playgroundStubs: {
        'core:confirm': async () => ({ ok: true }),
      },
      skills: [{
        id: 'chat-foundations',
        name: 'chat-foundations',
        description: 'help',
        version: '1.0.0',
        instructions: 'Use it',
        appliesTo: ['azure.*'],
        keywords: ['chat'],
        priority: 10,
        source: { kind: 'inline' },
      }],
    });
    registry.register({
      name: 'azure',
      version: '1.0.0',
      dependsOn: ['core'],
      agents: [{
        name: 'azure.architect',
        description: 'architect',
        model: { envVar: 'MODEL' },
        toolAllowlist: ['core.emit_ui', 'core:confirm'],
        handoffs: [],
        userInvocable: false,
        modelInvocable: true,
        instructionsBase: 'architect',
        source: { kind: 'inline' },
      }],
    });

    registry.enable(['azure']);
    expect(registry.getToolsForAgent('azure.architect').map((entry) => entry.name)).toEqual(['core.emit_ui', 'core:confirm']);
    expect(registry.getUserAction('core__confirm').name).toBe('core:confirm');
    expect(registry.getSkillsForAgent('azure.architect').map((skill) => skill.id)).toEqual(['core/chat-foundations']);
    expect(registry.getComponent('core/Text').name).toBe('core/Text');
    expect(registry.components.map((component) => component.name)).toEqual(['core/Text']);
    expect(Object.keys(registry.playgroundStubs)).toEqual(['core:confirm']);
    expect(registry.playgroundScenarios).toEqual([]);
  });

  it('rejects agent references to tools outside declared dependencies', () => {
    const registry = new PackRegistry();
    registry.register({
      name: 'core',
      version: '1.0.0',
      tools: [makeTool('core.emit_ui')],
    });

    expect(() => registry.register({
      name: 'azure',
      version: '1.0.0',
      agents: [{
        name: 'azure.architect',
        description: 'architect',
        model: { envVar: 'MODEL' },
        toolAllowlist: ['core.emit_ui'],
        handoffs: [],
        userInvocable: false,
        modelInvocable: true,
        instructionsBase: 'architect',
        source: { kind: 'inline' },
      }],
    })).toThrow(/Unresolved tool reference/);
  });

  it('throws when registering after seal', () => {
    const registry = new PackRegistry();
    registry.seal();

    expect(() => registry.register({ name: 'core', version: '1.0.0' })).toThrow(/sealed/);
  });

  it('detects circular dependencies iteratively', () => {
    const registry = new PackRegistry();
    registry.register({ name: 'a', version: '1.0.0', dependsOn: ['b'] });
    expect(() => registry.register({ name: 'b', version: '1.0.0', dependsOn: ['a'] })).toThrow(/Circular dependency/);
  });
});
