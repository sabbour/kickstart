import { describe, it, expect } from 'vitest';
import { resolveSkills } from '../runtime/skill-resolver.js';
import type { Skill } from '../types/skill.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    description: overrides.description ?? 'A test skill',
    version: overrides.version ?? '1.0.0',
    instructions: overrides.instructions ?? 'Do the thing.',
    appliesTo: overrides.appliesTo ?? ['*'],
    keywords: overrides.keywords ?? [],
    priority: overrides.priority ?? 0,
    source: overrides.source ?? { kind: 'inline' },
  };
}

// ── resolveSkills pipeline ────────────────────────────────────────────────────

describe('resolveSkills', () => {
  // Test 1: Keyword scoring — skill with matching keyword ranks above skill without
  it('ranks skill with matching keyword above skill without', () => {
    const withKeyword = makeSkill({ id: 'pack/with', keywords: ['deploy'], priority: 0 });
    const withoutKeyword = makeSkill({ id: 'pack/without', keywords: ['unrelated'], priority: 0 });
    const result = resolveSkills([withoutKeyword, withKeyword], {
      agentName: 'agent',
      userMessage: 'Please deploy my app',
      budgetTokens: 9999,
    });
    expect(result[0].id).toBe('pack/with');
    expect(result[1].id).toBe('pack/without');
  });

  // Test 2: Priority tiebreak — equal keyword scores use priority field
  it('breaks keyword score ties using priority (lower = first)', () => {
    const lowPri = makeSkill({ id: 'pack/low', keywords: ['build'], priority: 1 });
    const highPri = makeSkill({ id: 'pack/high', keywords: ['build'], priority: 5 });
    const result = resolveSkills([highPri, lowPri], {
      agentName: 'agent',
      userMessage: 'build the project',
      budgetTokens: 9999,
    });
    expect(result[0].id).toBe('pack/low');
    expect(result[1].id).toBe('pack/high');
  });

  // Test 3: Budget truncation — skill too large for budget is excluded, smaller skill fits
  it('truncates skills that exceed token budget', () => {
    // giant: 100 chars → 25 tokens; tiny: 4 chars → 1 token; budget = 5
    // tiny has keyword match → ranks first; giant ranks second; giant doesn't fit after tiny
    const tiny = makeSkill({ id: 'pack/tiny', instructions: 'X'.repeat(4), keywords: ['deploy'] });
    const giant = makeSkill({ id: 'pack/giant', instructions: 'Y'.repeat(100), keywords: [] });
    const result = resolveSkills([giant, tiny], {
      agentName: 'agent',
      userMessage: 'deploy my app',
      budgetTokens: 5, // tiny (1 token) fits; giant (25 tokens) does not
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pack/tiny');
  });

  // Test 4: Agent filter integration — skill with wrong appliesTo is excluded
  it('excludes skills whose appliesTo does not match agentName', () => {
    const forOther = makeSkill({ id: 'pack/other', appliesTo: ['other-agent'] });
    const forThis = makeSkill({ id: 'pack/this', appliesTo: ['my-agent'] });
    const result = resolveSkills([forOther, forThis], {
      agentName: 'my-agent',
      userMessage: '',
      budgetTokens: 9999,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pack/this');
  });

  // Test 5: Empty message — keyword scores all 0, sorted by priority
  it('sorts by priority when userMessage is empty (all scores are 0)', () => {
    const a = makeSkill({ id: 'pack/a', keywords: ['alpha'], priority: 2 });
    const b = makeSkill({ id: 'pack/b', keywords: ['beta'], priority: 1 });
    const c = makeSkill({ id: 'pack/c', keywords: ['gamma'], priority: 3 });
    const result = resolveSkills([a, b, c], {
      agentName: 'agent',
      userMessage: '',
      budgetTokens: 9999,
    });
    expect(result.map(s => s.id)).toEqual(['pack/b', 'pack/a', 'pack/c']);
  });

  // Test 6: No skills — returns empty array
  it('returns empty array when no skills provided', () => {
    const result = resolveSkills([], {
      agentName: 'agent',
      userMessage: 'hello',
      budgetTokens: 9999,
    });
    expect(result).toEqual([]);
  });
});
