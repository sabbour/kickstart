// Tests for new merge-check.mjs logic (Nibbler PR #358 concern).
// Covers isDocsOnlyPr and hasSensitivePaths (exported helpers) and the
// docs-only PR exemption logic introduced in lines 87–230.
import { describe, it, expect } from 'vitest';
import { isDocsOnlyPr, hasSensitivePaths } from '../merge-check.mjs';

describe('merge-check.mjs — isDocsOnlyPr', () => {
  it('returns true when all paths are .md files', () => {
    expect(isDocsOnlyPr(['README.md', 'docs/guide.md'])).toBe(true);
  });

  it('returns true when all paths are .mdx files', () => {
    expect(isDocsOnlyPr(['docs-site/docs/intro.mdx'])).toBe(true);
  });

  it('returns true when all paths are under docs/', () => {
    expect(isDocsOnlyPr(['docs/architecture.md', 'docs/adr/001.md'])).toBe(true);
  });

  it('returns true when all paths are under docs-site/', () => {
    expect(isDocsOnlyPr(['docs-site/blog/post.md'])).toBe(true);
  });

  it('returns true when paths include only .changeset/ markdown', () => {
    expect(isDocsOnlyPr(['.changeset/happy-fox-rides.md'])).toBe(true);
  });

  it('returns false when any path is a .ts file', () => {
    expect(isDocsOnlyPr(['README.md', 'src/auth.ts'])).toBe(false);
  });

  it('returns false when any path is a .mjs file', () => {
    expect(isDocsOnlyPr(['docs/guide.md', '.github/extensions/squad-workflows/lib/upgrade.mjs'])).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(isDocsOnlyPr([])).toBe(false);
  });
});

describe('merge-check.mjs — hasSensitivePaths', () => {
  it('returns true for .github/workflows/ paths', () => {
    expect(hasSensitivePaths(['.github/workflows/ci.yml'])).toBe(true);
  });

  it('returns true for paths containing auth', () => {
    expect(hasSensitivePaths(['packages/web/api/src/lib/auth.ts'])).toBe(true);
  });

  it('returns true for paths containing guardrail', () => {
    expect(hasSensitivePaths(['packages/harness/src/runtime/guardrails.ts'])).toBe(true);
  });

  it('returns true for paths containing security', () => {
    expect(hasSensitivePaths(['.github/extensions/squad-security/charter.md'])).toBe(true);
  });

  it('returns false for plain docs paths', () => {
    expect(hasSensitivePaths(['README.md', 'docs/guide.md'])).toBe(false);
  });

  it('returns false for a normal TypeScript source path', () => {
    expect(hasSensitivePaths(['packages/pack-core/src/tools/emit_ui.ts'])).toBe(false);
  });

  it('returns false for an empty array', () => {
    expect(hasSensitivePaths([])).toBe(false);
  });
});

describe('merge-check.mjs — docs-only exemption logic (unit)', () => {
  // Verify the interaction between isDocsOnlyPr and hasSensitivePaths
  // matches the intended exemption condition: docsOnly && !sensitive && !architectureLabeled

  it('pure docs PR with no sensitive paths is exemptible', () => {
    const paths = ['README.md', 'docs/guide.md'];
    const docsOnly = isDocsOnlyPr(paths);
    const sensitive = hasSensitivePaths(paths);
    expect(docsOnly && !sensitive).toBe(true);
  });

  it('docs PR touching .github/workflows is NOT exemptible (sensitive)', () => {
    const paths = ['README.md', '.github/workflows/deploy.yml'];
    const docsOnly = isDocsOnlyPr(paths);   // false — yml not docs
    const sensitive = hasSensitivePaths(paths);
    expect(docsOnly && !sensitive).toBe(false);
  });

  it('mixed code+docs PR is NOT exemptible (not docs-only)', () => {
    const paths = ['README.md', 'src/index.ts'];
    const docsOnly = isDocsOnlyPr(paths);
    expect(docsOnly).toBe(false);
  });
});
