import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogSnapshot, negotiateCatalog } from './catalog.js';
import { loadAgentFile } from './loader-agent.js';
import { loadSkillFile, inlineSkillSchema } from './loader-skill.js';
import { matchesSkill, validateGlobPattern } from './skill-matcher.js';
import type { AgentContribution } from '../types/agent.js';
import type { ComponentContribution } from '../types/component.js';
import type { GuardrailContribution } from '../types/guardrail.js';
import type { Pack, PlaygroundStub } from '../types/pack.js';
import type { PlaygroundScenario } from '../types/playground.js';
import type { Skill } from '../types/skill.js';
import type { ToolContribution } from '../types/tool.js';
import type { UserActionContribution } from '../types/user-action.js';
import type { A2UICatalog } from '../types/session.js';

interface RegisteredPack {
  pack: Pack;
  agents: AgentContribution[];
  skills: Skill[];
  tools: ToolContribution[];
  userActions: UserActionContribution[];
  components: ComponentContribution[];
  guardrails: GuardrailContribution[];
  playgroundScenarios: PlaygroundScenario[];
}

export type AgentCallableContribution = ToolContribution | UserActionContribution;

export class PackRegistry {
  private readonly packs = new Map<string, RegisteredPack>();
  private readonly agentsByName = new Map<string, AgentContribution>();
  private readonly skillsById = new Map<string, Skill>();
  private readonly toolsByName = new Map<string, ToolContribution>();
  private readonly userActionsByName = new Map<string, UserActionContribution>();
  private readonly userActionsByWireName = new Map<string, UserActionContribution>();
  private readonly componentsByName = new Map<string, ComponentContribution>();
  private readonly guardrailsByStage: Record<'input' | 'output' | 'tool', GuardrailContribution[]> = {
    input: [],
    output: [],
    tool: [],
  };
  private readonly guardrailsById = new Map<string, GuardrailContribution>();
  private readonly playgroundScenariosById = new Map<string, PlaygroundScenario>();
  private activePackNames: string[] | null = null;
  private sealed = false;
  private _sealedPlaygroundStubs: ReadonlyMap<string, PlaygroundStub> | null = null;

  register(pack: Pack): void {
    if (this.sealed) {
      throw new Error('Registry is sealed and cannot accept more packs.');
    }

    this.assertValidPackName(pack.name);
    if (this.packs.has(pack.name)) {
      throw new Error(`Pack already registered: ${pack.name}`);
    }

    const tools = (pack.tools ?? []).map((tool) => this.normalizeTool(pack, tool));
    const userActions = (pack.userActions ?? []).map((action) => this.normalizeUserAction(pack, action));
    const components = (pack.components ?? []).map((component) => this.normalizeComponent(pack, component));
    const guardrails = (pack.guardrails ?? []).map((guardrail) => this.normalizeGuardrail(pack, guardrail));
    const playgroundScenarios = (pack.playgroundScenarios ?? []).map((scenario) => this.normalizeScenario(pack, scenario));

    const dependencyScope = this.buildDependencyScope(pack);
    const localScope = {
      tools: new Map([...dependencyScope.tools, ...tools.map((tool) => [tool.name, tool] as const)]),
      userActions: new Map([...dependencyScope.userActions, ...userActions.map((action) => [action.name, action] as const)]),
    };

    const agents = this.loadAgents(pack, localScope);
    const skills = this.loadSkills(pack);

    for (const agent of agents) this.assertUnique(this.agentsByName, agent.name, 'agent');
    for (const skill of skills) this.assertUnique(this.skillsById, skill.id, 'skill');
    for (const tool of tools) this.assertUnique(this.toolsByName, tool.name, 'tool');
    for (const userAction of userActions) {
      this.assertUnique(this.userActionsByName, userAction.name, 'user action');
      this.assertUnique(this.userActionsByWireName, userAction.wireName, 'user action wire name');
    }
    for (const component of components) this.assertUnique(this.componentsByName, component.name, 'component');
    for (const scenario of playgroundScenarios) this.assertUnique(this.playgroundScenariosById, scenario.id, 'playground scenario');

    const registeredPack: RegisteredPack = {
      pack,
      agents,
      skills,
      tools,
      userActions,
      components,
      guardrails,
      playgroundScenarios,
    };

    this.packs.set(pack.name, registeredPack);
    for (const agent of agents) this.agentsByName.set(agent.name, agent);
    for (const skill of skills) this.skillsById.set(skill.id, skill);
    for (const tool of tools) this.toolsByName.set(tool.name, tool);
    for (const userAction of userActions) {
      this.userActionsByName.set(userAction.name, userAction);
      this.userActionsByWireName.set(userAction.wireName, userAction);
    }
    for (const component of components) this.componentsByName.set(component.name, component);
    for (const guardrail of guardrails) {
      this.assertUnique(this.guardrailsById, guardrail.id, 'guardrail');
      // Reserve core/ namespace — only the 'core' pack may register core/ ids
      if (guardrail.id.startsWith('core/') && pack.name !== 'core') {
        throw new Error(`Pack "${pack.name}" may not register a guardrail in the core/ namespace: ${guardrail.id}`);
      }
      this.guardrailsById.set(guardrail.id, guardrail);
      for (const stage of guardrail.stages) {
        this.guardrailsByStage[stage].push(guardrail);
      }
    }
    for (const scenario of playgroundScenarios) this.playgroundScenariosById.set(scenario.id, scenario);

    this.assertNoCycles();
  }

