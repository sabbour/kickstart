/**
 * GitHub authentication service.
 *
 * Provides helpers for reading GitHub tokens from the session context.
 * Tokens are always read from the session context — NEVER from SSE events,
 * browser props, or environment variables at runtime.
 */

import type { SessionCtx } from '@aks-kickstart/harness';

/**
 * Reads the GitHub API token from the session context.
 * Throws if no token is present (user must authenticate via github:login first).
 */
export function getGithubToken(session: SessionCtx | undefined): string {
  const tokens = (session as unknown as { tokens?: Record<string, string> })?.tokens;
  const token = tokens?.['github'];
  if (!token) {
    throw new Error(
      'No GitHub token found in session. ' +
      'Please authenticate first using the github:login action.',
    );
  }
  return token;
}
