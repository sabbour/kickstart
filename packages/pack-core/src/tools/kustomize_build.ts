/**
 * core.kustomize_build — renders a kustomize overlay and returns structured YAML + source map.
 *
 * Security controls:
 *  1. overlayPath confined to workspaceRoot via 3-layer guard:
 *       (a) null-byte rejection
 *       (b) resolve() + normalize() — collapses ALL .. segments, including terminal
 *           ones without trailing slash (/workspace/overlay/.. → /workspace)
 *       (c) strict prefix check against workspaceRoot — catches absolute paths
 *           that resolve outside root (e.g. /etc, /workspace/..)
 *  2. basePath removed from schema — kustomize resolves bases from kustomization.yaml
 *     in the overlay; there is no CLI argument to override the base path.
 *  3. kustomize executed with --network-policy=none (offline only) via subprocess
 *  4. Subprocess runs without inherited env except PATH
 *  5. Output capped at MAX_OUTPUT_BYTES; exceeded flag short-circuits before the
 *     code-based branch (SIGKILL sets code=null, not -1)
 *  6. No temp files written — output captured via stdout pipe
 *  7. Secret material in rendered YAML redacted before returning to the LLM
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { resolve, isAbsolute, normalize, sep } from 'node:path';
import type { ToolContribution } from '@aks-kickstart/harness';

// ── Constants ─────────────────────────────────────────────────────────────────

/** 60-second subprocess timeout — kustomize build should complete well within this. */
const BUILD_TIMEOUT_MS = 60_000;

/** Maximum rendered YAML output (2 MB) — prevents unbounded LLM context. */
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

// ── Schema ────────────────────────────────────────────────────────────────────

const KustomizeBuildInputSchema = z.object({
  overlayPath: z
    .string()
    .min(1)
    .describe(
      'Absolute or relative path to the kustomize overlay directory containing a kustomization.yaml. ' +
      'Must resolve within the workspace root. ' +
      'kustomize resolves base references from the kustomization.yaml inside this directory.',
    ),
});

// ── Source map types ──────────────────────────────────────────────────────────

export interface SourceMapEntry {
  renderedLineRange: [number, number];
  sourceFile: string;
  sourceLineRange: [number, number];
  sourceKind: 'base' | 'overlay' | 'patch';
}

export interface KustomizeBuildOutput {
  renderedYaml: string;
  sourceMap: SourceMapEntry[];
}

// ── Path validation ───────────────────────────────────────────────────────────

/**
 * 3-layer workspace boundary guard.
 *
 * Layer (a) — null-byte rejection: prevents path injection via C-string truncation.
 *
 * Layer (b) — resolve() then normalize(): collapses ALL `..` segments regardless
 *   of whether a trailing separator is present.
 *   - `/workspace/overlay/../..` → `/`       (caught)
 *   - `/workspace/overlay/..`    → `/workspace`  (== root → allowed)
 *   - `../../etc`                → resolved relative to workspaceRoot, checked below
 *
 * Layer (c) — strict prefix check: the normalized absolute path must start with
 *   `workspaceRoot + sep` or equal `workspaceRoot` exactly.
 *   Absolute input paths are NOT exempt — they go through the same normalize +
 *   prefix check, so `/etc` or `/workspace/../etc` are both rejected.
 */
export function validateBoundedPath(rawPath: string, workspaceRoot: string, label: string): string {
  if (rawPath.includes('\0')) {
    throw new Error(`kustomize_build: ${label} contains null byte`);
  }

  // Resolve relative paths against workspaceRoot; absolute paths keep their value.
  // normalize() then collapses all remaining .. and . segments.
  const abs = isAbsolute(rawPath) ? rawPath : resolve(workspaceRoot, rawPath);
  const normalized = normalize(abs);
  const root = normalize(resolve(workspaceRoot));

  if (!normalized.startsWith(root + sep) && normalized !== root) {
    throw new Error(
      `kustomize_build: ${label} resolves outside workspace root. ` +
      `Path "${normalized}" is not under "${root}"`,
    );
  }

  return normalized;
}

// ── Secret redaction ──────────────────────────────────────────────────────────

/**
 * Redact Secret material from kustomize-rendered YAML.
 *
 * kustomize expands Secrets inline — `data:` values are base64-encoded raw
 * secrets, `stringData:` values are plaintext. Neither should reach the LLM.
 *
 * Strategy: split on `---` document boundaries, detect `kind: Secret` in each
 * document, then replace all key values under `data:` and `stringData:` with
 * `[REDACTED]`. Non-Secret documents (ConfigMap, Deployment, …) are untouched.
 */
