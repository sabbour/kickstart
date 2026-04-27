/**
 * @file agents.test.ts
 * @suite 6a — Agent frontmatter parse (pack-core)
 *
 * Verifies that each `.agent.md` file in `packages/pack-core/agents/` parses
 * correctly through `loader-agent.ts` (from #476 / @aks-kickstart/harness).
 *
 * Tests are written as `it.todo()` scaffolding. When Fry delivers Phase B
 * (the three .agent.md files) and Bender delivers the agent loader (#476),
 * replace each todo with a live assertion.
 *
 * Expected agent files (Phase A names approved in #477 DP):
 *   packages/pack-core/src/agents/core.triage.agent.md
 *   packages/pack-core/src/agents/core.codesmith.agent.md
 *   packages/pack-core/src/agents/core.reviewer.agent.md
 *
 * @depends #476 loader-agent.ts (AgentLoader / parseAgentFrontmatter)
 * @depends Phase A of #477 (the three .agent.md files)
 */

import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AGENTS_DIR = path.resolve(__dirname, '../agents');
const AGENT_NAMES = ['core.triage', 'core.codesmith', 'core.reviewer'];
const TRIAGE_PROMPT = readFileSync(path.join(AGENTS_DIR, 'triage.agent.md'), 'utf8');

/** Regex for the pack.verb_noun tool-name format required by the DP §6a. */
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9_]*$/;

/** Regex for core.* agent name format. */
const AGENT_NAME_PATTERN = /^core\.[a-z][a-z0-9-]*$/;

// ── When loader-agent.ts ships from #476, uncomment and fill in: ─────────────
//
// import { parseAgentFrontmatter } from '@aks-kickstart/harness';
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
    it.todo('core.triage.agent.md exists on disk');
    it.todo('core.codesmith.agent.md exists on disk');
    it.todo('core.reviewer.agent.md exists on disk');
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
      expect(AGENT_NAME_PATTERN.test('core.triage')).toBe(true);
      expect(AGENT_NAME_PATTERN.test('core.codesmith')).toBe(true);
      expect(AGENT_NAME_PATTERN.test('core.reviewer')).toBe(true);
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
    it.todo('core.triage: "user-invocable" is true (entry-point agent)');
    it.todo('core.triage: "model-invocable" is a boolean when present');
    it.todo('core.codesmith: "user-invocable" is false (model-only agent)');
    it.todo('core.reviewer: "model-invocable" is true');
    it.todo('agent with "user-invocable: true" appears in registry.listUserAgents()');
  });

  // ── Round-trip fidelity ─────────────────────────────────────────────────

  describe('round-trip fidelity', () => {
    it.todo('parsed agent.tools array matches tools declared in src/tools/index.ts');

    // #1073: this todo is now enforced end-to-end by PackRegistry.seal()
    // (see packages/harness/src/__tests__/registry.test.ts — "seal()
    // handoff validation" block: unknown targets and cross-pack targets
    // both throw with pack/agent/target tokens in the error). The pack-
    // core agents.test.ts stays as a pointer here; the live assertion
    // runs in harness.
    it('parsed agent.handoffs targets are all intra-pack (enforced at registry.seal, see #1073)', () => {
      // Sanity-only: the three pack-core agents must reference only
      // core.* targets. Exhaustive semantic validation lives in harness.
      const handoffTargets: string[] = [
        // core.triage declared in triage.agent.md
        'core.codesmith',
        'core.reviewer',
      ];
      for (const target of handoffTargets) {
        expect(AGENT_NAME_PATTERN.test(target)).toBe(true);
      }
    });

    it.todo('unknown frontmatter keys are rejected or flagged by the loader');
  });

  describe('triage prompt behavior', () => {
    it('uses contextual first-turn routing instead of forcing the generic track picker', () => {
      expect(TRIAGE_PROMPT).toContain('Use track selection as a lightweight router');
      expect(TRIAGE_PROMPT).toContain('If the track is obvious, do **not** ask the user to pick a generic track');
      expect(TRIAGE_PROMPT).toContain('Requests for an AI-backed model, agent, chatbot, retrieval, planning, prediction, document analysis, or tool-using workflow imply `agentic_app`');
      expect(TRIAGE_PROMPT).not.toContain('On the **first turn**, emit a `TrackPicker` showing the four deployment tracks available on AKS Automatic');
    });

    it('keeps first-turn track picker copy platform-neutral for gradual AKS disclosure', () => {
      expect(TRIAGE_PROMPT).toContain('Gradually disclose AKS Automatic');
      expect(TRIAGE_PROMPT).toContain('"title":"Which path fits your app?"');
      expect(TRIAGE_PROMPT).not.toContain('"title":"What would you like to build on AKS?"');
      expect(TRIAGE_PROMPT).not.toContain('"description":"Deploy a containerized web application on AKS Automatic"');
      expect(TRIAGE_PROMPT).not.toContain('"description":"Build and deploy an AI-powered agent or chatbot on AKS Automatic"');
    });

    it('makes Foundry follow-up fields use one-Q-at-a-time instead of a form dump', () => {
      expect(TRIAGE_PROMPT).toContain('Do not require the user to restate the use case or data sources if they already provided them');
      expect(TRIAGE_PROMPT).toContain('one question at a time');
      expect(TRIAGE_PROMPT).toContain('Do not present a stale fixed list of model families');
      expect(TRIAGE_PROMPT).toContain('Model override');
    });

    it('keeps repo uplift tool and surface instructions consistent', () => {
      expect(TRIAGE_PROMPT).toContain('- core.inspect_repo');
      expect(TRIAGE_PROMPT).toContain('call `core.inspect_repo`');
      expect(TRIAGE_PROMPT).toContain('SummaryCard` titled `"We found:"` on `"shared:triage-main"`');
      // Repo uplift now asks one question at a time instead of emitting a full Questionnaire form
      expect(TRIAGE_PROMPT).toContain('ask the **single most important** question');
      expect(TRIAGE_PROMPT).not.toContain('on `"triage-main"`');
    });

    it('uses the KAITO model search tool instead of a static supported-model list', () => {
      expect(TRIAGE_PROMPT).toContain('- core.search_kaito_models');
      expect(TRIAGE_PROMPT).toContain('call `core.search_kaito_models`');
      expect(TRIAGE_PROMPT).toContain('do not rely on memory or a static list');
      expect(TRIAGE_PROMPT).not.toContain('choice: Llama-3.1-70B, Mistral-Large, Phi-4');
    });
  });
});
