import { describe, it, expect } from 'vitest';
import { githubPack } from '../index.js';

describe('githubPack registration', () => {
  it('has name "github"', () => {
    expect(githubPack.name).toBe('github');
  });

  it('has version 0.1.0', () => {
    expect(githubPack.version).toBe('0.1.0');
  });

  it('dependsOn core', () => {
    expect(githubPack.dependsOn).toContain('core');
  });

  it('registers the github.api_get tool', () => {
    const toolNames = githubPack.tools?.map((t) => t.name) ?? [];
    expect(toolNames).toContain('github.api_get');
  });

  it('registers 6 user actions', () => {
    expect(githubPack.userActions).toHaveLength(6);
  });

  it('registers all expected user action names', () => {
    const names = githubPack.userActions?.map((a) => a.name) ?? [];
    expect(names).toContain('github:login');
    expect(names).toContain('github:pick_org');
    expect(names).toContain('github:pick_repo');
    expect(names).toContain('github:create_repo');
    expect(names).toContain('github:create_pr');
    expect(names).toContain('github:set_secret');
  });

  it('registers 7 components', () => {
    expect(githubPack.components).toHaveLength(7);
  });

  it('registers all expected component names', () => {
    const names = githubPack.components?.map((c) => c.name) ?? [];
    expect(names).toContain('github/Login');
    expect(names).toContain('github/OrgPicker');
    expect(names).toContain('github/RepoPicker');
    expect(names).toContain('github/RepoInfo');
    expect(names).toContain('github/Action');
    expect(names).toContain('github/CreatePRFlow');
    expect(names).toContain('github/SecretSetter');
  });

  it('registers the no-secret-exposure guardrail', () => {
    const guardrailIds = githubPack.guardrails?.map((g) => g.id) ?? [];
    expect(guardrailIds).toContain('github/no-secret-exposure');
  });

  it('points agentsDir to a URL', () => {
    expect(githubPack.agentsDir).toBeInstanceOf(URL);
  });

  it('points skillsDir to a URL', () => {
    expect(githubPack.skillsDir).toBeInstanceOf(URL);
  });
});
