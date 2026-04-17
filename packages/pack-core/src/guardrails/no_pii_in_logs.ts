import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@kickstart/harness';

/**
 * Patterns that indicate PII in text content.
 * Deliberately conservative — only high-confidence patterns.
 */
const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // Email addresses
  { name: 'email', pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED-EMAIL]' },
  // Social Security Number: 123-45-6789
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
  // US phone numbers: (123) 456-7890, 123-456-7890, +1-123-456-7890
  { name: 'phone', pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, replacement: '[REDACTED-PHONE]' },
];

function redactPii(text: string): { redacted: string; found: boolean } {
  let result = text;
  let found = false;
  for (const { pattern, replacement } of PII_PATTERNS) {
    const next = result.replace(pattern, replacement);
    if (next !== result) found = true;
    result = next;
  }
  return { redacted: result, found };
}

function extractText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try { return JSON.stringify(payload); } catch { return ''; }
}

export const noPiiInLogsGuardrail: GuardrailContribution = {
  id: 'core/no-pii-in-logs',
  appliesTo: ['*'],
  stages: ['output', 'tool'],
  async evaluate(input: GuardrailInput): Promise<GuardrailResult> {
    let text: string;
    if (input.stage === 'output') {
      text = input.proposedOutput ?? '';
    } else if (input.stage === 'tool') {
      text = extractText(input.toolArgs);
    } else {
      return { verdict: 'pass' };
    }

    const { redacted, found } = redactPii(text);
    if (!found) return { verdict: 'pass' };

    if (input.stage === 'output') {
      return { verdict: 'redact', redacted, reason: 'PII detected in output — redacted.' };
    }

    // Tool stage: redact args
    try {
      const newArgs = JSON.parse(redacted) as Record<string, unknown>;
      return { verdict: 'redact', redactedArgs: newArgs, reason: 'PII detected in tool args — redacted.' };
    } catch {
      // If args can't be re-parsed after redaction, return redacted as raw string
      return { verdict: 'redact', redacted, reason: 'PII detected in tool args — redacted.' };
    }
  },
};
