import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@aks-kickstart/harness';

/**
 * no-credential-leak guardrail (#115).
 *
 * Detects credentials in ALL pipeline stages (input, output, tool) and ALWAYS
 * returns `block` — credentials are never redacted, only blocked.
 *
 * Detected patterns:
 *  - Azure access tokens (Bearer eyJ…)
 *  - GitHub PATs (ghp_, ghs_, github_pat_)
 *  - Azure SAS tokens (sv=…&sig=…)
 *  - Azure connection strings (AccountKey=, SharedAccessSignature=)
 *  - Azure subscription keys (SubscriptionKey=…)
 *  - Azure client secrets (ClientSecret=…)
 *  - ARM Bearer tokens (Authorization: Bearer …)
 *  - Postgres/SQL DSN passwords (postgres://user:pass@…)
 *  - JWT bearer tokens
 *  - SSH private keys
 *  - Generic connection strings with passwords
 *
 * Kill-switch: set KICKSTART_GUARDRAILS_DISABLED=true to bypass (dev only).
 */

const CREDENTIAL_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Azure access token (JWT Bearer)
  { name: 'azure-access-token', pattern: /Bearer\s+eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/i },
  // ARM Bearer token (explicit — also catches non-JWT Bearer headers)
  { name: 'arm-bearer-token', pattern: /[Aa]uthorization:\s*Bearer\s+[A-Za-z0-9_.\\-]{20,}/ },
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
  // Azure subscription key (APIM / Cognitive Services)
  { name: 'azure-subscription-key', pattern: /[Ss]ubscription[Kk]ey["'\s:=]+[A-Za-z0-9+/=]{20,}/ },
  // Azure client secret (service principal)
  { name: 'azure-client-secret', pattern: /[Cc]lient[Ss]ecret["'\s:=]+[A-Za-z0-9~._\-]{20,}/ },
  // Postgres/SQL DSN password: postgres://user:pass@host
  { name: 'postgres-dsn-password', pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]{8,}@/ },
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
    if (process.env.KICKSTART_GUARDRAILS_DISABLED === 'true') {
      return { verdict: 'pass' };
    }

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
