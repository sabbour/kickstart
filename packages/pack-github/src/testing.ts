/**
 * Test-only entry point for `@aks-kickstart/pack-github`.
 *
 * Exposes helpers that exist solely to support unit/integration tests of
 * pack-github (or downstream packs that compose it). These helpers MUST
 * NOT be reachable from the production client surface
 * (`@aks-kickstart/pack-github/client`) — the package.json `exports` map
 * keeps this subpath separate so production bundles cannot import it
 * even by accident.
 *
 * Boundary rationale (Zapp DR on PR #235): the previous revision
 * re-exported `__resetGitHubAuthHookForTests` from `./client`, which
 * shipped a runtime escape hatch capable of clearing the single-assignment
 * auth bridge in production. Moving it here removes that risk while
 * preserving test ergonomics.
 *
 * Consumers should import as:
 *
 *   import { __resetGitHubAuthHookForTests }
 *     from '@aks-kickstart/pack-github/testing';
 */

export { __resetGitHubAuthHookForTests } from './auth-bridge.js';
