import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';

// ── Schema ────────────────────────────────────────────────────────────────────

const ValidateBicepInputSchema = z.object({
  bicep: z.string().min(1).describe('Bicep template source code to validate'),
  templateName: z
    .string()
    .optional()
    .describe('Optional display name for the template (used in error messages)'),
});

const DiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  code: z.string(),
  message: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
});

const ValidateBicepOutputSchema = z.object({
  valid: z.boolean(),
  errorCount: z.number(),
  warningCount: z.number(),
  diagnostics: z.array(DiagnosticSchema),
  summary: z.string(),
});

// ── Validation rules ──────────────────────────────────────────────────────────

interface BicepDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  line?: number;
}

function staticValidateBicep(bicep: string): BicepDiagnostic[] {
  const diagnostics: BicepDiagnostic[] = [];
  const lines = bicep.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;

    // Unpinned API version (@latest is not valid Bicep, but catch @[year without pin])
    if (/@'\d{4}-\d{2}-\d{2}'\s*$/.test(line) === false && /@'/.test(line)) {
      // skip — it has a version
    }

    // Direct secret values in parameters (no securestring)
    if (/param\s+\w*(password|secret|key|token|connectionstring)\w*\s+string/i.test(line)) {
      diagnostics.push({
        severity: 'warning',
        code: 'BCP-SEC-001',
        message: `Sensitive parameter at line ${lineNo} should use '@secure()' decorator`,
        line: lineNo,
      });
    }

    // Public blob access enabled
    if (/allowBlobPublicAccess\s*:\s*true/i.test(line)) {
      diagnostics.push({
        severity: 'warning',
        code: 'BCP-SEC-002',
        message: `allowBlobPublicAccess: true at line ${lineNo} — disable for security baseline`,
        line: lineNo,
      });
    }

    // Wildcard NSG rules open to internet
    if (/sourceAddressPrefix\s*:\s*'?\*'?/.test(line) || /sourceAddressPrefix\s*:\s*'0\.0\.0\.0\/0'/.test(line)) {
      diagnostics.push({
        severity: 'warning',
        code: 'BCP-NET-001',
        message: `Open NSG rule (${line.trim()}) at line ${lineNo} — restrict source addresses`,
        line: lineNo,
      });
    }

    // Missing resource API version
    if (/resource\s+\w+\s+'[^@]+'/.test(line) && !line.includes('@')) {
      diagnostics.push({
        severity: 'error',
        code: 'BCP-API-001',
        message: `Resource declaration at line ${lineNo} is missing an API version (e.g. @2023-01-01)`,
        line: lineNo,
      });
    }
  }

  // Check for required structure
  if (!bicep.includes('resource ') && !bicep.includes('module ')) {
    diagnostics.push({
      severity: 'error',
      code: 'BCP-STR-001',
      message: 'Template contains no resource or module declarations',
    });
  }

  return diagnostics;
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const validateBicepTool: ToolContribution = {
  name: 'azure.validate_bicep',
  tool: tool({
    name: 'azure.validate_bicep',
    description:
      'Validates a Bicep template for common errors, security anti-patterns, and missing API versions. ' +
      'Performs static analysis without calling ARM. Does not require authentication.',
    parameters: ValidateBicepInputSchema,
    execute: async (input): Promise<z.infer<typeof ValidateBicepOutputSchema>> => {
      const diagnostics = staticValidateBicep(input.bicep);
      const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
      const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
      const valid = errorCount === 0;

      const name = input.templateName ?? 'template';
      const summary = valid
        ? `${name}: valid (${warningCount} warning${warningCount === 1 ? '' : 's'})`
        : `${name}: ${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'}`;

      return {
        valid,
        errorCount,
        warningCount,
        diagnostics: diagnostics.map((d) => ({
          severity: d.severity,
          code: d.code,
          message: d.message,
          line: d.line,
          column: undefined,
        })),
        summary,
      };
    },
  }),
};
