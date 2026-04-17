import type { SessionCtx } from './session.js';

export type GuardrailVerdict =
  | { kind: 'pass' }
  | { kind: 'block'; reason: string }
  | { kind: 'rewrite'; payload: unknown };

export interface GuardrailContribution {
  name: string;
  stage: 'input' | 'output' | 'tool';
  appliesTo?: string[];
  check: (ctx: SessionCtx, payload: unknown) => Promise<GuardrailVerdict>;
}
