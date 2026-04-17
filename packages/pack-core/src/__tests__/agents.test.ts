/**
 * @file agents.test.ts
 * @suite 6a — Agent frontmatter parse (pack-core)
 *
 * Verifies that each `.agent.md` file in `packages/pack-core/agents/` parses
 * correctly through `loader-agent.ts` (from #476 / @kickstart/harness).
 *
 * Tests are written as `it.todo()` scaffolding. When Fry delivers Phase B
 * (the three .agent.md files) and Bender delivers the agent loader (#476),
 * replace each todo with a live assertion.
 *
 * Expected agent files (Phase A names approved in #477 DP):
 *   packages/pack-core/src/agents/core.orchestrator.agent.md
 *   packages/pack-core/src/agents/core.architect.agent.md
 *   packages/pack-core/src/agents/core.implementer.agent.md
 *
 * @depends #476 loader-agent.ts (AgentLoader / parseAgentFrontmatter)
 * @depends Phase A of #477 (the three .agent.md files)
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';

// ── Constants ────────────────────────────────────────────────────────────────

const AGENTS_DIR = path.resolve(__dirname, '../../agents');
const AGENT_NAMES = ['core.orchestrator', 'core.architect', 'core.implementer'];

/** Regex for the pack.verb_noun tool-name format required by the DP §6a. */
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/;

/** Regex for core.* agent name format. */
const AGENT_NAME_PATTERN = /^core\.[a-z][a-z0-9-]*$/;

// ── When loader-agent.ts ships from #476, uncomment and fill in: ─────────────
//
// import { parseAgentFrontmatter } from '@kickstart/harness';
// OR: import { parseAgentFrontmatter } from '../../../src/loaders/loader-agent.js';
//
// type AgentFrontmatter = {
//   name: string;
//   description: string;
//   model: string;
//   tools: string[];
//   handoffs: string[];
//   'user-invocable'?: boolean;
//   'model-invocable'?: boolean;
// };

// ── Test suite ───────────────────────────────────────────────────────────────

describe('pack-core agent frontmatter', () => {

  // ── File existence ──────────────────────────────────────────────────────

  describe('file presence', () => {
    it.todo('core.orchestrator.agent.md exists on disk');
    it.todo('core.architect.agent.md exists on disk');
    it.todo('core.implementer.agent.md exists on disk');
  });

  // ── Parse without error ─────────────────────────────────────────────────

  describe('parses without error', () => {
    for (const agentName of AGENT_NAMES) {
      it.todo(`${agentName}.agent.md parses through loader-agent without throwing`);
    }
  });

  // ── Required fields ─────────────────────────────────────────────────────

  describe('required frontmatter fields', () => {
    for (const agentName of AGENT_NAMES) {
      it.todo(`${agentName}: "name" field is present and non-empty`);
      it.todo(`${agentName}: "description" field is present and non-empty`);
      it.todo(`${agentName}: "model" field is present and non-empty`);
      it.todo(`${agentName}: "tools" field is an array`);
      it.todo(`${agentName}: "handoffs" field is an array`);
    }

    it.todo('missing "name" field causes parseAgentFrontmatter to throw');
    it.todo('missing "model" field causes parseAgentFrontmatter to throw');
    it.todo('missing "tools" field causes parseAgentFrontmatter to throw');
  });

  // ── Naming conventions ───────────────────────────────────────────────────

  describe('naming conventions', () => {
    for (const agentName of AGENT_NAMES) {
      it.todo(`${agentName}: agent name follows core.* format`);
      it.todo(`${agentName}: all tool names in frontmatter follow pack.verb_noun format`);
    }

    it('AGENT_NAME_PATTERN matches expected format', () => {
      // Sanity-check the regex itself — this test is live
      expect(AGENT_NAME_PATTERN.test('core.orchestrator')).toBe(true);
      expect(AGENT_NAME_PATTERN.test('core.architect')).toBe(true);
      expect(AGENT_NAME_PATTERN.test('core.implementer')).toBe(true);
      expect(AGENT_NAME_PATTERN.test('azure.provision')).toBe(false);
      expect(AGENT_NAME_PATTERN.test('core')).toBe(false);
    });

    it('TOOL_NAME_PATTERN matches expected format', () => {
      // Sanity-check the regex itself — this test is live
      expect(TOOL_NAME_PATTERN.test('core.emit_ui')).toBe(true);
      expect(TOOL_NAME_PATTERN.test('core.write_file')).toBe(true);
      expect(TOOL_NAME_PATTERN.test('emit_ui')).toBe(false);       // missing pack prefix
      expect(TOOL_NAME_PATTERN.test('core.EMIT_UI')).toBe(false);  // uppercase rejected
    });
  });

  // ── Invocability flags ──────────────────────────────────────────────────

  describe('invocability flags', () => {
    it.todo('core.orchestrator: "user-invocable" is true (entry-point agent)');
    it.todo('core.orchestrator: "model-invocable" is a boolean when present');
    it.todo('core.architect: "user-invocable" is false (model-only agent)');
    it.todo('core.implementer: "model-invocable" is true');
    it.todo('agent with "user-invocable: true" appears in registry.listUserAgents()');
  });

  // ── Round-trip fidelity ─────────────────────────────────────────────────

  describe('round-trip fidelity', () => {
    it.todo('parsed agent.tools array matches tools declared in src/tools/index.ts');
    it.todo('parsed agent.handoffs array contains only valid agent names from the same pack');
    it.todo('unknown frontmatter keys are rejected or flagged by the loader');
  });
});
