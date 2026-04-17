import type { GuardrailContribution } from '@kickstart/harness';

/**
 * Patterns that indicate PII in text content.
 * Deliberately conservative — only high-confidence patterns.
 */
const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Social Security Number: 123-45-6789 or 123456789
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  // Credit card: 16-digit groups separated by spaces or dashes
  { name: 'credit-card', pattern: /\b(?:\d[ -]?){13,16}\b/ },
  // IPv4 followed by sensitive-looking context
  { name: 'ip-address-in-log', pattern: /\b(?:client|user|remote)\s*ip\s*[=:]\s*\d{1,3}(?:\.\d{1,3}){3}/i },
];

function extractText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try {
    return JSON.stringify(payload);
  } catch {
    return '';
  }
}

export const noPiiInLogsGuardrail: GuardrailContribution = {
  name: 'no-pii-in-logs',
  stage: 'output',
  check: async (_ctx, payload) => {
    const text = extractText(payload);
    for (const { name, pattern } of PII_PATTERNS) {
      if (pattern.test(text)) {
        return {
          kind: 'block',
          reason: `Output blocked: possible ${name} detected in agent response. Remove PII before proceeding.`,
        };
      }
    }
    return { kind: 'pass' };
  },
};
