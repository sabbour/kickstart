import type { GuardrailContribution } from '@kickstart/harness';

/**
 * High-entropy string detection: Shannon entropy >= 4.5 bits/char on a
 * base64/hex-looking token of 20+ characters is likely a secret.
 */
function shannonEntropy(s: string): number {
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / s.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Generic API key / secret token patterns
  { name: 'generic-api-key', pattern: /(?:api[_-]?key|secret|token|password)\s*[=:]\s*['"]?[A-Za-z0-9+/]{20,}['"]?/i },
  // AWS access key
  { name: 'aws-access-key', pattern: /AKIA[0-9A-Z]{16}/ },
  // GitHub PAT
  { name: 'github-pat', pattern: /ghp_[A-Za-z0-9]{36}/ },
  // Private key header
  { name: 'private-key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  // Azure storage SAS token
  { name: 'azure-sas', pattern: /sv=\d{4}-\d{2}-\d{2}&s[ps]=/ },
  // Connection strings containing passwords
  { name: 'connection-string', pattern: /(?:Password|AccountKey)=[^;]{8,}/i },
];

/** Minimum token length to apply entropy check. */
const MIN_ENTROPY_TOKEN_LENGTH = 20;
/** Shannon entropy threshold above which a token is flagged. */
const ENTROPY_THRESHOLD = 4.5;

function containsHighEntropyToken(text: string): boolean {
  // Split on whitespace and common delimiters
  const tokens = text.split(/[\s"',;=:{}[\]()<>]+/);
  for (const token of tokens) {
    if (
      token.length >= MIN_ENTROPY_TOKEN_LENGTH &&
      /^[A-Za-z0-9+/=_-]+$/.test(token) &&
      shannonEntropy(token) >= ENTROPY_THRESHOLD
    ) {
      return true;
    }
  }
  return false;
}

function extractText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export const noSecretsInArtifactsGuardrail: GuardrailContribution = {
  name: 'no-secrets-in-artifacts',
  stage: 'tool',
  appliesTo: ['core.write_file'],
  check: async (_ctx, payload) => {
    const text = extractText(payload);

    // Regex pattern check
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(text)) {
        return {
          kind: 'block',
          reason: `File write blocked: possible ${name} detected in artifact content. Remove secrets before writing to the artifact store.`,
        };
      }
    }

    // High-entropy token check
    if (containsHighEntropyToken(text)) {
      return {
        kind: 'block',
        reason:
          'File write blocked: high-entropy token detected in artifact content. This may be a secret or credential. Remove it before writing.',
      };
    }

    return { kind: 'pass' };
  },
};
