/**
 * @file registration.test.ts
 * @suite 6c — Pack registration smoke test (pack-core)
 *
 * Verifies that `corePack` can be registered on a live `PackRegistry`
 * (from @kickstart/harness, shipped by #476) and that all contributions
 * are enumerable after registration.
 *
 * This suite is the **blocking done-criterion** for #477 — no green test,
 * no merge (per Fry DP §7 Risk 1 mitigation).
 *
 * Tests are `it.todo()` scaffolding until both #476 (PackRegistry) and
 * #477 Phase H (corePack manifest wired) ship.
 *
 * The `vi.mock` below stubs the currently-missing modules so the file
 * can be loaded without resolution errors. Remove both mocks once the
 * real packages ship.
 *
 * @depends #476 (PackRegistry on @kickstart/harness)
 * @depends #477 Phase H (corePack manifest fully wired)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Module stubs — remove when #476 and #477 ship ───────────────────────────

vi.mock('@kickstart/harness', async (importOriginal) => {
  const real = await importOriginal<typeof import('@kickstart/harness')>();
  return {
    ...real,
    // PackRegistry will be added by #476; stub here until then
    PackRegistry: class MockPackRegistry {
      private _packs: unknown[] = [];
      private _enabled: string[] = [];
      private _sealed = false;
      async register(pack: unknown) { this._packs.push(pack); }
      enable(names: string[]) { this._enabled.push(...names); }
      seal() { this._sealed = true; }
      getAgent(_name: string): unknown { return undefined; }
      getToolsForAgent(_name: string): unknown[] { return []; }
      getComponent(_name: string): unknown { return undefined; }
      listComponents(): unknown[] { return []; }
      listAgents(): unknown[] { return []; }
      listSkills(): unknown[] { return []; }
      isSealed() { return this._sealed; }
    },
  };
});

vi.mock('@kickstart/pack-core', () => ({
  corePack: {
    name: 'core',
    version: '0.1.0',
    dependencies: [],
    contributions: {
      agents: [],
      skills: [],
      tools: [],
      userActions: [],
      components: [],
      guardrails: [],
      playgroundScenarios: [],
    },
  },
}));

// When #476 and #477 ship, replace with real imports:
// import { PackRegistry } from '@kickstart/harness';
// import { corePack } from '@kickstart/pack-core';

// ── Registration smoke test ──────────────────────────────────────────────────

describe('corePack registration', () => {

  describe('registration lifecycle', () => {
    it.todo('registry.register(corePack) completes without throwing');
    it.todo('registry.enable(["core"]) completes without throwing');
    it.todo('registry.seal() completes without throwing');
    it.todo('attempting to register a second pack after seal() throws');
    it.todo('attempting to mutate contributions after seal() throws');
  });

  // ── Agent enumeration ────────────────────────────────────────────────────

  describe('agent enumeration', () => {
    it.todo('registry.getAgent("core.triage") is defined after registration');
    it.todo('registry.getAgent("core.codesmith") is defined after registration');
    it.todo('registry.getAgent("core.reviewer") is defined after registration');
    it.todo('registry.listAgents() returns exactly 3 agents for the core pack');
    it.todo('registry.getAgent("unknown.agent") returns undefined');
  });

  // ── Tool enumeration ────────────────────────────────────────────────────

  describe('tool enumeration', () => {
    it.todo('registry.getToolsForAgent("core.triage") returns the declared tools');
    it.todo('all 6 core tools are accessible after registration');
    it.todo('tool names follow pack.verb_noun convention in the registry');
  });

  // ── Component enumeration ────────────────────────────────────────────────

  describe('component enumeration', () => {
    it.todo('registry.listComponents() returns exactly 39 entries after registration');
    it.todo('registry.getComponent("core/Button") is defined');
    it.todo('registry.getComponent("core/CodeBlock") is defined');
    it.todo('registry.getComponent("core/AuthCard") is defined');
    it.todo('component entries have { name, schema, renderer } shape');
    it.todo('registry.getComponent("core/AzureLoginCard") is undefined (Azure component not in pack-core)');
  });

  // ── Skill enumeration ────────────────────────────────────────────────────

  describe('skill enumeration', () => {
    it.todo('registry.listSkills() returns exactly 5 entries after registration');
    it.todo('skill "collaborator-voice" is in the registry');
    it.todo('skill "a2ui-output-discipline" is in the registry');
    it.todo('skills have appliesTo, keywords, and priority fields');
  });

  // ── Guardrail enumeration ────────────────────────────────────────────────

  describe('guardrail enumeration', () => {
    it.todo('3 guardrails are registered: token-budget, no-pii-in-logs, no-secrets-in-artifacts');
    it.todo('each guardrail has a { name, evaluate } shape');
  });

  // ── Dependency integrity ────────────────────────────────────────────────

  describe('dependency integrity', () => {
    it.todo('corePack.dependencies is an empty array (no peer packs required)');
    it.todo('corePack.name is "core"');
    it.todo('corePack.version follows semver format');
  });

  // ── Standalone compile ─────────────────────────────────────────────────

  describe('standalone harness compile (no other packs)', () => {
    it.todo('a PackRegistry with only corePack registered compiles without errors');
    it.todo('no imports from @kickstart/pack-azure, @kickstart/pack-aks, or @kickstart/pack-github exist in pack-core source');
  });
});
