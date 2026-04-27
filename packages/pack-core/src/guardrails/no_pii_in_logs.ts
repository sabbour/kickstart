import type { GuardrailContribution, GuardrailInput, GuardrailResult } from '@aks-kickstart/harness';

/**
 * no-pii guardrail (#115).
 *
 * Detects and redacts PII in input, output, and tool stages.
 *
 * Patterns:
 *  - Email addresses             → [REDACTED-EMAIL]
 *  - US Social Security Numbers  → [REDACTED-SSN]
 *  - US phone numbers            → [REDACTED-PHONE]
 *  - Azure Subscription IDs      → [REDACTED-SUB-ID]  (GUID + context keyword)
 *  - AAD Object IDs              → [REDACTED-OID]     (GUID + context keyword)
 *
 * GUID context-gating: raw GUID patterns match too broadly (K8s manifests,
 * ARM resource IDs, SAS tokens). Both GUID types require a PII-context keyword
 * within GUID_CONTEXT_WINDOW characters of the GUID before redacting.
 *
 * Kill-switch: set KICKSTART_GUARDRAILS_DISABLED=true to bypass (dev only).
 */

/** Characters scanned on either side of a GUID for a context keyword. */
const GUID_CONTEXT_WINDOW = 60;

const GUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const SUB_ID_KEYWORDS = ['subscription', 'subscriptionid', 'subid', 'sub-id'];
const OID_KEYWORDS    = ['objectid', 'object_id', 'oid', 'userid', 'user_id'];

/**
 * Returns true if a PII-context keyword appears within GUID_CONTEXT_WINDOW
 * characters of the matched GUID (both before and after).
 */
function hasContextKeyword(text: string, matchStart: number, matchEnd: number, keywords: string[]): boolean {
  const windowStart = Math.max(0, matchStart - GUID_CONTEXT_WINDOW);
  const windowEnd   = Math.min(text.length, matchEnd + GUID_CONTEXT_WINDOW);
  const window = text.slice(windowStart, windowEnd).toLowerCase();
  return keywords.some((kw) => window.includes(kw));
}

/**
 * Redact context-gated GUIDs in text.
 * Replaces GUIDs that are adjacent to a PII keyword with the given placeholder.
 */
function redactContextGatedGuids(
  text: string,
  keywords: string[],
  placeholder: string,
): { result: string; found: boolean } {
  let result = '';
  let lastIndex = 0;
  let found = false;

  // Reset lastIndex on the shared pattern before each use
  GUID_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = GUID_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const end   = start + match[0].length;
    if (hasContextKeyword(text, start, end, keywords)) {
      result += text.slice(lastIndex, start) + placeholder;
      lastIndex = end;
      found = true;
    }
  }
  result += text.slice(lastIndex);
  return { result, found };
}

const SIMPLE_PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // Email addresses
  { name: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[REDACTED-EMAIL]' },
  // Social Security Number: 123-45-6789
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[REDACTED-SSN]' },
  // US phone numbers: (123) 456-7890, 123-456-7890, +1-123-456-7890
  { name: 'phone', pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, replacement: '[REDACTED-PHONE]' },
];

function redactPii(text: string): { redacted: string; found: boolean } {
  let result = text;
  let found = false;

  // Simple pattern replacements
  for (const { pattern, replacement } of SIMPLE_PII_PATTERNS) {
    const next = result.replace(pattern, replacement);
    if (next !== result) found = true;
    result = next;
  }

  // Azure Subscription ID (GUID + subscription context keyword)
  const subResult = redactContextGatedGuids(result, SUB_ID_KEYWORDS, '[REDACTED-SUB-ID]');
  if (subResult.found) { result = subResult.result; found = true; }

  // AAD Object ID (GUID + OID context keyword)
  const oidResult = redactContextGatedGuids(result, OID_KEYWORDS, '[REDACTED-OID]');
  if (oidResult.found) { result = oidResult.result; found = true; }

  return { redacted: result, found };
}

function extractText(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  try { return JSON.stringify(payload); } catch { return ''; }
}

export const noPiiGuardrail: GuardrailContribution = {
  id: 'core/no-pii',
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

    const { redacted, found } = redactPii(text);
    if (!found) return { verdict: 'pass' };

    if (input.stage === 'input') {
      return {
        verdict: 'redact',
        redacted,
        reason: 'PII detected in user input — redacted before storage and model send.',
      };
    }

    if (input.stage === 'output') {
      return { verdict: 'redact', redacted, reason: 'PII detected in output — redacted.' };
    }

    // Tool stage: redact args
    try {
      const newArgs = JSON.parse(redacted) as Record<string, unknown>;
      return { verdict: 'redact', redactedArgs: newArgs, reason: 'PII detected in tool args — redacted.' };
    } catch {
      // JSON re-parse failed after substitution — fail-closed: block rather than
      // risk passing through partially-redacted or malformed args.
      return { verdict: 'block', reason: 'PII detected in tool args — could not safely redact structured args.' };
    }
  },
};

/**
 * @deprecated Use noPiiGuardrail (id: core/no-pii) which now covers input stage too.
 * Kept for backward compatibility until all packs reference the new export.
 */
export const noPiiInLogsGuardrail = noPiiGuardrail;
