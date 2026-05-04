// Generate docs-site/docs/extending/skills-reference.md from every
// SKILL.md across packs. Supports two on-disk shapes:
//   packages/<pack>/src/skills/<slug>/SKILL.md          (pack-core)
//   packages/<pack>/src/skills/<slug>.SKILL.md          (pack-azure, pack-aks)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const PACKS = [
  { id: 'core', dir: 'packages/pack-core/src/skills' },
  { id: 'azure', dir: 'packages/pack-azure/src/skills' },
  { id: 'aks', dir: 'packages/pack-aks-automatic/src/skills' },
  { id: 'github', dir: 'packages/pack-github/src/skills' },
];

function findSkillFiles(absDir) {
  if (!existsSync(absDir)) return [];
  const out = [];
  for (const entry of readdirSync(absDir)) {
    const full = join(absDir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      const nested = join(full, 'SKILL.md');
      if (existsSync(nested)) out.push(nested);
    } else if (entry.endsWith('.SKILL.md')) {
      out.push(full);
    }
  }
  return out;
}

function parseFrontmatter(src) {
  if (!src.startsWith('---')) return { fm: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { fm: {}, body: src };
  const fmRaw = src.slice(3, end).trim();
  const body = src.slice(end + 4).trim();
  const fm = {};
  let currentKey = null;
  let currentList = null;
  for (const line of fmRaw.split('\n')) {
    if (/^\s*-\s+/.test(line) && currentList) {
      currentList.push(line.replace(/^\s*-\s+/, '').replace(/^['"]|['"]$/g, '').trim());
      continue;
    }
    const m = line.match(/^(\s*)([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, indent, key, val] = m;
    if (indent.length === 0) {
      currentKey = key;
      currentList = null;
      if (val === '') {
        fm[key] = {};
      } else {
        fm[key] = val.replace(/^['"]|['"]$/g, '');
      }
    } else {
      if (currentKey && typeof fm[currentKey] === 'object') {
        if (val === '') {
          fm[currentKey][key] = [];
          currentList = fm[currentKey][key];
        } else {
          fm[currentKey][key] = val.replace(/^['"]|['"]$/g, '');
        }
      }
    }
  }
  return { fm, body };
}

function generate() {
  const lines = [];
  lines.push('---');
  lines.push('sidebar_position: 12');
  lines.push('---');
  lines.push('');
  lines.push('# Skills Reference');
  lines.push('');
  lines.push('> Auto-generated from each pack\'s `SKILL.md` files. Do not edit by hand — run `npm --prefix docs-site run build` (or invoke `node docs-site/scripts/generate-skills-reference.mjs` directly).');
  lines.push('');
  lines.push('See [Packs, skills & actions](../guides/packs-and-skills.md) for the resolution rules and [Prompt pipeline](../architecture/prompt-pipeline.md) for how skills are assembled into the per-turn system prompt.');
  lines.push('');
  for (const pack of PACKS) {
    const abs = resolve(REPO_ROOT, pack.dir);
    const files = findSkillFiles(abs);
    if (files.length === 0) continue;
    const rows = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      const { fm } = parseFrontmatter(src);
      const id = fm.id || fm.name || f.split('/').slice(-2)[0];
      const desc = fm.description || '';
      const xk = fm['x-kickstart'] || {};
      const appliesTo = Array.isArray(xk.appliesTo) ? xk.appliesTo.join(', ') : '';
      const priority = xk.priority || '';
      rows.push({ id, desc, appliesTo, priority, file: f.replace(REPO_ROOT + '/', '') });
    }
    rows.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    lines.push(`## ${pack.id}`);
    lines.push('');
    lines.push('| Skill | applies to | priority | description |');
    lines.push('|---|---|---|---|');
    for (const r of rows) {
      const desc = r.desc.replace(/\|/g, '\\|');
      const at = r.appliesTo.replace(/\|/g, '\\|') || '*';
      lines.push(`| \`${r.id}\` | \`${at}\` | ${r.priority || '—'} | ${desc} |`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('Columns:');
  lines.push('');
  lines.push('- **applies to** — agent-name globs from `x-kickstart.appliesTo`. `*` means all agents.');
  lines.push('- **priority** — higher priorities win the greedy `fitSkillsInBudget` order. See `packages/harness/src/runtime/token-budget.ts`.');
  lines.push('');
  return lines.join('\n');
}

const out = generate();
const target = resolve(REPO_ROOT, 'docs-site/docs/extending/skills-reference.md');
writeFileSync(target, out, 'utf8');
console.log(`generate-skills-reference: wrote ${target}`);
