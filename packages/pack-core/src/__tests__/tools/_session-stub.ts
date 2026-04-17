/**
 * Minimal SessionCtx stub shared across Phase C tool tests.
 *
 * Replace with the real factory from @kickstart/harness once SessionCtx
 * has a concrete constructor / builder in the runtime package.
 */

import type { SessionCtx } from '@kickstart/harness';

export function makeSessionCtx(
  overrides: Partial<SessionCtx> = {},
): SessionCtx {
  const ctx: SessionCtx = {
    sessionId: 'test-session-001',
    user: { tid: 'tid-test', oid: 'oid-test', upn: 'test@example.com' },
    intent: null,
    artifacts: new Map(),
    a2uiEmissions: [],
    negotiatedCatalog: {
      id: 'test-catalog',
      components: ['Button', 'Text', 'CodeBlock', 'AuthCard', 'ProgressSteps'],
      userActions: ['confirm', 'cancel'],
    },
    recentTurns: [],
    activeAgent: 'core.orchestrator',
    pendingUserAction: null,
    recordA2UIEmission(msg) {
      this.a2uiEmissions.push(msg);
    },
    recordArtifact(artifact) {
      this.artifacts.set(artifact.path, artifact);
    },
    recordTurn(turn) {
      this.recentTurns.push(turn);
    },
    async getAzureCreds() {
      return null;
    },
    async getGithubToken() {
      return 'test-token';
    },
    ...overrides,
  };
  return ctx;
}
