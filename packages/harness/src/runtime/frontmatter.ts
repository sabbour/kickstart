import { readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { parseDocument } from 'yaml';

export interface ParsedFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
  rawFrontmatter: string;
}

function normalizeFilePath(baseDir: string, filePath: string): string {
  const normalizedBaseDir = resolve(baseDir);
  const normalizedFilePath = resolve(filePath);
  const relativePath = relative(normalizedBaseDir, normalizedFilePath);

  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`Path traversal rejected: ${filePath}`);
  }

  return normalizedFilePath;
}

export function confinePath(baseDir: string, filePath: string): string {
  const normalizedPath = normalizeFilePath(baseDir, filePath);
  const stat = statSync(normalizedPath, { throwIfNoEntry: false });
  if (!stat?.isFile()) {
    throw new Error(`Expected a file inside ${baseDir}: ${filePath}`);
  }
  return normalizedPath;
}

export function parseFrontmatter(content: string): ParsedFrontmatter {
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error('Frontmatter must start with --- on the first line.');
  }

  const closingIndex = normalized.indexOf('\n---\n', 4);
  if (closingIndex < 0) {
    throw new Error('Frontmatter is missing a closing --- delimiter.');
  }

  const rawFrontmatter = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5).trimStart();
  const document = parseDocument(rawFrontmatter, {
    uniqueKeys: true,
    strict: true,
  });

  if (document.errors.length > 0) {
    throw new Error(`Invalid YAML frontmatter: ${document.errors[0]?.message ?? 'unknown error'}`);
  }

  const parsed = document.toJS();
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Frontmatter must parse to an object.');
  }

  return {
    attributes: parsed as Record<string, unknown>,
    body,
    rawFrontmatter,
  };
}

export function parseFrontmatterFile(baseDir: string, filePath: string): ParsedFrontmatter {
  const confinedPath = confinePath(baseDir, filePath);
  const raw = readFileSync(confinedPath, 'utf8');
  return parseFrontmatter(raw);
}
