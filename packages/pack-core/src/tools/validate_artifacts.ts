import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import { runHadolint } from '../validators/hadolint.js';
import type { ValidatorResult } from '../validators/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum content size per file (10 MB) — Zapp advisory. */
const MAX_CONTENT_BYTES = 10 * 1024 * 1024;

// ── Schema ────────────────────────────────────────────────────────────────────

const ArtifactFileSchema = z.object({
  path: z.string().min(1).describe('Relative file path (e.g. "Dockerfile", "infra/main.bicep").'),
  content: z
    .string()
    .max(MAX_CONTENT_BYTES, `File content exceeds ${MAX_CONTENT_BYTES} byte limit`)
    .describe('UTF-8 content of the generated file.'),
});

const ValidateArtifactsInputSchema = z.object({
  files: z
    .array(ArtifactFileSchema)
    .min(1)
    .describe(
      'Array of in-memory artifacts to validate. Each entry includes the file path and its content. ' +
      'The dispatcher routes each file to the appropriate validator based on filename/extension: ' +
      'Dockerfile → hadolint, others → skipped (no validator yet).',
    ),
});

/** Output schema returned as JSON to the LLM. */
export const ValidateArtifactsResultSchema = z.object({
  results: z.array(
    z.object({
      path: z.string(),
      status: z.enum(['pass', 'fail', 'skipped']),
      violations: z.array(
        z.object({
          rule: z.string(),
          severity: z.enum(['error', 'warning', 'info']),
          line: z.number(),
          message: z.string(),
          fix: z.string().optional(),
        }),
      ),
      reason: z.string().optional(),
    }),
  ),
});

export type ValidateArtifactsResult = z.infer<typeof ValidateArtifactsResultSchema>;

// ── Dispatcher ────────────────────────────────────────────────────────────────

/** Returns true if a filename matches a Dockerfile pattern. */
function isDockerfile(filePath: string): boolean {
  const basename = filePath.split('/').pop() ?? '';
  return (
    basename === 'Dockerfile' ||
    basename.toLowerCase().endsWith('.dockerfile')
  );
}

/**
 * Route a file to its validator based on filename/extension.
 * Returns a ValidatorResult — never throws.
 */
async function dispatch(path: string, content: string): Promise<ValidatorResult> {
  if (isDockerfile(path)) {
    return runHadolint(path, content);
  }

  // Future: .bicep → bicep validator, .yaml/.yml → k8s schema, etc.
  return {
    path,
    status: 'skipped',
    violations: [],
    reason: 'no validator registered for this file type',
  };
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const validateArtifactsTool: ToolContribution = {
  name: 'core.validate_artifacts',
  tool: tool({
    name: 'core.validate_artifacts',
    description:
      'Validates generated artifacts by routing each file to the appropriate linter. ' +
      'Currently supports Dockerfile validation via hadolint. Other file types are skipped. ' +
      'Pass in-memory file content — no filesystem access required. ' +
      'Returns per-file status (pass/fail/skipped) with detailed violations including rule ID, severity, line number, and message.',
    parameters: ValidateArtifactsInputSchema,
    execute: async (input): Promise<string> => {
      const results = await Promise.all(
        input.files.map((f) => dispatch(f.path, f.content)),
      );

      const output: ValidateArtifactsResult = { results };
      return JSON.stringify(output);
    },
  }),
};
