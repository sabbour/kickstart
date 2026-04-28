/**
 * Shared type contract for the GitHub auth hook injected from `packages/web/`
 * into `pack-github` renderers.
 *
 * Lives in pack-github so the pack does not import from `packages/web/`
 * (preserves the pack-boundary invariant established in PR #190). The web
 * layer imports these types when wiring `setGitHubAuthHook(useGitHubAuth)`.
 *
 * Security note (Zapp DR conditions on issue #179):
 * - Least-privilege contract: only non-secret session metadata is exposed.
 *   No tokens, no raw cookies, no auth headers.
 * - The bridge is single-assignment at boot; runtime overwrite is rejected.
 * - Auth payloads must not be logged verbatim to console / telemetry.
 */

/** Minimal viewer summary surfaced to renderers — non-secret display fields only. */
export interface GitHubAuthBridgeViewer {
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string;
  readonly htmlUrl: string;
}

/** Owner (user or org) summary — non-secret display fields only. */
export interface GitHubAuthBridgeOwner {
  readonly login: string;
  readonly type: 'User' | 'Organization';
  readonly label: string;
  readonly avatarUrl: string;
  readonly htmlUrl: string;
}

/** Non-secret session shape mirrored from `GitHubAuthContext` in web. */
export interface GitHubAuthBridgeSession {
  readonly authenticated: boolean;
  readonly configured: boolean;
  readonly viewer?: GitHubAuthBridgeViewer;
  readonly owners: ReadonlyArray<GitHubAuthBridgeOwner>;
  readonly error?: string;
}

/**
 * Value returned by the injected hook. Renderers consume this; web supplies it.
 *
 * Action methods are async and reject (or resolve with the next session
 * snapshot via `refresh`) — they MUST NOT surface raw provider error payloads.
 */
export interface GitHubAuthBridgeValue {
  readonly loading: boolean;
  readonly session: GitHubAuthBridgeSession | null;
  readonly authenticated: boolean;
  readonly error: string | undefined;
  readonly signIn: () => Promise<void>;
  readonly signOut: () => Promise<void>;
  readonly refresh: () => Promise<void>;
}

/** A React hook that returns the current bridge value. */
export type GitHubAuthHook = () => GitHubAuthBridgeValue;