export function redactSecretValues(yaml: string): string {
  // Preserve leading `---` if present
  const parts = yaml.split(/^---$/m);
  return parts.map(redactDocumentIfSecret).join('---');
}

function redactDocumentIfSecret(doc: string): string {
  if (!/^\s*kind:\s+Secret\s*$/m.test(doc)) {
    return doc;
  }
  return redactDataSections(doc);
}

function redactDataSections(doc: string): string {
  const lines = doc.split('\n');
  const out: string[] = [];

  let inSection = false;
  let sectionIndent = -1;
  let inBlockScalar = false;
  let blockScalarIndent = -1;

  for (const line of lines) {
    // Blank / comment lines always pass through (preserve YAML structure)
    if (line.trim() === '' || line.trim().startsWith('#')) {
      out.push(line);
      continue;
    }

    // Section header: `  data:` or `  stringData:`
    const sectionMatch = line.match(/^(\s*)(data|stringData):\s*$/);
    if (sectionMatch) {
      inSection = true;
      sectionIndent = sectionMatch[1].length;
      inBlockScalar = false;
      blockScalarIndent = -1;
      out.push(line);
      continue;
    }

    if (!inSection) {
      out.push(line);
      continue;
    }

    const lineIndent = (line.match(/^(\s*)/) as RegExpMatchArray)[1].length;

    // Exited the section (back to same or lower indentation)
    if (lineIndent <= sectionIndent) {
      inSection = false;
      sectionIndent = -1;
      inBlockScalar = false;
      // May immediately start a new secret section on the same line
      const newSection = line.match(/^(\s*)(data|stringData):\s*$/);
      if (newSection) {
        inSection = true;
        sectionIndent = newSection[1].length;
      }
      out.push(line);
      continue;
    }

    // Inside a block scalar (|, >) — redact continuation lines
    if (inBlockScalar) {
      if (lineIndent > blockScalarIndent) {
        out.push(' '.repeat(lineIndent) + '[REDACTED]');
        continue;
      }
      inBlockScalar = false;
    }

    // Block scalar header: `  key: |` or `  key: >`
    const blockMatch = line.match(/^(\s+)([\w./-]+):\s+[|>][-+]?\s*$/);
    if (blockMatch) {
      out.push(`${blockMatch[1]}${blockMatch[2]}: [REDACTED]`);
      inBlockScalar = true;
      blockScalarIndent = blockMatch[1].length;
      continue;
    }

    // Inline value: `  key: somevalue`
    const kvMatch = line.match(/^(\s+[\w./-]+:)\s+.+$/);
    if (kvMatch) {
      out.push(kvMatch[1] + ' [REDACTED]');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

// ── Source-kind heuristic ─────────────────────────────────────────────────────

/**
 * Classify a kustomize source annotation path into base/overlay/patch.
 *
 * Heuristics (in priority order):
 *  - "patch" in path segment → patch
 *  - path starts with overlayPath → overlay
 *  - everything else → base
 */
export function classifySourceKind(
  sourcePath: string,
  overlayPath: string,
): 'base' | 'overlay' | 'patch' {
  const lower = sourcePath.toLowerCase();
  if (lower.includes('/patch') || lower.includes('patch/') || lower.match(/patch[-_]/)) {
    return 'patch';
  }
  const absSource = isAbsolute(sourcePath) ? sourcePath : resolve(process.cwd(), sourcePath);
  const absOverlay = isAbsolute(overlayPath) ? overlayPath : resolve(process.cwd(), overlayPath);
  if (absSource.startsWith(absOverlay)) {
    return 'overlay';
  }
  return 'base';
}

// ── Source map parser ─────────────────────────────────────────────────────────

/**
 * Parse kustomize rendered YAML output into a source map.
 *
 * kustomize annotates each resource block with a comment header:
 *   `# Source: path/to/file.yaml`
 *
 * This parser records the rendered line range for each block and classifies
 * the source kind from the annotation path.
 */
export function parseSourceMap(
  renderedYaml: string,
  overlayPath: string,
): SourceMapEntry[] {
  const lines = renderedYaml.split('\n');
  const entries: SourceMapEntry[] = [];

  let currentSource: string | null = null;
  let blockStartLine = 1; // 1-indexed

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    const sourceMatch = line.match(/^#\s*Source:\s*(.+)$/);
    if (sourceMatch) {
      if (currentSource !== null) {
        // Finalise previous block (up to the line before this one)
        const blockEndLine = lineNum - 1;
        entries.push({
          renderedLineRange: [blockStartLine, blockEndLine],
          sourceFile: currentSource,
          // Source line ranges aren't available from kustomize output alone;
          // we report [1,1] as a sentinel indicating "whole file contributed".
          sourceLineRange: [1, 1],
          sourceKind: classifySourceKind(currentSource, overlayPath),
        });
      }
      currentSource = sourceMatch[1].trim();
      blockStartLine = lineNum;
    }
  }

  // Finalise the last block
  if (currentSource !== null) {
    entries.push({
      renderedLineRange: [blockStartLine, lines.length],
      sourceFile: currentSource,
      sourceLineRange: [1, 1],
      sourceKind: classifySourceKind(currentSource, overlayPath),
    });
  }

  return entries;
}

// ── Subprocess runner ─────────────────────────────────────────────────────────

/** Internal dependency indirection for testability. */
export const _deps = {
  spawnKustomize: async (
    overlayPath: string,
  ): Promise<{ stdout: string; stderr: string; code: number | null; exceeded: boolean }> => {
    return new Promise((resolve) => {
      const child = spawn('kustomize', ['build', overlayPath, '--network-policy=none'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: BUILD_TIMEOUT_MS,
        // Minimal env — no inherited secrets; kustomize only needs PATH
        env: { PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin' },
      });

      let stdout = '';
      let stderr = '';
      // Track whether we killed the process for exceeding the byte cap.
      // SIGKILL causes close() to receive code=null (not -1), so without this
      // flag the "exceeds byte limit" path would be unreachable.
      let exceeded = false;

      child.stdout.on('data', (chunk: Buffer) => {
        if (exceeded) return; // discard further data after cap hit
        stdout += chunk.toString();
        if (Buffer.byteLength(stdout) > MAX_OUTPUT_BYTES) {
          exceeded = true;
          child.kill('SIGKILL');
        }
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        resolve({ stdout, stderr: err.message, code: -1, exceeded });
      });

      child.on('close', (code) => {
        resolve({ stdout, stderr, code, exceeded });
      });
    });
  },
};

// ── Tool factory ──────────────────────────────────────────────────────────────

export function createKustomizeBuildTool(workspaceRoot: string = process.cwd()): ToolContribution {
  return {
    name: 'core.kustomize_build',
    tool: tool({
      name: 'core.kustomize_build',
      description:
        'Renders a kustomize overlay directory by shelling out to `kustomize build`. ' +
        'Returns the fully-rendered multi-document YAML plus a source map that attributes ' +
        'each block to its originating file and classifies it as base, overlay, or patch. ' +
        'Secret data: and stringData: values are redacted to [REDACTED] before returning. ' +
        'Requires kustomize to be installed on PATH. Network access is disabled during build ' +
        '(--network-policy=none). Both paths must resolve within the workspace root. Timeout is 60 seconds.',
      parameters: KustomizeBuildInputSchema,
      execute: async (input): Promise<string> => {
        let overlayPath: string;
        try {
          overlayPath = validateBoundedPath(input.overlayPath, workspaceRoot, 'overlayPath');
        } catch (err) {
          return JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
            renderedYaml: '',
            sourceMap: [],
          });
        }

        const { stdout, stderr, code, exceeded } = await _deps.spawnKustomize(overlayPath);

        // Check exceeded BEFORE code — SIGKILL sets code=null (not -1), so the
        // `code !== 0` branch would otherwise swallow this as a generic failure.
        if (exceeded) {
          return JSON.stringify({
            error: `kustomize_build: rendered output exceeds ${MAX_OUTPUT_BYTES} byte limit`,
            renderedYaml: '',
            sourceMap: [],
          });
        }

        if (code !== 0) {
          const isNotInstalled =
            code === -1 ||
            stderr.includes('executable file not found') ||
            stderr.includes('kustomize: not found') ||
            stderr.includes('no such file or directory');

          if (isNotInstalled) {
            return JSON.stringify({
              error: 'kustomize is not installed or not on PATH. Install it from https://kubectl.docs.kubernetes.io/installation/kustomize/',
              renderedYaml: '',
              sourceMap: [],
            });
          }

          return JSON.stringify({
            error: `kustomize build failed (exit ${code}): ${stderr.slice(0, 512)}`,
            renderedYaml: '',
            sourceMap: [],
          });
        }

        const redacted = redactSecretValues(stdout);

        const output: KustomizeBuildOutput = {
          renderedYaml: redacted,
          sourceMap: parseSourceMap(redacted, overlayPath),
        };

        return JSON.stringify(output);
      },
    }),
  };
}

/** Default singleton — registered at startup with process.cwd() as workspace root. */
export const kustomizeBuildTool: ToolContribution = createKustomizeBuildTool();
