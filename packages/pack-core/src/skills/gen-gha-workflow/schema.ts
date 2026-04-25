import { z } from 'zod';

// Pattern validation
const JOB_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const STEP_NAME_PATTERN = /^[a-zA-Z0-9_\- ]+$/;
const ENV_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

// Blocklisted environment variable prefixes (security guardrail)
const BLOCKED_ENV_PREFIXES = [
  'AWS_',
  'GITHUB_TOKEN',
  'STRIPE_',
  'DATABASE_PASSWORD',
  'API_KEY',
  'SECRET_',
];

// Dangerous patterns to reject in step content (security guardrail)
const DANGEROUS_PATTERNS = [
  /\beval\s*\(/i,
  /\bexec\s*\(/i,
  /import\s*\(/i,
  /require\s*\(/i,
  /\|\s*curl/i,
  /\|\s*base64/i,
  /ghs_/,
  /ghp_/,
  /gho_/,
  /ghu_/,
  /ghr_/,
  /ghe_/,
  /github_pat_/,
];

/**
 * Validates job name against security rules.
 * @throws {Error} if job name is invalid
 */
export function validateJobName(name: string): void {
  if (!JOB_NAME_PATTERN.test(name)) {
    throw new Error(`Job name "${name}" must contain only alphanumeric characters, hyphens, and underscores`);
  }
  if (name.length > 100) {
    throw new Error(`Job name "${name}" exceeds 100 character limit`);
  }
}

/**
 * Validates step name against security rules.
 * @throws {Error} if step name is invalid
 */
export function validateStepName(name: string): void {
  if (!STEP_NAME_PATTERN.test(name)) {
    throw new Error(`Step name "${name}" contains invalid characters`);
  }
  if (name.length > 200) {
    throw new Error(`Step name "${name}" exceeds 200 character limit`);
  }
}

/**
 * Validates environment variable key against security rules.
 * @throws {Error} if env key is blocklisted or invalid
 */
export function validateEnvKey(key: string): void {
  if (!ENV_KEY_PATTERN.test(key)) {
    throw new Error(`Environment variable key "${key}" must be SCREAMING_SNAKE_CASE`);
  }
  for (const prefix of BLOCKED_ENV_PREFIXES) {
    if (key.startsWith(prefix)) {
      throw new Error(`Environment variable key "${key}" with prefix "${prefix}" is blocked for security`);
    }
  }
}

/**
 * Validates step content against dangerous patterns.
 * @throws {Error} if dangerous pattern detected
 */
export function validateStepContent(content: string): void {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(content)) {
      throw new Error(`Step content contains dangerous pattern: ${pattern.source}`);
    }
  }
}

// Zod schema definitions

// Use z.preprocess so the input type accepts string | string[] without requiring `as any` at call sites.
export const TriggerSchema = z.preprocess(
  (val) => (Array.isArray(val) ? val : [val]),
  z.array(z.enum(['push', 'pull_request', 'workflow_dispatch', 'schedule'])),
);

export const StepRunsOnSchema = z.enum(['ubuntu-latest', 'windows-latest', 'macos-latest', 'ubuntu-22.04', 'ubuntu-20.04']);

// Note: GitHub Actions steps do NOT support an `outputs` mapping — use job-level `outputs` with
// step `id` + `$GITHUB_OUTPUT` instead.
export const StepSchema = z
  .object({
    name: z.string().min(1).max(200),
    uses: z.string().optional(),
    run: z.string().optional(),
    with: z.record(z.string(), z.any()).optional(),
    env: z.record(z.string(), z.string()).optional(),
  })
  .refine((step) => step.uses !== undefined || step.run !== undefined, {
    message: 'Each step must have either "uses" (action reference) or "run" (shell command)',
  });

export const JobSchema = z.object({
  name: z.string().min(1).max(100),
  runsOn: StepRunsOnSchema,
  steps: z.array(StepSchema).min(1),
  env: z.record(z.string(), z.string()).optional(),
  outputs: z.record(z.string(), z.string()).optional(),
});

export const GenGhaWorkflowInputSchema = z.object({
  // Regex prevents path traversal: name is interpolated into the output filename.
  name: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/, 'Workflow name must contain only alphanumeric characters, hyphens, and underscores'),
  trigger: TriggerSchema,
  azureTenantId: z.string().uuid('Invalid Azure tenant ID (must be UUID format)'),
  azureSubscriptionId: z.string().uuid('Invalid Azure subscription ID (must be UUID format)'),
  azureClientId: z.string().uuid('Invalid Azure client ID (must be UUID format)'),
  jobs: z.array(JobSchema).min(1),
  concurrency: z
    .object({
      group: z.string(),
      cancelInProgress: z.boolean().optional(),
    })
    .optional(),
});

// Use z.input<> so callers can pass trigger as string | string[] without casting.
export type GenGhaWorkflowInput = z.input<typeof GenGhaWorkflowInputSchema>;

export const GenGhaWorkflowOutputSchema = z.object({
  filename: z.string(),
  content: z.string(),
  // isYamlValid: true when the generated output round-trips through js-yaml without error.
  // This does NOT validate against the GitHub Actions JSON schema.
  isYamlValid: z.boolean(),
  determinismHash: z.string(),
});

export type GenGhaWorkflowOutput = z.infer<typeof GenGhaWorkflowOutputSchema>;

// Internal type — the parsed/validated (post-transform) shape used within the skill.
export type ValidatedGenGhaWorkflowInput = z.output<typeof GenGhaWorkflowInputSchema>;
