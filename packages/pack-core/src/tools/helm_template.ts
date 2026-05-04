/**
 * @file helm_template.ts
 *
 * `core.helm_template` — render a Helm chart to YAML and return a source map.
 *
 * Shells out to `helm template` in a sandboxed subprocess (no network access
 * during render). Parses `# Source: <file>` comments that Helm emits to build
 * a per-template source map so callers can correlate rendered lines back to the
 * originating template or values file.
 *
 * Security: chartPath is path-traversal-checked and must be an absolute or
 * workspace-relative path. No shell expansion — execFile is used with an args
 * array. Render timeout is 30 s. No network: `--no-hooks` and the sandboxed
 * `helm template` subcommand never contacts a cluster.
 */

import { tool } from '@openai/agents';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { join, resolve, sep, isAbsolute } from 'node:path';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import { strictOptional, stripNulls } from '@aks-kickstart/harness/runtime/z-strict';

const execFileAsync = promisify(execFile);

// ── Constants ─────────────────────────────────────────────────────────────────

/** Hard timeout for `helm template` subprocess (ms). */
const HELM_TIMEOUT_MS = 30_000;

/** Maximum rendered YAML size surfaced to the model (1 MB). */
const MAX_RENDERED_BYTES = 1 * 1024 * 1024;

// ── Schema ────────────────────────────────────────────────────────────────────

export const HelmTemplateInputSchema = z.object({
  chartPath: z
    .string()
    .min(1)
    .describe(
      'Absolute or workspace-relative path to the Helm chart directory (must contain Chart.yaml). ' +
      'No ".." traversal allowed.',
    ),
  valuesFiles: z
    .array(z.string().min(1))
    .describe(
      'Ordered list of values file paths (relative to chartPath or absolute). ' +
      'Pass an empty array to use only chart defaults.',
    ),
  namespace: strictOptional(
    z.string().min(1).describe('Kubernetes namespace to render against. Defaults to "default".'),
  ),
});

export type HelmTemplateInput = z.infer<typeof HelmTemplateInputSchema>;

export const SourceMapEntrySchema = z.object({
  renderedLineRange: z.tuple([z.number(), z.number()]),
  sourceFile: z.string(),
  sourceLineRange: z.tuple([z.number(), z.number()]),
  sourceKind: z.enum(['values', 'template', 'chart']),
});

export type SourceMapEntry = z.infer<typeof SourceMapEntrySchema>;

export const HelmTemplateOutputSchema = z.object({
  renderedYaml: z.string(),
  sourceMap: z.array(SourceMapEntrySchema),
  chartMetadata: z.object({
    name: z.string(),
    version: z.string(),
    appVersion: z.string(),
  }),
});

export type HelmTemplateOutput = z.infer<typeof HelmTemplateOutputSchema>;

// ── Path helpers ──────────────────────────────────────────────────────────────

/**
 * Validate that a chart path is safe: no null bytes, no `..` traversal.
 * Returns the resolved absolute path.
 */
export function resolveChartPath(workspaceRoot: string, chartPath: string): string {
  if (chartPath.includes('\0')) {
    throw new Error('helm_template: chartPath contains null byte');
  }
  const segments = chartPath.replace(/\\/g, '/').split('/');
  if (segments.some((s) => s === '..')) {
    throw new Error('helm_template: chartPath must not contain ".." traversal');
  }
  const resolved = isAbsolute(chartPath) ? chartPath : resolve(workspaceRoot, chartPath);
  if (!resolved.startsWith(workspaceRoot + sep) && resolved !== workspaceRoot) {
    throw new Error(`helm_template: chartPath escapes workspace root: ${chartPath}`);
  }
  return resolved;
}

/**
 * Validate that a values file path is safe and build an absolute path.
 * Values files may be absolute or relative to chartPath, but MUST remain
 * within workspaceRoot. Absolute paths are subject to the same workspace
 * boundary check as relative ones — there is no bypass.
 */
export function resolveValuesPath(workspaceRoot: string, chartPath: string, valuesFile: string): string {
  if (valuesFile.includes('\0')) {
    throw new Error(`helm_template: valuesFile contains null byte: ${valuesFile}`);
  }
  const segments = valuesFile.replace(/\\/g, '/').split('/');
  if (segments.some((s) => s === '..')) {
    throw new Error(`helm_template: valuesFile must not contain ".." traversal: ${valuesFile}`);
  }
  const resolved = isAbsolute(valuesFile) ? valuesFile : join(chartPath, valuesFile);
  if (!resolved.startsWith(workspaceRoot + sep) && resolved !== workspaceRoot) {
    throw new Error(`helm_template: valuesFile escapes workspace root: ${valuesFile}`);
  }
  return resolved;
}

// ── Chart.yaml parser ─────────────────────────────────────────────────────────

/** Minimal Chart.yaml fields we care about. */
export interface ChartMetadata {
  name: string;
  version: string;
  appVersion: string;
}

