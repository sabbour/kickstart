import { describe, it, expect } from 'vitest';
import { matchesSkill, validateGlobPattern, FORBIDDEN_PATTERN_RE } from '../runtime/skill-matcher.js';
import { estimateTokens, buildSkillPrompt, fitSkillsInBudget } from '../runtime/token-budget.js';
import { PackRegistry } from '../runtime/registry.js';
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
    keywords: overrides.keywords ?? ['test'],
    priority: overrides.priority ?? 0,
    source: overrides.source ?? { kind: 'inline' },
  };
}

// ── Phase A: matchesSkill ────────────────────────────────────────────────────

describe('matchesSkill', () => {
  it('matches when appliesTo is empty (applies to all)', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: [] });
    expect(matchesSkill('any-agent', skill)).toBe(true);
  });

  it('matches when appliesTo is absent (undefined cast)', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: undefined as unknown as string[] });
    expect(matchesSkill('any-agent', skill)).toBe(true);
  });

  it('C1: matches any agent when pattern is *', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['*'] });
    expect(matchesSkill('alpha', skill)).toBe(true);
    expect(matchesSkill('beta', skill)).toBe(true);
  });

  it('matches exact agent name', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['my-agent'] });
    expect(matchesSkill('my-agent', skill)).toBe(true);
    expect(matchesSkill('other-agent', skill)).toBe(false);
  });

  it('matches glob wildcard prefix', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['aks-*'] });
    expect(matchesSkill('aks-deployer', skill)).toBe(true);
    expect(matchesSkill('github-deployer', skill)).toBe(false);
  });

  it('matches glob wildcard suffix', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['*-deployer'] });
    expect(matchesSkill('aks-deployer', skill)).toBe(true);
    expect(matchesSkill('aks-reviewer', skill)).toBe(false);
  });

  it('returns false when no pattern matches', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['agent-a', 'agent-b'] });
    expect(matchesSkill('agent-c', skill)).toBe(false);
  });

  it('returns true when at least one pattern matches', () => {
    const skill = makeSkill({ id: 'pack/s1', appliesTo: ['agent-a', 'agent-b'] });
    expect(matchesSkill('agent-b', skill)).toBe(true);
  });
});

// ── Glob injection validation ────────────────────────────────────────────────

describe('validateGlobPattern', () => {
  it('accepts safe patterns', () => {
    expect(() => validateGlobPattern('*')).not.toThrow();
    expect(() => validateGlobPattern('aks-*')).not.toThrow();
    expect(() => validateGlobPattern('my-agent')).not.toThrow();
    expect(() => validateGlobPattern('pack.*')).not.toThrow();
  });

  it.each([';', '|', '&', '$', '`', '\\'])('rejects pattern containing "%s"', (char) => {
    expect(() => validateGlobPattern(`${char}rm-rf`)).toThrow(/forbidden shell metacharacters/);
  });

  it('rejects pattern longer than 256 chars', () => {
    expect(() => validateGlobPattern('a'.repeat(257))).toThrow(/Glob pattern too long/);
  });

  it('accepts pattern of exactly 256 chars', () => {
    expect(() => validateGlobPattern('a'.repeat(256))).not.toThrow();
  });

  it('FORBIDDEN_PATTERN_RE matches dangerous chars', () => {
    expect(FORBIDDEN_PATTERN_RE.test(';echo')).toBe(true);
    expect(FORBIDDEN_PATTERN_RE.test('safe-pattern')).toBe(false);
  });
});

describe('PackRegistry — glob injection at registration', () => {
  it('throws when inline skill appliesTo contains shell metacharacter', () => {
    const registry = new PackRegistry();
    expect(() => {
      registry.register({
        name: 'my-pack',
        skills: [
          {
            id: 'my-pack/bad-skill',
            name: 'bad-skill',
            description: 'Injected skill',
            version: '1.0.0',
            instructions: 'Some instructions',
            appliesTo: ['*; rm -rf /'],
            keywords: ['test'],
            priority: 0,
            source: { kind: 'inline' },
          },
        ],
      });
    }).toThrow(/forbidden shell metacharacters/);
  });
});

describe('PackRegistry — frozen skills (Crit1)', () => {
  it('skill returned by listSkills() has frozen appliesTo — mutation silently fails (non-strict) or throws (strict)', () => {
    const registry = new PackRegistry();
    registry.register({
      name: 'my-pack',
      skills: [
        {
          id: 'my-pack/frozen-skill',
          name: 'frozen-skill',
          description: 'Should be frozen',
          version: '1.0.0',
          instructions: 'Some instructions',
          appliesTo: ['*'],
          keywords: ['test'],
          priority: 0,
          source: { kind: 'inline' },
        },
      ],
    });
    registry.enable(['my-pack']);
    const skill = registry.listSkills()[0];
    // Object.freeze'd arrays throw in strict mode, silently fail otherwise
    expect(() => {
      (skill.appliesTo as string[]).push('*;rm -rf /');
    }).toThrow();
  });
});