  enable(names: string[]): void {
    this.activePackNames = this.orderPacks(names);
  }

  seal(): void {
    this.sealed = true;
    // Snapshot and freeze playground stubs at seal time — post-seal mutations blocked.
    const stubs = new Map<string, PlaygroundStub>();
    for (const registeredPack of this.packs.values()) {
      if (!this.isPackActive(registeredPack.pack.name) || !registeredPack.pack.playgroundStubs) continue;
      for (const [key, stub] of Object.entries(registeredPack.pack.playgroundStubs)) {
        if (stubs.has(key)) {
          throw new Error(`Duplicate playground stub key across packs: "${key}"`);
        }
        stubs.set(key, stub);
      }
    }
    this._sealedPlaygroundStubs = stubs;
  }

  getAgent(name: string): AgentContribution {
    const agent = this.agentsByName.get(name);
    if (!agent || !this.isPackActive(this.packNameFromAgent(agent.name))) {
      throw new Error(`Unknown agent: ${name}`);
    }
    return agent;
  }

  getSkillsForAgent(agentName: string): Skill[] {
    this.getAgent(agentName);
    return this.activeSkills().filter((skill) => matchesSkill(agentName, skill));
  }

  listSkills(agentName?: string): Skill[] {
    const all = this.activeSkills();
    if (!agentName) return all;
    return all.filter((skill) => matchesSkill(agentName, skill));
  }

  getToolsForAgent(agentName: string): AgentCallableContribution[] {
    const agent = this.getAgent(agentName);
    return agent.toolAllowlist.map((name) => {
      if (name.includes(':')) {
        return this.getUserAction(name);
      }

      const tool = this.toolsByName.get(name);
      if (!tool || !this.isPackActive(this.packNameFromTool(tool.name))) {
        throw new Error(`Unknown tool in allowlist for ${agentName}: ${name}`);
      }
      return tool;
    });
  }

  getUserAction(name: string): UserActionContribution {
    const action = this.userActionsByName.get(name) ?? this.userActionsByWireName.get(name);
    if (!action || !this.isPackActive(this.packNameFromUserAction(action.name))) {
      throw new Error(`Unknown user action: ${name}`);
    }
    return action;
  }

  getComponent(name: string): ComponentContribution {
    const component = this.componentsByName.get(name);
    if (!component || !this.isPackActive(this.packNameFromComponent(component.name))) {
      throw new Error(`Unknown component: ${name}`);
    }
    return component;
  }

  getGuardrailsByStage(stage: 'input' | 'output' | 'tool'): GuardrailContribution[] {
    return this.guardrailsByStage[stage].filter((guardrail) => this.isPackActive(this.packNameFromGuardrail(guardrail.id)));
  }

  get playgroundScenarios(): PlaygroundScenario[] {
    return [...this.playgroundScenariosById.values()].filter((scenario) => this.isPackActive(this.packNameFromScenario(scenario.id)));
  }

