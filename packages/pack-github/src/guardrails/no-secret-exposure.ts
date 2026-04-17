import type { GuardrailContribution, GuardrailVerdict } from '@kickstart/harness';

/**
 * no-secret-exposure guardrail.
 *
 * Blocks LLM output and tool results that contain patterns matching GitHub tokens,
 * OAuth codes, or other credential-like strings. Operates at the output stage.
 */

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{36}/,       // GitHub personal access token
  /github_pat_[A-Za-z0-9_]{82}/, // Fine-grained PAT
  /gho_[A-Za-z0-9]{36}/,       // GitHub OAuth token
  /ghs_[A-Za-z0-9]{36}/,       // GitHub Actions token
  /ghr_[A-Za-z0-9]{36}/,       // GitHub refresh token
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i, // Generic Bearer token in output
];

function containsSecret(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

export const noSecretExposureGuardrail: GuardrailContribution = {
  name: 'github/no-secret-exposure',
  stage: 'output',
  appliesTo: ['github.*'],
  check: async (_ctx, payload): Promise<GuardrailVerdict> => {
    if (!payload) return { kind: 'pass' };

    let text: string;
    try {
      text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    } catch {
      // Cannot serialize payload — fail closed to avoid leaking unserializable secrets
      return { kind: 'block', reason: 'Payload serialization failed — blocking as precaution' };
    }

    if (containsSecret(text)) {
      return {
        kind: 'block',
        reason:
          'Response blocked: it appears to contain a GitHub token or credential. ' +
          'Tokens must never appear in LLM output, SSE payloads, or tool results.',
      };
    }

    return { kind: 'pass' };
  },
};