describe('PackRegistry.listSkills', () => {
  function buildRegistry(): PackRegistry {
    const registry = new PackRegistry();
    registry.register({
      name: 'pack-a',
      skills: [
        {
          id: 'pack-a/skill-all',
          name: 'skill-all',
          description: 'Applies to all agents',
          version: '1.0.0',
          instructions: 'Global instructions.',
          appliesTo: ['*'],
          keywords: ['global'],
          priority: 0,
          source: { kind: 'inline' },
        },
        {
          id: 'pack-a/skill-aks',
          name: 'skill-aks',
          description: 'Applies to aks agents only',
          version: '1.0.0',
          instructions: 'AKS-specific instructions.',
          appliesTo: ['aks-*'],
          keywords: ['aks'],
          priority: 1,
          source: { kind: 'inline' },
        },
      ],
    });
    registry.enable(['pack-a']);
    return registry;
  }

  it('returns all skills when no agentName provided', () => {
    const registry = buildRegistry();
    const skills = registry.listSkills();
    expect(skills).toHaveLength(2);
  });

  it('filters by agentName — matching * wildcard', () => {
    const registry = buildRegistry();
    const skills = registry.listSkills('aks-deployer');
    // skill-all (*) and skill-aks (aks-*) both match
    expect(skills.map((s) => s.id).sort()).toEqual(['pack-a/skill-aks', 'pack-a/skill-all']);
  });

  it('filters by agentName — non-matching agent gets only wildcard skills', () => {
    const registry = buildRegistry();
    const skills = registry.listSkills('github-agent');
    // only skill-all (*) matches
    expect(skills).toHaveLength(1);
    expect(skills[0].id).toBe('pack-a/skill-all');
  });

  it('returns empty when no skills match', () => {
    const registry = new PackRegistry();
    registry.register({
      name: 'pack-b',
      skills: [
        {
          id: 'pack-b/niche',
          name: 'niche',
          description: 'Very specific skill',
          version: '1.0.0',
          instructions: 'Niche.',
          appliesTo: ['special-agent'],
          keywords: ['niche'],
          priority: 0,
          source: { kind: 'inline' },
        },
      ],
    });
    registry.enable(['pack-b']);
    expect(registry.listSkills('other-agent')).toHaveLength(0);
  });
});

// ── Phase C: token-budget ────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(estimateTokens(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(estimateTokens(undefined)).toBe(0);
  });

  it('approximates token count for normal text', () => {
    // 8 chars → Math.ceil(8/4) = 2
    expect(estimateTokens('abcdefgh')).toBe(2);
  });

  it('rounds up (ceil) for non-divisible lengths', () => {
    // 5 chars → Math.ceil(5/4) = 2
    expect(estimateTokens('abcde')).toBe(2);
    // 9 chars → Math.ceil(9/4) = 3
    expect(estimateTokens('abcdefghi')).toBe(3);
  });

  it('does not throw on arbitrary input', () => {
    expect(() => estimateTokens('   ')).not.toThrow();
    expect(() => estimateTokens('\n\n\n')).not.toThrow();
  });
});

describe('buildSkillPrompt', () => {
  it('returns empty string for empty array', () => {
    expect(buildSkillPrompt([])).toBe('');
  });

  it('formats a single skill', () => {
    const skill = makeSkill({ id: 'pack/s1', instructions: 'Do this.' });
    expect(buildSkillPrompt([skill])).toBe('## pack/s1\nDo this.');
  });

  it('joins multiple skills with double newline', () => {
    const skills = [
      makeSkill({ id: 'pack/s1', instructions: 'First.' }),
      makeSkill({ id: 'pack/s2', instructions: 'Second.' }),
    ];
    expect(buildSkillPrompt(skills)).toBe('## pack/s1\nFirst.\n\n## pack/s2\nSecond.');
  });
});

describe('fitSkillsInBudget', () => {
  it('returns empty array when budget is 0', () => {
    const skills = [makeSkill({ id: 'pack/s1', instructions: 'hello' })];
    expect(fitSkillsInBudget(skills, 0)).toHaveLength(0);
  });

  it('includes skills that exactly fit the budget', () => {
    // rendered: '## pack/s1\nabcd' = 15 chars → ceil(15/4) = 4 tokens each; budget = 8
    const skills = [
      makeSkill({ id: 'pack/s1', instructions: 'abcd' }),
      makeSkill({ id: 'pack/s2', instructions: 'efgh' }),
    ];
    const result = fitSkillsInBudget(skills, 8);
    expect(result).toHaveLength(2);
  });

  it('skips oversized skills and includes subsequent skills that fit', () => {
    // s1: rendered ~4 tokens; s2: rendered ~103 tokens; s3: rendered ~4 tokens
    const skills = [
      makeSkill({ id: 'pack/s1', instructions: 'abcd' }),
      makeSkill({ id: 'pack/s2', instructions: 'a'.repeat(400) }),
      makeSkill({ id: 'pack/s3', instructions: 'xyz' }),
    ];
    // budget = 10: s1 fits (4), s2 overflows (103) — skipped, s3 fits (4)
    const result = fitSkillsInBudget(skills, 10);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(['pack/s1', 'pack/s3']);
  });

  it('[small, huge, small] — both smalls included when huge overflows', () => {
    const small1 = makeSkill({ id: 'pack/small1', instructions: 'tiny' });
    const huge = makeSkill({ id: 'pack/huge', instructions: 'x'.repeat(2000) });
    const small2 = makeSkill({ id: 'pack/small2', instructions: 'also tiny' });
    // budget = 20 — both smalls render well under 20 tokens; huge does not
    const result = fitSkillsInBudget([small1, huge, small2], 20);
    expect(result.map((s) => s.id)).toEqual(['pack/small1', 'pack/small2']);
  });

  it('returns all skills when budget is large enough', () => {
    const skills = [
      makeSkill({ id: 'pack/s1', instructions: 'short' }),
      makeSkill({ id: 'pack/s2', instructions: 'also short' }),
    ];
    expect(fitSkillsInBudget(skills, 10_000)).toHaveLength(2);
  });
});
