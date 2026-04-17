import { tool } from '@openai/agents';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ToolContribution } from '@kickstart/harness';

const execFileAsync = promisify(execFile);

// ── Schema ────────────────────────────────────────────────────────────────────

const ValidateManifestsInputSchema = z.object({
  manifest: z
    .string()
    .min(1)
    .describe('Kubernetes YAML manifest content to validate'),
  manifestName: z
    .string()
    .optional()
    .describe('Optional display name for the manifest (used in error messages)'),
});

const ManifestDiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  line: z.number().optional(),
});

const ValidateManifestsOutputSchema = z.object({
  valid: z.boolean(),
  errorCount: z.number(),
  warningCount: z.number(),
  diagnostics: z.array(ManifestDiagnosticSchema),
  summary: z.string(),
});

// ── Static pre-checks ─────────────────────────────────────────────────────────

export interface ManifestDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
}

export function staticValidateManifest(yaml: string): ManifestDiagnostic[] {
  const diagnostics: ManifestDiagnostic[] = [];
  const lines = yaml.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;

    // Detect :latest tag usage
    if (/image:\s*\S+:latest\s*$/.test(line)) {
      diagnostics.push({
        severity: 'warning',
        message: `Line ${lineNo}: image uses ':latest' tag — pin to a digest or immutable tag`,
        line: lineNo,
      });
    }

    // Detect missing image tag entirely (bare image name)
    if (/^\s*-?\s*image:\s*[a-z][a-z0-9\-./]*\s*$/.test(line)) {
      diagnostics.push({
        severity: 'warning',
        message: `Line ${lineNo}: image has no tag — pin to a specific version`,
        line: lineNo,
      });
    }

    // Detect privileged: true
    if (/privileged:\s*true/.test(line)) {
      diagnostics.push({
        severity: 'error',
        message: `Line ${lineNo}: privileged containers are prohibited by AKS safeguards`,
        line: lineNo,
      });
    }

    // Detect hostPath volume
    if (/hostPath:/.test(line)) {
      diagnostics.push({
        severity: 'error',
        message: `Line ${lineNo}: hostPath volumes are prohibited by AKS safeguards`,
        line: lineNo,
      });
    }

    // Detect hostNetwork: true
    if (/hostNetwork:\s*true/.test(line)) {
      diagnostics.push({
        severity: 'error',
        message: `Line ${lineNo}: hostNetwork: true is prohibited by AKS safeguards`,
        line: lineNo,
      });
    }

    // Detect allowPrivilegeEscalation: true
    if (/allowPrivilegeEscalation:\s*true/.test(line)) {
      diagnostics.push({
        severity: 'error',
        message: `Line ${lineNo}: allowPrivilegeEscalation: true violates pod security standards`,
        line: lineNo,
      });
    }
  }

  // Check for missing apiVersion
  if (!/^apiVersion:/.test(yaml.trimStart())) {
    diagnostics.push({
      severity: 'error',
      message: 'Manifest is missing apiVersion',
    });
  }

  // Check for missing kind
  if (!/\bkind:\s*\w+/.test(yaml)) {
    diagnostics.push({
      severity: 'error',
      message: 'Manifest is missing kind',
    });
  }

  return diagnostics;
}

// ── kubectl dry-run ───────────────────────────────────────────────────────────

export async function kubectlDryRun(
  yaml: string
): Promise<{ passed: boolean; output: string; toolMissing?: boolean }> {
  // Write manifest to a temp file to avoid shell interpolation of user content
  const dir = await mkdtemp(join(tmpdir(), 'aks-validate-'));
  const manifestPath = join(dir, 'manifest.yaml');

  try {
    await writeFile(manifestPath, yaml, 'utf8');

    // CORRECT: use execFile with args array — no shell, no interpolation
    const { stdout, stderr } = await execFileAsync('kubectl', [
      'apply',
      '--dry-run=client',
      '-f',
      manifestPath,
    ]);

    return { passed: true, output: stdout || stderr };
  } catch (err: unknown) {
    if (err instanceof Error) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EACCES') {
        return { passed: false, output: err.message, toolMissing: true };
      }
    }
    const message =
      err instanceof Error
        ? err.message
        : 'kubectl dry-run failed with unknown error';
    return { passed: false, output: message };
  } finally {
    await unlink(manifestPath).catch(() => undefined);
    // Best-effort cleanup — ignore if already removed
  }
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const validateManifestsTool: ToolContribution = {
  name: 'aks.validate_manifests',
  tool: tool({
    name: 'aks.validate_manifests',
    description:
      'Validates a Kubernetes YAML manifest using kubectl --dry-run=client. ' +
      'Catches structural errors and AKS safeguard violations before any deployment. ' +
      'Does not require cluster connectivity for static checks; kubectl must be present for dry-run.',
    parameters: ValidateManifestsInputSchema,
    execute: async (
      input
    ): Promise<z.infer<typeof ValidateManifestsOutputSchema>> => {
      const name = input.manifestName ?? 'manifest';
      const staticDiagnostics = staticValidateManifest(input.manifest);

      // Run kubectl dry-run; fail closed if kubectl is not available
      let kubectlDiagnostic: ManifestDiagnostic | null = null;
      const dryRun = await kubectlDryRun(input.manifest);
      // If kubectl is not available, fail closed — never return valid:true without actual validation
      if (dryRun.toolMissing) {
        return {
          valid: false,
          errorCount: 1,
          warningCount: 0,
          diagnostics: [
            {
              severity: 'error',
              message:
                'kubectl is not available on this server — manifest validation requires kubectl',
            },
          ],
          summary: `${name}: kubectl unavailable — validation cannot proceed`,
        };
      }
      if (!dryRun.passed) {
        kubectlDiagnostic = {
          severity: 'error',
          message: `kubectl dry-run: ${dryRun.output.slice(0, 400)}`,
        };
      }

      const allDiagnostics: ManifestDiagnostic[] = [
        ...staticDiagnostics,
        ...(kubectlDiagnostic ? [kubectlDiagnostic] : []),
      ];

      const errorCount = allDiagnostics.filter((d) => d.severity === 'error').length;
      const warningCount = allDiagnostics.filter((d) => d.severity === 'warning').length;
      const valid = errorCount === 0;

      const summary = valid
        ? `${name}: valid (${warningCount} warning${warningCount === 1 ? '' : 's'})`
        : `${name}: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`;

      return {
        valid,
        errorCount,
        warningCount,
        diagnostics: allDiagnostics,
        summary,
      };
    },
  }),
};
