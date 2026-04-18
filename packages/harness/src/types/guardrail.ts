export interface GuardrailInput {
  stage: 'input' | 'output' | 'tool';
  userMessage?: string;       // input stage
  proposedOutput?: string;    // output stage
  toolName?: string;          // tool stage
  toolArgs?: Record<string, unknown>; // tool stage
}

export interface GuardrailResult {
  verdict: 'pass' | 'block' | 'redact';
  reason?: string;            // server-side only — NEVER emitted in SSE
  redacted?: unknown;         // for redact verdict (replaces stage payload)
  redactedArgs?: Record<string, unknown>; // structured tool arg replacement
}

export interface GuardrailContribution {
  /** Fully-qualified id: "{packId}/{guardrailId}", e.g. "core/no-credential-leak". */
  id: string;
  /** Agent-name globs this guardrail applies to. Use ["*"] for all agents. */
  appliesTo: string[];
  /** Which pipeline stages this guardrail should run on. */
  stages: Array<'input' | 'output' | 'tool'>;
  evaluate(input: GuardrailInput): Promise<GuardrailResult>;
}