  get playgroundStubs(): ReadonlyMap<string, PlaygroundStub> {
    if (this._sealedPlaygroundStubs) return this._sealedPlaygroundStubs;
    // Pre-seal: compute on demand (dev/test only), collision detection included.
    const stubs = new Map<string, PlaygroundStub>();
    for (const registeredPack of this.packs.values()) {
      if (!this.isPackActive(registeredPack.pack.name) || !registeredPack.pack.playgroundStubs) continue;
      for (const [key, stub] of Object.entries(registeredPack.pack.playgroundStubs)) {
        if (stubs.has(key)) {
          throw new Error(`Duplicate playground stub key across packs: "${key}"`);
        }
        stubs.set(key, stub);
      }
    }
    return stubs;
  }

  get components(): ComponentContribution[] {
    return [...this.componentsByName.values()].filter((component) => this.isPackActive(this.packNameFromComponent(component.name)));
  }

  get catalog(): A2UICatalog {
    return buildCatalogSnapshot(this.components, this.userActions);
  }

  negotiateCatalog(advertisedCatalogIds: readonly string[] | undefined): A2UICatalog {
    return negotiateCatalog(advertisedCatalogIds, buildCatalogSnapshot(this.components, this.userActions));
  }

  private get userActions(): UserActionContribution[] {
    return [...this.userActionsByName.values()].filter((action) => this.isPackActive(this.packNameFromUserAction(action.name)));
  }

  private loadAgents(
    pack: Pack,
    scope: { tools: Map<string, ToolContribution>; userActions: Map<string, UserActionContribution> },
  ): AgentContribution[] {
    const loaded: AgentContribution[] = [];
    if (!pack.agentsDir) return loaded;
    const baseDir = directoryURLToPath(pack.agentsDir);
    for (const entry of collectMarkdownFiles(baseDir, '.agent.md')) {
      loaded.push(loadAgentFile(pack, entry, scope));
    }
    return loaded;
  }

  private loadSkills(pack: Pack): Skill[] {
    const fileSkills: Skill[] = [];
    if (pack.skillsDir) {
      const baseDir = directoryURLToPath(pack.skillsDir);
      for (const entry of collectMarkdownFiles(baseDir, 'SKILL.md')) {
        fileSkills.push(loadSkillFile(pack, entry));
      }
    }

    const inlineSkills: Skill[] = [];
    if (pack.skills) {
      for (const raw of pack.skills) {
        // Fix 2: enforce pack-name prefix — fail-closed, no auto-correction
        if (!raw.id.startsWith(`${pack.name}/`)) {
          throw new Error(`Inline skill id "${raw.id}" must be namespaced under "${pack.name}/"`);
        }
        // Fix 1: zod validation — same rigor as file-backed skills
        const parsed = inlineSkillSchema.parse(raw);
        const normalized = this.normalizeInlineSkill(pack, parsed as Skill);
        // Validate glob patterns at registration (Zapp: prevent injection)
        for (const pattern of normalized.appliesTo ?? []) {
          validateGlobPattern(pattern);
        }
        // Fix 4: freeze to prevent post-registration mutation
        const frozen = Object.freeze({
          ...normalized,
          appliesTo: Object.freeze([...(normalized.appliesTo ?? [])]),
          keywords: Object.freeze([...(normalized.keywords ?? [])]),
        }) as Skill;
        inlineSkills.push(frozen);
      }
    }

    // Validate glob patterns for file-backed skills at registration time, then freeze
    const frozenFileSkills: Skill[] = fileSkills.map((skill) => {
      for (const pattern of skill.appliesTo ?? []) {
        validateGlobPattern(pattern);
      }
      return Object.freeze({
        ...skill,
        appliesTo: Object.freeze([...(skill.appliesTo ?? [])]),
        keywords: Object.freeze([...(skill.keywords ?? [])]),
      }) as Skill;
    });

    // Fix 3: detect duplicates within the merged batch before any insertion
    const seen = new Set<string>();
    for (const id of [...frozenFileSkills.map((s) => s.id), ...inlineSkills.map((s) => s.id)]) {
      if (seen.has(id)) throw new Error(`Duplicate skill id "${id}" in pack "${pack.name}"`);
      seen.add(id);
    }

    return [...frozenFileSkills, ...inlineSkills];
  }

