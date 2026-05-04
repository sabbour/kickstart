// Generate docs-site/docs/pack-authoring/reference/tools.md from each pack's
// tools/*.ts files. Pure regex extraction — no TypeScript runtime needed.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');

const PACKS = [
  { id: 'core', dir: 'packages/pack-core/src/tools' },
  { id: 'azure', dir: 'packages/pack-azure/src/tools' },
  { id: 'aks', dir: 'packages/pack-aks-automatic/src/tools' },
  { id: 'github', dir: 'packages/pack-github/src/tools' },
];

function extractToolsFromFile(filePath) {
  const src = readFileSync(filePath, 'utf8');
  const tools = [];
  const re = /tool\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  let m;
  function extractObjectFieldExpression(block, fieldName) {
    const field = new RegExp(`\\b${fieldName}\\s*:`, 'm').exec(block);
    if (!field?.index && field?.index !== 0) return null;
    let i = field.index + field[0].length;
    while (i < block.length && /\s/.test(block[i])) i += 1;
    const start = i;
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let quote = null;
    let escaped = false;
    let templateExprDepth = 0;
    for (; i < block.length; i += 1) {
      const ch = block[i];
      if (quote) {
        if (quote === '`' && ch === '$' && block[i + 1] === '{' && !escaped) {
          templateExprDepth += 1;
          i += 1;
          continue;
        }
        if (quote === '`' && ch === '}' && templateExprDepth > 0 && !escaped) {
          templateExprDepth -= 1;
          continue;
        }
        if (templateExprDepth === 0 && ch === quote && !escaped) {
          quote = null;
          continue;
        }
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        quote = ch;
        escaped = false;
        continue;
      }
      if (ch === '(') depthParen += 1;
      else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
      else if (ch === '[') depthBracket += 1;
      else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
      else if (ch === '{') depthBrace += 1;
      else if (ch === '}') {
        if (depthBrace === 0 && depthParen === 0 && depthBracket === 0) break;
        depthBrace = Math.max(0, depthBrace - 1);
      } else if (ch === ',' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
        break;
      }
    }
    return block.slice(start, i).trim();
  }

  function decodeJsStringLiteral(raw) {
    const quote = raw[0];
    const body = raw.slice(1, -1);
    let out = '';
    for (let i = 0; i < body.length; i += 1) {
      const ch = body[i];
      if (ch !== '\\') {
        out += ch;
        continue;
      }
      const next = body[i + 1];
      if (next == null) {
        out += '\\';
        continue;
      }
      i += 1;
      if (next === 'n') out += '\n';
      else if (next === 'r') out += '\r';
      else if (next === 't') out += '\t';
      else if (next === 'b') out += '\b';
      else if (next === 'f') out += '\f';
      else if (next === 'v') out += '\v';
      else if (next === '0') out += '\0';
      else if (next === 'x') {
        const hex = body.slice(i + 1, i + 3);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 2;
        } else out += `\\x`;
      } else if (next === 'u') {
        const hex = body.slice(i + 1, i + 5);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(Number.parseInt(hex, 16));
          i += 4;
        } else out += `\\u`;
      } else {
        out += next;
      }
    }
    if (quote === '`' && out.includes('${')) return null;
    return out;
  }

  function splitTopLevelPlus(expr) {
    const out = [];
    let start = 0;
    let depthParen = 0;
    let depthBracket = 0;
    let depthBrace = 0;
    let quote = null;
    let escaped = false;
    let templateExprDepth = 0;
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (quote) {
        if (quote === '`' && ch === '$' && expr[i + 1] === '{' && !escaped) {
          templateExprDepth += 1;
          i += 1;
          continue;
        }
        if (quote === '`' && ch === '}' && templateExprDepth > 0 && !escaped) {
          templateExprDepth -= 1;
          continue;
        }
        if (templateExprDepth === 0 && ch === quote && !escaped) {
          quote = null;
          continue;
        }
        escaped = ch === '\\' && !escaped;
        if (ch !== '\\') escaped = false;
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        quote = ch;
        escaped = false;
        continue;
      }
      if (ch === '(') depthParen += 1;
      else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
      else if (ch === '[') depthBracket += 1;
      else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
      else if (ch === '{') depthBrace += 1;
      else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
      else if (ch === '+' && depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
        out.push(expr.slice(start, i));
        start = i + 1;
      }
    }
    out.push(expr.slice(start));
    return out;
  }

  function parseStringExpression(expr) {
    let value = expr.trim();
    while (value.startsWith('(') && value.endsWith(')')) {
      value = value.slice(1, -1).trim();
    }
    const parts = splitTopLevelPlus(value).map((x) => x.trim()).filter(Boolean);
    if (parts.length === 0) return '';
    const decoded = [];
    for (const part of parts) {
      if (!/^['"`](?:\\.|[\s\S])*['"`]$/.test(part)) return null;
      const text = decodeJsStringLiteral(part);
      if (text == null) return null;
      decoded.push(text);
    }
    return decoded.join('');
  }

  while ((m = re.exec(src)) !== null) {
    const block = m[1];
    const name = block.match(/name:\s*['"`]([^'"`]+)['"`]/)?.[1];
    if (!name) continue;
    const descriptionExpr = extractObjectFieldExpression(block, 'description');
    const parsedDescription = descriptionExpr ? parseStringExpression(descriptionExpr) : null;
    const desc =
      parsedDescription ?? block.match(/description:\s*['"`]([^'"`]+)['"`]/)?.[1] ?? '';
    tools.push({ name, description: desc });
  }
  const wrapperRe = /export\s+const\s+\w+\s*:\s*ToolContribution\s*=\s*\{([\s\S]*?)\};/g;
  while ((m = wrapperRe.exec(src)) !== null) {
    const block = m[1];
    const name = block.match(/name:\s*['"`]([^'"`]+)['"`]/)?.[1];
    if (!name) continue;
    const mcp = /mcpExposed\s*:\s*true/.test(block);
    const sess = /requiresSession\s*:\s*true/.test(block);
    const t = tools.find((x) => x.name === name);
    if (t) {
      t.mcpExposed = mcp;
      t.requiresSession = sess;
    } else {
      tools.push({ name, description: '', mcpExposed: mcp, requiresSession: sess });
    }
  }
  return tools;
}

function listToolFiles(dir) {
  const abs = resolve(REPO_ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(abs, f));
}

function generate() {
  const lines = [];
  lines.push('---');
  lines.push('sidebar_position: 11');
  lines.push('---');
  lines.push('');
  lines.push('# Tools Reference');
  lines.push('');
  lines.push('> Auto-generated from each pack\'s `tools/*.ts` files. Do not edit by hand — run `npm --prefix docs-site run build` (or invoke `node docs-site/scripts/generate-tools-reference.mjs` directly).');
  lines.push('');
  lines.push('See [LLM tools](./llm-tools.md) for authoring guidance and [MCP tools](./mcp-tools.md) for exposure rules.');
  lines.push('');
  const errors = [];
  for (const pack of PACKS) {
    const files = listToolFiles(pack.dir);
    if (files.length === 0) continue;
    const tools = [];
    for (const f of files) {
      try {
        for (const t of extractToolsFromFile(f)) {
          tools.push({ ...t, file: f.replace(REPO_ROOT + '/', '') });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const errorMsg = `generate-tools-reference: failed to process ${f}: ${message}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }
    if (tools.length === 0) continue;
    tools.sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`## ${pack.id}`);
    lines.push('');
    lines.push('| Tool | MCP | Session | Description |');
    lines.push('|---|---|---|---|');
    for (const t of tools) {
      const mcp = t.mcpExposed ? '✅' : '—';
      const sess = t.requiresSession ? '✅' : '—';
      const desc = (t.description || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\|/g, '\\|');
      lines.push(`| \`${t.name}\` | ${mcp} | ${sess} | ${desc} |`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('Columns:');
  lines.push('');
  lines.push('- **MCP** — `mcpExposed: true` on the contribution. Tools without this never appear in the MCP manifest.');
  lines.push('- **Session** — `requiresSession: true`. These tools need an active SPA session and are excluded from MCP entirely.');
  lines.push('');
  if (errors.length > 0) {
    throw new Error(
      `generate-tools-reference: ${errors.length} file(s) failed during extraction.`,
    );
  }
  return lines.join('\n');
}

try {
  const out = generate();
  const target = resolve(REPO_ROOT, 'docs-site/docs/pack-authoring/reference/tools.md');
  writeFileSync(target, out, 'utf8');
  console.log(`generate-tools-reference: wrote ${target}`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
