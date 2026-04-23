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
  envVar: KICKSTART_CHAT_MODEL
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

  it('preserves colon-namespaced user action ids in agent allowlists', () => {
    const agentsDir = fileDir('pack-user-action/agents');
    const filePath = writeFixture('pack-user-action/agents/github.login.agent.md', `---
name: github.login
description: Login helper
model:
  envVar: KICKSTART_MODEL
tools: []
userActions:
  - github:login
handoffs: []
user-invocable: false
---

Handle login.
`);

    const pack: Pack = {
      name: 'github',
      version: '1.0.0',
      agentsDir,
    };

    const agent = loadAgentFile(pack, filePath, {
      tools: new Map(),
      userActions: new Map([['github:login', makeUserAction('github:login')]]),
    });

    expect(agent.toolAllowlist).toEqual(['github:login']);
  });

  it('accepts model-invocable aliases in file-backed agents', () => {
    const agentsDir = fileDir('pack-alias/agents');
    const filePath = writeFixture('pack-alias/agents/github.publisher.agent.md', `---
name: github.publisher
description: Publisher
model:
  envVar: KICKSTART_MODEL
tools:
  - github.api_get
userActions:
  - github:login
handoffs: []
user-invocable: false
model-invocable: true
---

Publish artifacts.
`);

    const pack: Pack = {
      name: 'github',
      version: '1.0.0',
      agentsDir,
    };

    const agent = loadAgentFile(pack, filePath, {
      tools: new Map([['github.api_get', makeTool('github.api_get')]]),
      userActions: new Map([['github:login', makeUserAction('github:login')]]),
    });

    expect(agent.toolAllowlist).toEqual(['github.api_get', 'github:login']);
    expect(agent.userInvocable).toBe(false);
    expect(agent.modelInvocable).toBe(true);
  });

  it('rejects agents that declare both model-invocable variants', () => {
    const agentsDir = fileDir('pack-conflict/agents');
    const filePath = writeFixture('pack-conflict/agents/core.conflict.agent.md', `---
name: core.conflict
description: Conflict
model:
  envVar: KICKSTART_MODEL
tools: []
handoffs: []
user-invocable: false
model-invocable: true
disable-model-invocation: false
---

Nope.
`);

    const pack: Pack = {
      name: 'core',
      version: '1.0.0',
      agentsDir,
    };

    expect(() => loadAgentFile(pack, filePath, { tools: new Map(), userActions: new Map() }))
      .toThrow(/cannot declare both/);
  });

  it('rejects agent frontmatter with missing required fields or unknown keys', () => {
    const agentsDir = fileDir('pack-b/agents');
    const badFile = writeFixture('pack-b/agents/core.bad.agent.md', `---
name: core.bad
description: Missing tools
model:
  envVar: KICKSTART_CHAT_MODEL
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

  it('accepts dotted frontmatter skill ids and normalizes them to pack/id', () => {
    const skillsDir = fileDir('pack-e/skills');
    const filePath = writeFixture('pack-e/skills/arm-basics.SKILL.md', `---
id: azure.arm-basics
name: ARM Basics
description: ARM only
version: 1.0.0
x-kickstart:
  appliesTo:
    - azure.*
  keywords:
    - arm
  priority: 80
---

Use ARM.
`);

    const pack: Pack = { name: 'azure', version: '1.0.0', skillsDir };
    const skill = loadSkillFile(pack, filePath);

    expect(skill.id).toBe('azure/arm-basics');
    expect(skill.name).toBe('ARM Basics');
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

  // ── #1073 D2: handoff validation at seal() ─────────────────────────────
  describe('seal() — handoff validation (#1073)', () => {
    it('accepts intra-pack handoff targets that exist', () => {
      const registry = new PackRegistry();
      registry.register({
        name: 'core',
        version: '1.0.0',
        agents: [
          {
            name: 'core.triage',
            description: 'triage',
            model: { envVar: 'M' },
            toolAllowlist: [],
            handoffs: [{ label: 'Go', agent: 'core.codesmith' }],
            userInvocable: true,
            modelInvocable: true,
            instructionsBase: 'triage',
            source: { kind: 'inline' },
          },
          {
            name: 'core.codesmith',
            description: 'codesmith',
            model: { envVar: 'M' },
            toolAllowlist: [],
            handoffs: [],
            userInvocable: false,
            modelInvocable: true,
            instructionsBase: 'codesmith',
            source: { kind: 'inline' },
          },
        ],
      });
      registry.enable(['core']);
      expect(() => registry.seal()).not.toThrow();
    });

    it('throws with pack, agent, and target tokens when handoff target is unknown (T4, Nibbler N6)', () => {
      const registry = new PackRegistry();
      registry.register({
        name: 'core',
        version: '1.0.0',
        agents: [{
          name: 'core.triage',
          description: 'triage',
          model: { envVar: 'M' },
          toolAllowlist: [],
          handoffs: [{ label: 'Go', agent: 'core.ghost' }],
          userInvocable: true,
          modelInvocable: true,
          instructionsBase: 'triage',
          source: { kind: 'inline' },
        }],
      });
      registry.enable(['core']);
      try {
        registry.seal();
        throw new Error('expected seal() to throw');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // All three tokens must appear in the error for fast diagnosis.
        expect(msg).toContain('core');        // pack
        expect(msg).toContain('core.triage'); // agent
        expect(msg).toContain('core.ghost');  // target
        expect(msg).toMatch(/unknown handoff target/i);
      }
    });

    it('rejects cross-pack handoff targets (T5, Zapp Z1)', () => {
      const registry = new PackRegistry();
      registry.register({
        name: 'core',
        version: '1.0.0',
        agents: [{
          name: 'core.codesmith',
          description: 'codesmith',
          model: { envVar: 'M' },
          toolAllowlist: [],
          handoffs: [],
          userInvocable: false,
          modelInvocable: true,
          instructionsBase: 'codesmith',
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
          model: { envVar: 'M' },
          toolAllowlist: [],
          handoffs: [{ label: 'Code', agent: 'core.codesmith' }],
          userInvocable: false,
          modelInvocable: true,
          instructionsBase: 'architect',
          source: { kind: 'inline' },
        }],
      });
      registry.enable(['azure']);
      try {
        registry.seal();
        throw new Error('expected seal() to throw');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        expect(msg).toMatch(/cross-pack/i);
        expect(msg).toContain('azure');            // source pack
        expect(msg).toContain('azure.architect');  // source agent
        expect(msg).toContain('core.codesmith');   // target
      }
    });

    it('ignores inactive packs when validating handoffs', () => {
      // An inactive pack with a bogus handoff must NOT fail seal — the
      // agent is unreachable, the handoff is dead config.
      const registry = new PackRegistry();
      registry.register({
        name: 'core',
        version: '1.0.0',
        agents: [{
          name: 'core.triage',
          description: 'triage',
          model: { envVar: 'M' },
          toolAllowlist: [],
          handoffs: [],
          userInvocable: true,
          modelInvocable: true,
          instructionsBase: 'triage',
          source: { kind: 'inline' },
        }],
      });
      registry.register({
        name: 'dead',
        version: '1.0.0',
        agents: [{
          name: 'dead.ghost',
          description: 'ghost',
          model: { envVar: 'M' },
          toolAllowlist: [],
          handoffs: [{ label: 'Nope', agent: 'dead.missing' }],
          userInvocable: false,
          modelInvocable: true,
          instructionsBase: 'ghost',
          source: { kind: 'inline' },
        }],
      });
      // Only enable 'core' → 'dead' is inactive.
      registry.enable(['core']);
      expect(() => registry.seal()).not.toThrow();
    });
  });

  it('detects circular dependencies iteratively', () => {
    const registry = new PackRegistry();
    registry.register({ name: 'a', version: '1.0.0', dependsOn: ['b'] });
    expect(() => registry.register({ name: 'b', version: '1.0.0', dependsOn: ['a'] })).toThrow(/Circular dependency/);
  });

  it('merges skillsDir file skills with inline skills[] and detects cross-source duplicates', () => {
    // Create a skill file on disk
    const skillsDir = fileDir('merge-test/skills/dir-skill');
    writeFixture('merge-test/skills/dir-skill/SKILL.md', `---
name: dir-skill
description: Skill loaded from directory
version: 1.0.0
x-kickstart:
  appliesTo:
    - mergetest.*
  keywords:
    - dir
  priority: 10
---

Use the dir skill.
`);

    // Create an agent file so we can retrieve skills via getSkillsForAgent
    const agentsDir = fileDir('merge-test/agents');
    writeFixture('merge-test/agents/mergetest.tester.agent.md', `---
name: mergetest.tester
description: Test agent for merge coverage
model:
  envVar: MODEL
tools: []
---

Tester agent.
`);

    const registry = new PackRegistry();
    registry.register({
      name: 'mergetest',
      version: '1.0.0',
      skillsDir,
      agentsDir,
      skills: [{
        id: 'mergetest/inline-skill',
        name: 'inline-skill',
        description: 'Inline skill without a .md file',
        version: '1.0.0',
        instructions: 'Use the inline skill.',
        appliesTo: ['mergetest.*'],
        keywords: ['inline'],
        priority: 20,
        source: { kind: 'inline' },
      }],
    });

    // Both the dir-loaded and inline skills must be visible for the agent
    const ids = registry.getSkillsForAgent('mergetest.tester').map((s) => s.id).sort();
    expect(ids).toEqual(['mergetest/dir-skill', 'mergetest/inline-skill']);

    // Deduplication: same id in both skillsDir and skills[] must throw
    const dedupSkillsDir = fileDir('dedup-test/skills/same-skill');
    writeFixture('dedup-test/skills/same-skill/SKILL.md', `---
name: same-skill
description: Dir version
version: 1.0.0
x-kickstart:
  appliesTo:
    - deduptest.*
  keywords:
    - dup
  priority: 10
---

Dir version.
`);
    const registry2 = new PackRegistry();
    expect(() => registry2.register({
      name: 'deduptest',
      version: '1.0.0',
      skillsDir: dedupSkillsDir,
      skills: [{
        id: 'deduptest/same-skill',
        name: 'same-skill',
        description: 'Inline duplicate',
        version: '1.0.0',
        instructions: 'Dup.',
        appliesTo: ['deduptest.*'],
        keywords: ['dup'],
        priority: 10,
        source: { kind: 'inline' },
      }],
    })).toThrow(/Duplicate skill id/);
  });
});