  private buildDependencyScope(pack: Pack): { tools: Map<string, ToolContribution>; userActions: Map<string, UserActionContribution> } {
    const allowedPacks = new Set([pack.name, ...(pack.dependsOn ?? [])]);
    const tools = new Map<string, ToolContribution>();
    const userActions = new Map<string, UserActionContribution>();

    for (const [name, tool] of this.toolsByName) {
      if (allowedPacks.has(this.packNameFromTool(name))) {
        tools.set(name, tool);
      }
    }

    for (const [name, action] of this.userActionsByName) {
      if (allowedPacks.has(this.packNameFromUserAction(name))) {
        userActions.set(name, action);
      }
    }

    return { tools, userActions };
  }

  private normalizeInlineAgent(
    pack: Pack,
    agent: AgentContribution,
    scope: { tools: Map<string, ToolContribution>; userActions: Map<string, UserActionContribution> },
  ): AgentContribution {
    if (!agent.name.startsWith(`${pack.name}.`)) {
      throw new Error(`Agent ${agent.name} must be namespaced under pack ${pack.name}.`);
    }

    return {
      ...agent,
      toolAllowlist: agent.toolAllowlist.map((reference) => this.resolveAllowlistReference(pack, reference, scope)),
    };
  }

  private normalizeInlineSkill(pack: Pack, skill: Skill): Skill {
    const id = skill.id.startsWith(`${pack.name}/`) ? skill.id : `${pack.name}/${skill.id}`;
    return { ...skill, id };
  }

  private normalizeTool(pack: Pack, tool: ToolContribution): ToolContribution {
    if (!tool.name.startsWith(`${pack.name}.`)) {
      throw new Error(`Tool ${tool.name} must be namespaced under pack ${pack.name}.`);
    }
    return tool;
  }

  private normalizeUserAction(pack: Pack, userAction: UserActionContribution): UserActionContribution {
    if (!userAction.name.startsWith(`${pack.name}:`)) {
      throw new Error(`User action ${userAction.name} must be namespaced under pack ${pack.name}.`);
    }

    return {
      ...userAction,
      wireName: userAction.wireName,
    };
  }

  private normalizeComponent(pack: Pack, component: ComponentContribution): ComponentContribution {
    if (!component.name.startsWith(`${pack.name}/`)) {
      throw new Error(`Component ${component.name} must be namespaced under pack ${pack.name}.`);
    }
    return component;
  }

  private normalizeGuardrail(pack: Pack, guardrail: GuardrailContribution): GuardrailContribution {
    if (!guardrail.id.startsWith(`${pack.name}/`)) {
      return { ...guardrail, id: `${pack.name}/${guardrail.id}` };
    }
    return guardrail;
  }

  private normalizeScenario(pack: Pack, scenario: PlaygroundScenario): PlaygroundScenario {
    if (!scenario.id.startsWith(`${pack.name}/`)) {
      return { ...scenario, id: `${pack.name}/${scenario.id}` };
    }
    return scenario;
  }

  private resolveAllowlistReference(
    pack: Pack,
    reference: string,
    scope: { tools: Map<string, ToolContribution>; userActions: Map<string, UserActionContribution> },
  ): string {
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

    const tool = scope.tools.get(reference);
    if (!tool) {
      throw new Error(`Unresolved tool reference for ${pack.name}: ${reference}`);
    }
    return tool.name;
  }