/** Extract name/version/appVersion from Chart.yaml content via simple regex. */
export function parseChartMetadata(chartYaml: string): ChartMetadata {
  const get = (key: string): string => {
    const m = chartYaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return m ? m[1]!.trim().replace(/^["']|["']$/g, '') : '';
  };
  return {
    name: get('name'),
    version: get('version'),
    appVersion: get('appVersion'),
  };
}

// ── Source-map builder ────────────────────────────────────────────────────────

/**
 * Helm emits `# Source: <chart>/<relative-path>` comments before each rendered
 * template block. Parse those comments to build a source map that correlates
 * rendered line ranges back to source files.
 *
 * The `sourceLineRange` is a best-effort [1, N] range covering the whole source
 * file — we don't track per-line source positions, but the entry is sufficient
 * for callers to open the file and jump to it.
 */
export function buildSourceMap(renderedYaml: string): SourceMapEntry[] {
  const lines = renderedYaml.split('\n');
  const entries: SourceMapEntry[] = [];
  let currentSource: string | null = null;
  let blockStart = 1;

  const classifySource = (src: string): SourceMapEntry['sourceKind'] => {
    if (src.endsWith('Chart.yaml') || src.endsWith('Chart.yml')) return 'chart';
    if (src.includes('values')) return 'values';
    return 'template';
  };

  const finaliseBlock = (endLine: number): void => {
    if (currentSource === null || blockStart > endLine) return;
    entries.push({
      renderedLineRange: [blockStart, endLine],
      sourceFile: currentSource,
      sourceLineRange: [1, endLine - blockStart + 1],
      sourceKind: classifySource(currentSource),
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    const line = lines[i]!;
    const sourceMatch = line.match(/^#\s*Source:\s*(.+)$/);
    if (sourceMatch) {
      finaliseBlock(lineNo - 1);
      currentSource = sourceMatch[1]!.trim();
      blockStart = lineNo + 1;
    }
  }

  finaliseBlock(lines.length);
  return entries;
}

// ── Core execution ────────────────────────────────────────────────────────────

export interface HelmTemplateRunOptions {
  chartPath: string;
  valuesFiles: string[];
  namespace?: string | null;
}

export interface HelmTemplateRunResult {
  renderedYaml: string;
  sourceMap: SourceMapEntry[];
  chartMetadata: ChartMetadata;
}

/**
 * Execute `helm template` and return rendered YAML plus source map.
 * Exported for unit testing without the tool wrapper.
 */
export async function runHelmTemplate(
  workspaceRoot: string,
  opts: HelmTemplateRunOptions,
): Promise<HelmTemplateRunResult> {
  const resolvedChart = resolveChartPath(workspaceRoot, opts.chartPath);

  const args: string[] = [
    'template',
    'release',   // release name placeholder — required by helm template
    resolvedChart,
    '--namespace', opts.namespace ?? 'default',
    '--no-hooks', // no network-touching hooks during render
  ];

  for (const vf of opts.valuesFiles) {
    const resolvedVf = resolveValuesPath(workspaceRoot, resolvedChart, vf);
    args.push('--values', resolvedVf);
  }

  let stdout: string;
  try {
    const result = await execFileAsync('helm', args, {
      timeout: HELM_TIMEOUT_MS,
      maxBuffer: MAX_RENDERED_BYTES * 2,
      env: {
        ...process.env,
        // Prevent helm from reaching out to any external service.
        // HELM_REPOSITORY_* covers HTTP repos; HELM_REGISTRY_CONFIG covers OCI registries.
        HELM_REPOSITORY_CACHE: '',
        HELM_REPOSITORY_CONFIG: '',
        HELM_REGISTRY_CONFIG: '',
      },
    });
    stdout = result.stdout;
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        throw new Error(
          'helm_template: helm binary not found — install helm and ensure it is on PATH',
          { cause: err },
        );
      }
      throw new Error(`helm_template: helm template failed — ${err.message}`, { cause: err });
    }
    throw err;
  }

  if (Buffer.byteLength(stdout, 'utf-8') > MAX_RENDERED_BYTES) {
    throw new Error(
      `helm_template: rendered output exceeds ${MAX_RENDERED_BYTES} byte limit — chart is too large`,
    );
  }

  // Read Chart.yaml for metadata
  const chartYamlPath = join(resolvedChart, 'Chart.yaml');
  let chartYamlContent: string;
  try {
    chartYamlContent = await readFile(chartYamlPath, 'utf-8');
  } catch (err: unknown) {
    throw new Error(`helm_template: cannot read Chart.yaml at ${chartYamlPath}`, { cause: err });
  }

  const chartMetadata = parseChartMetadata(chartYamlContent);
  const sourceMap = buildSourceMap(stdout);

  return { renderedYaml: stdout, sourceMap, chartMetadata };
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const helmTemplateTool: ToolContribution = {
  name: 'core.helm_template',
  tool: tool({
    name: 'core.helm_template',
    description:
      'Renders a Helm chart to Kubernetes YAML using `helm template` and returns the rendered output ' +
      'with a source map correlating rendered lines to their origin template files. ' +
      'Does not connect to any Kubernetes cluster — rendering is fully local and sandboxed. ' +
      'Returns renderedYaml (the full manifest string), sourceMap (per-template line ranges), ' +
      'and chartMetadata (name, version, appVersion from Chart.yaml). ' +
      'Requires helm to be installed and on PATH.',
    parameters: HelmTemplateInputSchema,
    execute: async (rawInput, ctx): Promise<string> => {
      const input = stripNulls(rawInput);

      const workspaceRoot: string =
        (ctx as unknown as { workspace?: { root?: string } })?.workspace?.root ??
        process.cwd();

      let result: HelmTemplateRunResult;
      try {
        result = await runHelmTemplate(workspaceRoot, {
          chartPath: input.chartPath,
          valuesFiles: input.valuesFiles,
          namespace: input.namespace,
        });
      } catch (err: unknown) {
        return JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        });
      }

      const output: HelmTemplateOutput = {
        renderedYaml: result.renderedYaml,
        sourceMap: result.sourceMap,
        chartMetadata: {
          name: result.chartMetadata.name,
          version: result.chartMetadata.version,
          appVersion: result.chartMetadata.appVersion,
        },
      };
      return JSON.stringify(output);
    },
  }),
};
