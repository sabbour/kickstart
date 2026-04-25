import { createHash } from 'crypto';
import { dump as yamlDump } from 'js-yaml';
import type {
  GenGhaWorkflowInput,
  GenGhaWorkflowOutput,
  ValidatedGenGhaWorkflowInput,
} from './schema.js';
import {
  GenGhaWorkflowInputSchema,
  validateJobName,
  validateStepName,
  validateEnvKey,
  validateStepContent,
} from './schema.js';

/**
 * Generates a deterministic hash of the generated workflow for verification.
 * Returns the full SHA-256 hex digest (64 characters).
 */
function computeDeterminismHash(yaml: string): string {
  return createHash('sha256').update(yaml).digest('hex');
}

/**
 * Sorts object keys recursively for canonical YAML output.
 */
function sortKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sortKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sorted[key] = sortKeys(obj[key]);
      });
    return sorted;
  }
  return obj;
}

/**
 * Validates all security constraints on the workflow definition.
 */
function validateSecurityConstraints(input: ValidatedGenGhaWorkflowInput): void {
  // Validate job names
  for (const job of input.jobs) {
    validateJobName(job.name);

    // Validate step names and content
    for (const step of job.steps) {
      validateStepName(step.name);

      // Validate step content (run command)
      if (step.run) {
        validateStepContent(step.run);
      }

      // Validate environment variables
      if (step.env) {
        for (const [key, value] of Object.entries(step.env)) {
          validateEnvKey(key);
          validateStepContent(value);
        }
      }

      // Validate 'with' field values
      if (step.with) {
        for (const [key, value] of Object.entries(step.with)) {
          if (typeof value === 'string') {
            validateStepContent(value);
          }
        }
      }
    }

    // Validate job-level environment variables
    if (job.env) {
      for (const [key, value] of Object.entries(job.env)) {
        validateEnvKey(key);
        validateStepContent(value);
      }
    }
  }
}

/**
 * Builds the OIDC login step for Azure.
 *
 * Uses the `azureClientId` from the validated input directly — the client ID (Azure App Registration
 * application ID) is not a secret and can be embedded in the workflow YAML. The tenant ID and
 * subscription ID are similarly non-sensitive configuration values.
 *
 * The action is pinned to a full commit SHA to prevent supply-chain attacks. Update the SHA
 * (and the inline version comment) when upgrading to a new release.
 */
function buildAzureLoginStep(input: ValidatedGenGhaWorkflowInput) {
  return {
    name: 'Azure Login (OIDC)',
    // Pinned to v2.3.0 SHA — update via Dependabot / Renovate when upgrading.
    uses: 'azure/login@a65d910e75af5eb049a18f3210df71aca9a5d46', // v2.3.0
    with: {
      'client-id': input.azureClientId,
      'tenant-id': input.azureTenantId,
      'subscription-id': input.azureSubscriptionId,
    },
  };
}

/**
 * Converts job definition to GitHub Actions job format.
 *
 * NOTE: GitHub Actions steps do NOT support an `outputs` field.
 * To expose outputs, use a step `id` + `echo "key=value" >> $GITHUB_OUTPUT`,
 * then reference at the job level via `jobs.<job>.outputs`.
 *
 * NOTE: Action version tags (e.g. `actions/checkout@v4`) in caller-provided steps are not
 * validated or pinned here. See the SKILL.md for the documented tradeoff.
 */
function transformJob(job: any) {
  return {
    name: job.name,
    'runs-on': job.runsOn,
    ...(job.env ? { env: job.env } : {}),
    steps: job.steps.map((step: any) => ({
      name: step.name,
      ...(step.uses ? { uses: step.uses } : {}),
      ...(step.run ? { run: step.run } : {}),
      ...(step.with ? { with: step.with } : {}),
      ...(step.env ? { env: step.env } : {}),
    })),
    ...(job.outputs ? { outputs: job.outputs } : {}),
  };
}

/**
 * Builds the trigger configuration.
 */
function buildTrigger(triggers: string[], schedule?: string) {
  const trigger: any = {};
  
  for (const t of triggers) {
    if (t === 'push') {
      trigger.push = { branches: ['main'] };
    } else if (t === 'pull_request') {
      trigger.pull_request = {};
    } else if (t === 'workflow_dispatch') {
      trigger.workflow_dispatch = {};
    } else if (t === 'schedule') {
      trigger.schedule = [{ cron: schedule || '0 2 * * 0' }];
    }
  }
  
  return trigger;
}

/**
 * Generates a GitHub Actions CI/CD workflow with OIDC + Managed Identity.
 *
 * Enforces:
 * - Determinism (identical input → identical YAML, verified by hash)
 * - Security (OIDC only, no secrets, dangerous pattern rejection)
 * - Canonical format (sorted keys, consistent indentation)
 *
 * @param input - Workflow definition (name, trigger, jobs, Azure credentials)
 * @returns Deterministic, production-ready workflow YAML
 * @throws {Error} if validation fails (security, schema, security constraints)
 */
export async function genGhaWorkflow(input: GenGhaWorkflowInput): Promise<GenGhaWorkflowOutput> {
  // 1. Validate schema
  const validated = GenGhaWorkflowInputSchema.parse(input);

  // 2. Validate security constraints
  validateSecurityConstraints(validated);

  // 3. Build workflow object
  const jobs: any = {};
  for (const job of validated.jobs) {
    const transformedJob = transformJob(job);
    
    // Prepend OIDC login step if not already present
    const hasAzureLogin = transformedJob.steps.some((s: any) => s.uses?.includes('azure/login'));
    if (!hasAzureLogin) {
      transformedJob.steps.unshift(buildAzureLoginStep(validated));
    }
    
    jobs[job.name] = transformedJob;
  }

  const workflow = {
    name: validated.name,
    on: buildTrigger(validated.trigger),
    permissions: {
      contents: 'read',
      'id-token': 'write',
    },
    ...(validated.concurrency ? { concurrency: {
      group: validated.concurrency.group,
      'cancel-in-progress': validated.concurrency.cancelInProgress ?? true,
    }} : {}),
    jobs,
  };

  // 4. Sort keys for determinism
  const sortedWorkflow = sortKeys(workflow);

  // 5. Generate YAML
  const yamlContent = yamlDump(sortedWorkflow, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    skipInvalid: false,
  });

  // 6. Compute determinism hash
  const determinismHash = computeDeterminismHash(yamlContent);

  // 7. Validate YAML structure (parse it back)
  let isYamlValid = false;
  try {
    // Verify the generated YAML round-trips through js-yaml without error.
    // Note: this does NOT validate against the GitHub Actions JSON schema.
    const yamlModule = await import('js-yaml');
    yamlModule.load(yamlContent);
    isYamlValid = true;
  } catch (err) {
    isYamlValid = false;
  }

  return {
    filename: `.github/workflows/${validated.name}.yml`,
    content: yamlContent,
    isYamlValid,
    determinismHash,
  };
}

export type { GenGhaWorkflowInput, GenGhaWorkflowOutput };