  private assertNoCycles(): void {
    const states = new Map<string, 0 | 1 | 2>();

    for (const name of this.packs.keys()) {
      if ((states.get(name) ?? 0) === 2) {
        continue;
      }

      const stack: Array<{ name: string; deps: string[]; index: number }> = [{
        name,
        deps: [...(this.packs.get(name)?.pack.dependsOn ?? [])],
        index: 0,
      }];

      while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const state = states.get(current.name) ?? 0;
        if (state === 0) {
          states.set(current.name, 1);
        }

        if (current.index >= current.deps.length) {
          states.set(current.name, 2);
          stack.pop();
          continue;
        }

        const dep = current.deps[current.index++];
        if (!this.packs.has(dep)) {
          continue;
        }

        const depState = states.get(dep) ?? 0;
        if (depState === 1) {
          throw new Error(`Circular dependency detected involving ${current.name} and ${dep}`);
        }
        if (depState === 2) {
          continue;
        }

        stack.push({
          name: dep,
          deps: [...(this.packs.get(dep)?.pack.dependsOn ?? [])],
          index: 0,
        });
      }
    }
  }

  private orderPacks(names: string[]): string[] {
    const requested = [...new Set(names)];
    const closure = new Set<string>();
    const toVisit = [...requested];

    while (toVisit.length > 0) {
      const name = toVisit.pop();
      if (!name || closure.has(name)) {
        continue;
      }

      const pack = this.packs.get(name);
      if (!pack) {
        throw new Error(`Unknown pack: ${name}`);
      }

      closure.add(name);
      for (const dep of pack.pack.dependsOn ?? []) {
        if (!this.packs.has(dep)) {
          throw new Error(`Pack ${name} depends on unknown pack ${dep}`);
        }
        toVisit.push(dep);
      }
    }

    const states = new Map<string, 0 | 1 | 2>();
    const ordered: string[] = [];

    for (const name of closure) {
      if ((states.get(name) ?? 0) === 2) {
        continue;
      }

      const stack: Array<{ name: string; deps: string[]; index: number }> = [{
        name,
        deps: [...(this.packs.get(name)?.pack.dependsOn ?? [])].filter((dep) => closure.has(dep)),
        index: 0,
      }];

      while (stack.length > 0) {
        const current = stack[stack.length - 1];
        const state = states.get(current.name) ?? 0;
        if (state === 0) {
          states.set(current.name, 1);
        }

        if (current.index >= current.deps.length) {
          states.set(current.name, 2);
          ordered.push(current.name);
          stack.pop();
          continue;
        }

        const dep = current.deps[current.index++];
        const depState = states.get(dep) ?? 0;
        if (depState === 1) {
          throw new Error(`Circular dependency detected involving ${current.name} and ${dep}`);
        }
        if (depState === 2) {
          continue;
        }

        stack.push({
          name: dep,
          deps: [...(this.packs.get(dep)?.pack.dependsOn ?? [])].filter((nextDep) => closure.has(nextDep)),
          index: 0,
        });
      }
    }

    return ordered;
  }

  private activeSkills(): Skill[] {
    return [...this.skillsById.values()].filter((skill) => this.isPackActive(this.packNameFromSkill(skill.id)));
  }

  private isPackActive(packName: string): boolean {
    return this.activePackNames === null || this.activePackNames.includes(packName);
  }

  private packNameFromAgent(name: string): string {
    return name.split('.', 1)[0] ?? name;
  }

  private packNameFromTool(name: string): string {
    return name.split('.', 1)[0] ?? name;
  }

  private packNameFromUserAction(name: string): string {
    return name.split(':', 1)[0] ?? name;
  }

  private packNameFromComponent(name: string): string {
    return name.split('/', 1)[0] ?? name;
  }

  private packNameFromScenario(id: string): string {
    return id.split('/', 1)[0] ?? id;
  }

  private packNameFromSkill(id: string): string {
    return id.split('/', 1)[0] ?? id;
  }

  private packNameFromGuardrail(id: string): string {
    return id.split('/', 1)[0] ?? id;
  }

  private assertUnique<T>(map: Map<string, T>, name: string, label: string): void {
    if (map.has(name)) {
      throw new Error(`Duplicate ${label} registered: ${name}`);
    }
  }

  private assertValidPackName(name: string): void {
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error(`Invalid pack name: ${name}`);
    }
  }
}

function collectMarkdownFiles(baseDir: string, expectedSuffix: string): string[] {
  const entries: string[] = [];
  const stack = [resolve(baseDir)];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = resolve(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(expectedSuffix)) {
        entries.push(fullPath);
      }
    }
  }

  return entries.sort((left, right) => left.localeCompare(right));
}

function directoryURLToPath(url: URL): string {
  if (url.protocol !== 'file:') {
    throw new Error(`Only file URLs are supported for loader paths: ${url.toString()}`);
  }

  const pathname = fileURLToPath(url);
  const stat = statSync(pathname, { throwIfNoEntry: false });
  if (!stat?.isDirectory()) {
    throw new Error(`Expected a directory URL for ${url.toString()}`);
  }
  return pathname;
}
