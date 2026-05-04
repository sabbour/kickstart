/**
 * Pack client guardrail — security grep.
 *
 * Zapp's PR #1000 rejection flagged three XSS / arbitrary-eval primitives as
 * off-limits in any code that can transitively ship via a pack's `./client`
 * subpath export:
 *
 *   - `dangerouslySetInnerHTML`
 *   - `eval(`
 *   - `new Function(`
 *
 * Even though the current pack renderers use none of these and the A2UI + Zod
 * rails validate props before render, we lock the invariant in CI so any
 * future regression — intentional or a dependency update pulling tainted
 * patterns into the transitive graph — hard-fails this PR.
 *
 * Runs as part of the standard `npx vitest run` suite, so it gates every PR
 * via the existing `lint-build` CI job without needing workflow edits.
 *
 * Scope: every file reachable from `packages/pack-{azure,aks-automatic,github}`'s
 * `./client` subpath, which today is `src/client.ts` plus every renderer under
 * `src/components/`. Globs also cover `src/client/**` in case packs later
 * split the subpath into a directory.
 *
 * Exemption: pack-core/client is part of the shipped harness (not a third-party
 * extension point) and may use dangerouslySetInnerHTML for sanitized content
 * in CodeBlock, Markdown, and FileEditor. These components are harness-maintained
 * and don't accept untrusted HTML (see decision record bender-component-contribution-migration).
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../../../../..');

// Third-party pack clients must not use dangerous patterns.
// pack-core is exempt as a shipped harness component.
const PACKS = ['pack-azure', 'pack-aks-automatic', 'pack-github'] as const;

const FORBIDDEN = ['dangerouslySetInnerHTML', 'eval(', 'new Function('] as const;

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);

function isScanTarget(file: string): boolean {
  if (file.endsWith('.d.ts')) return false;
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) return false;
  const dot = file.lastIndexOf('.');
  if (dot < 0) return false;
  return SOURCE_EXT.has(file.slice(dot));
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  const entry = statSync(dir);
  if (entry.isFile()) {
    if (isScanTarget(dir)) out.push(dir);
    return out;
  }
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue;
    walk(join(dir, name), out);
  }
  return out;
}

function collectScanFiles(pack: string): string[] {
  const packRoot = join(repoRoot, 'packages', pack, 'src');
  const targets = [
    join(packRoot, 'client.ts'),
    join(packRoot, 'client'),
    join(packRoot, 'components'),
  ];
  const files: string[] = [];
  for (const target of targets) walk(target, files);
  return files;
}

describe('pack client guardrails — forbidden primitives', () => {
  for (const pack of PACKS) {
    it(`${pack}: client subpath sources are free of dangerouslySetInnerHTML / eval( / new Function(`, () => {
      const files = collectScanFiles(pack);
      expect(files.length, `expected at least one scannable source under ${pack}`).toBeGreaterThan(
        0,
      );

      const hits: Array<{ file: string; needle: string; line: number; excerpt: string }> = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf-8');
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          for (const needle of FORBIDDEN) {
            if (lines[i].includes(needle)) {
              hits.push({
                file: file.replace(repoRoot + '/', ''),
                needle,
                line: i + 1,
                excerpt: lines[i].trim().slice(0, 160),
              });
            }
          }
        }
      }

      expect(
        hits,
        `Pack client code must not use dangerouslySetInnerHTML, eval(, or new Function(). ` +
          `These bypass the Zod + A2UI prop-validation rails and are non-negotiable.\n` +
          hits.map((h) => `  ${h.file}:${h.line} [${h.needle}] ${h.excerpt}`).join('\n'),
      ).toEqual([]);
    });
  }
});

