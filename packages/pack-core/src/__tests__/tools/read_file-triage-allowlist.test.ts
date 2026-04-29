/**
 * @file read_file-triage-allowlist.test.ts
 * @suite Z4 — per-agent filename allowlist on core.read_file (#198)
 *
 * Zapp Z4 (security:approved-with-conditions on DP v1) — the prompt-side
 * rule that triage only reads `.kickstart/state.json`, `plan.md`, and
 * `safeguards-report.md` is a SOFT control. This test pins the HARD
 * control: the tool layer rejects any other path when activeAgent is
 * core.triage, regardless of what the prompt says.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const _fsStore = new Map<string, string>();

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    realpathSync: vi.fn((p: string) => p),
    readFileSync: vi.fn((filePath: string) => {
      const content = _fsStore.get(filePath);
      if (content === undefined) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${filePath}'`),
          { code: 'ENOENT' },
        );
      }
      return content;
    }),
  };
});

import { RunContext } from '@openai/agents';
import { readFileTool, READ_FILE_AGENT_ALLOWLIST } from '../../tools/read_file.js';
import { makeSessionCtx } from './_session-stub.js';

beforeEach(() => {
  _fsStore.clear();
});

function exec(input: { path: string }, session: ReturnType<typeof makeSessionCtx>) {
  return readFileTool.tool.invoke(new RunContext(session), JSON.stringify(input));
}

describe('core.read_file — Z4 per-agent allowlist (triage)', () => {
  it('exposes the triage allowlist with exactly the three sanctioned filenames', () => {
    const triageList = READ_FILE_AGENT_ALLOWLIST.get('core.triage');
    expect(triageList).toBeDefined();
    expect(Array.from(triageList!)).toEqual(
      expect.arrayContaining(['.kickstart/state.json', 'plan.md', 'safeguards-report.md']),
    );
    expect(triageList!.size).toBe(3);
  });

  it('allows triage to read .kickstart/state.json', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    _fsStore.set('/ws/.kickstart/state.json', '{"phase":2}');
    const result = await exec({ path: '.kickstart/state.json' }, session);
    expect(result).toBe('{"phase":2}');
  });

  it('allows triage to read plan.md', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    _fsStore.set('/ws/plan.md', '# Plan');
    const result = await exec({ path: 'plan.md' }, session);
    expect(result).toBe('# Plan');
  });

  it('allows triage to read safeguards-report.md', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    _fsStore.set('/ws/safeguards-report.md', '# Report');
    const result = await exec({ path: 'safeguards-report.md' }, session);
    expect(result).toBe('# Report');
  });

  it('REJECTS triage reads of arbitrary files (deny-by-default)', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    _fsStore.set('/ws/.env', 'SECRET=abc');
    const result = String(await exec({ path: '.env' }, session));
    expect(result).toMatch(/not in the per-agent allowlist/);
  });

  it('REJECTS triage reads of nested arbitrary paths', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    _fsStore.set('/ws/src/secrets.ts', 'export const k = "x";');
    const result = String(await exec({ path: 'src/secrets.ts' }, session));
    expect(result).toMatch(/not in the per-agent allowlist/);
  });

  it('REJECTS triage reads even when relative path uses ./ prefix (normalization works both ways)', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.triage', workspaceRoot: '/ws' });
    // The allowlist normalizes './plan.md' to 'plan.md', so this IS allowed.
    _fsStore.set('/ws/plan.md', '# Plan');
    const ok = await exec({ path: './plan.md' }, session);
    expect(ok).toBe('# Plan');

    // But './secret.env' is NOT in the allowlist.
    const denied = String(await exec({ path: './secret.env' }, session));
    expect(denied).toMatch(/not in the per-agent allowlist/);
  });

  it('does NOT restrict codesmith (no allowlist entry → unrestricted, by design)', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.codesmith', workspaceRoot: '/ws' });
    _fsStore.set('/ws/src/index.ts', 'export {};');
    const result = await exec({ path: 'src/index.ts' }, session);
    expect(result).toBe('export {};');
  });

  it('does NOT restrict reviewer (no allowlist entry → unrestricted)', async () => {
    const session = makeSessionCtx({ activeAgent: 'core.reviewer', workspaceRoot: '/ws' });
    _fsStore.set('/ws/Dockerfile', 'FROM node:20');
    const result = await exec({ path: 'Dockerfile' }, session);
    expect(result).toBe('FROM node:20');
  });
});
