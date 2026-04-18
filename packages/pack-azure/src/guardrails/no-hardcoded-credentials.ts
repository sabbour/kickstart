import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@kickstart/harness';

/**
 * Blocks tool calls that contain embedded credential patterns in their args.
 * Complements the core/no-credential-leak guardrail with Azure-specific patterns.
 */

const HARDCODED_CREDENTIAL_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Hardcoded subscription key / API key literals
  { name: 'hardcoded-api-key', pattern: /["']?(?:api[_-]?key|subscription[_-]?key|ocp[_-]?apim[_-]?key)["']?\s*[=:]\s*["'][A-Za-z0-9]{20,}["']/i },
  // Storage account key in connection string
  { name: 'storage-account-key', pattern: /AccountKey=[A-Za-z0-9+/]{40,}==/i },
  // ARM deployment parameter with literal secret
  { name: 'arm-secret-param', pattern: /"(?:adminPassword|sasToken|storageKey)"\s*:\s*"[^"]{8,}"/i },
  // Azure SQL connection string with password
  { name: 'azure-sql-password', pattern: /(?:Password|Pwd)=[^;'"]{8,}/i },
];

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return ''; }
}

export const noHardcodedCredentialsGuardrail: GuardrailContribution = {
  id: 'azure/no-hardcoded-credentials',
  appliesTo: ['*'],
  stages: ['tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    const text = extractText(input.toolArgs);

    for (const { name, pattern } of HARDCODED_CREDENTIAL_PATTERNS) {
      if (pattern.test(text)) {
        return {
          verdict: 'block',
          reason: `Hardcoded credential detected in tool args (${name}). Use Key Vault references or environment variables instead of embedding secrets in tool parameters.`,
        };
      }
    }

    return { verdict: 'pass' };
  },
};
