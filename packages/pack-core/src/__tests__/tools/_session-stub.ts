/**
 * Minimal SessionCtx stub shared across Phase C tool tests.
 *
 * Replace with the real factory from @aks-kickstart/harness once SessionCtx
 * has a concrete constructor / builder in the runtime package.
 */

import type { SessionCtx } from '@aks-kickstart/harness';

export function makeSessionCtx(
  overrides: Partial<SessionCtx> = {},
): SessionCtx {
  const ctx: SessionCtx = {
    sessionId: 'test-session-001',
    user: { tid: 'tid-test', oid: 'oid-test', upn: 'test@example.com' },
    intent: null,
    artifacts: new Map(),
    a2uiEmissions: [],
    liveSurfaceIds: new Set<string>(),
    maxLiveSurfaces: 1000,
    negotiatedCatalog: {
      id: 'test-catalog',
      components: ['Button', 'Text', 'CodeBlock', 'AuthCard', 'ProgressSteps'],
      userActions: ['confirm', 'cancel'],
    },
    recentTurns: [],
    toolCallItems: [],
    activeAgent: 'core.triage',
    pendingUserAction: null,
    recordA2UIEmission(msg) {
      this.a2uiEmissions.push(msg);
      const m = msg as unknown as {
        createSurface?: { surfaceId?: string };
        deleteSurface?: { surfaceId?: string };
      };
      if (m.createSurface && typeof m.createSurface.surfaceId === 'string') {
        this.liveSurfaceIds.add(m.createSurface.surfaceId);
      } else if (m.deleteSurface && typeof m.deleteSurface.surfaceId === 'string') {
        this.liveSurfaceIds.delete(m.deleteSurface.surfaceId);
      }
    },
    recordArtifact(artifact) {
      this.artifacts.set(artifact.path, artifact);
    },
    recordTurn(turn) {
      this.recentTurns.push(turn);
    },
    recordToolCallRecord(record) {
      this.toolCallItems.push(record);
      if (this.toolCallItems.length > 200) {
        this.toolCallItems.splice(0, this.toolCallItems.length - 200);
      }
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
