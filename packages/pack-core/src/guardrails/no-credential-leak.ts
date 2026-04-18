import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@kickstart/harness';

/**
 * no-credential-leak guardrail.
 *
 * Detects credentials in ALL pipeline stages (input, output, tool) and ALWAYS
 * returns `block` — credentials are never redacted, only blocked.
 *
 * Detected patterns:
 *  - Azure access tokens (Bearer eyJ…)
 *  - GitHub PATs (ghp_, ghs_, github_pat_)
 *  - Azure SAS tokens (sv=…&sig=…)
 *  - Azure connection strings (AccountKey=, SharedAccessSignature=)
 *  - JWT bearer tokens
 *  - SSH private keys
 */

const CREDENTIAL_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Azure access token (JWT Bearer)
  { name: 'azure-access-token', pattern: /Bearer\s+eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/i },
  // Generic JWT (three base64url segments)
  { name: 'jwt-token', pattern: /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/ },
  // GitHub PATs (min 30 chars after prefix — real tokens are 36+ but check 30+ for test coverage)
  { name: 'github-pat-ghp', pattern: /\bghp_[A-Za-z0-9]{30,}\b/ },
  { name: 'github-pat-ghs', pattern: /\bghs_[A-Za-z0-9]{30,}\b/ },
  { name: 'github-pat-fine', pattern: /\bgithub_pat_[A-Za-z0-9_]{30,}\b/ },
  // Azure SAS token (query string sig= param)
  { name: 'azure-sas-token', pattern: /sv=\d{4}-\d{2}-\d{2}[^"'\s]*&sig=[A-Za-z0-9%+/=]{20,}/i },
  // Azure storage connection string / account key
  { name: 'azure-connection-string', pattern: /(?:AccountKey|SharedAccessSignature)=[A-Za-z0-9+/=]{20,}/i },
  // Generic connection strings with passwords
  { name: 'connection-string-password', pattern: /(?:Password|Pwd)=[^;]{8,}/i },
  // SSH private key block
  { name: 'ssh-private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

function containsCredential(text: string): string | null {
  for (const { name, pattern } of CREDENTIAL_PATTERNS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

function extractText(value: unknown): string {
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value); } catch { return ''; }
}

export const noCredentialLeakGuardrail: GuardrailContribution = {
  id: 'core/no-credential-leak',
  appliesTo: ['*'],
  stages: ['input', 'output', 'tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    let text: string;

    switch (input.stage) {
      case 'input':
        text = input.userMessage ?? '';
        break;
      case 'output':
        text = input.proposedOutput ?? '';
        break;
      case 'tool':
        text = extractText(input.toolArgs);
        break;
    }

    const credentialType = containsCredential(text);
    if (credentialType) {
      return {
        verdict: 'block',
        reason: `Credential detected in ${input.stage} payload (${credentialType}). Credential leak blocked.`,
      };
    }

    return { verdict: 'pass' };
  },
};
