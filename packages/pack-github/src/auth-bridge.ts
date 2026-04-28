/**
 * Hook-injection bridge for GitHub auth state into pack-github renderers.
 *
 * Issue #179 — `pack-github` components must not import from `packages/web/`,
 * but they need reactive auth state that originates in `GitHubAuthContext`
 * (which lives in web). The web layer calls `setGitHubAuthHook(useGitHubAuth)`
 * once at app boot; pack components consume the injected hook through
 * `useGitHubAuthBridge()`.
 *
 * Security & design constraints (Zapp DR + Nibbler DR on #179):
 *   1. **Single-assignment**: the hook is set exactly once during web bootstrap.
 *      A second `setGitHubAuthHook` call throws (rejects runtime overwrite).
 *   2. **Fail-fast on unset**: `useGitHubAuthBridge()` throws a clear error if
 *      consumed before the setter has run — no silent degradation.
 *   3. **Least-privilege contract**: the injected value type
 *      (`GitHubAuthBridgeValue`) exposes only non-secret session fields plus
 *      action methods. No tokens, no cookies, no headers.
 *   4. **No auth-payload leakage**: this module never logs the session value.
 *
 * Test seam: `__resetGitHubAuthHookForTests()` clears the module-singleton
 * state. It is intentionally underscore-prefixed and named with `ForTests` to
 * discourage runtime use.
 *
 * The shared type contract lives in `./auth-bridge.types.ts`.
 */

import type { GitHubAuthHook, GitHubAuthBridgeValue } from './auth-bridge.types.js';

let injectedHook: GitHubAuthHook | null = null;

/**
 * Inject the GitHub auth hook from the host application (web). Call this
 * exactly once during boot, before any pack-github component renders.
 *
 * @throws if called more than once (single-assignment guard).
 * @throws if the host environment lacks `window` (SSR / non-browser contexts).
 */
export function setGitHubAuthHook(hook: GitHubAuthHook): void {
  if (typeof window === 'undefined') {
    throw new Error(
      'setGitHubAuthHook() must be called in a browser environment (pack-github client renderers are browser-only).',
    );
  }
  if (injectedHook !== null) {
    throw new Error(
      'setGitHubAuthHook() has already been called. The GitHub auth bridge is single-assignment to prevent runtime overwrite of auth state.',
    );
  }
  if (typeof hook !== 'function') {
    throw new TypeError('setGitHubAuthHook(hook) requires a function.');
  }
  injectedHook = hook;
}

/**
 * Consume the injected GitHub auth hook from inside a pack-github renderer.
 *
 * @throws if `setGitHubAuthHook` has not yet been called. The error message
 *         tells the integrator exactly how to fix it; do not catch and
 *         silently degrade.
 */
export function useGitHubAuthBridge(): GitHubAuthBridgeValue {
  if (injectedHook === null) {
    throw new Error(
      'GitHubAuthBridge.hook not set — call setGitHubAuthHook(useGitHubAuth) from your web bootstrap (e.g. packages/web/src/main.tsx) before mounting pack-github components.',
    );
  }
  return injectedHook();
}

/**
 * Test-only helper to clear the module-singleton injected hook between tests.
 *
 * Production code MUST NOT call this. The underscore prefix and `ForTests`
 * suffix are part of the contract.
 */
export function __resetGitHubAuthHookForTests(): void {
  injectedHook = null;
}

/**
 * Read-only check used by tests / diagnostics. Does not invoke the hook.
 * Returns false before bootstrap, true after `setGitHubAuthHook` has run.
 */
export function isGitHubAuthHookSet(): boolean {
  return injectedHook !== null;
}
