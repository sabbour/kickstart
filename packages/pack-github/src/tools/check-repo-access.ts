import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { getGithubToken } from '../services/github-auth.js';

const GITHUB_API_BASE = 'https://api.github.com';

// ── Output schema ─────────────────────────────────────────────────────────────

export const RepoAccessPermission = z.enum(['admin', 'write', 'read', 'none', 'unknown']);
export type RepoAccessPermission = z.infer<typeof RepoAccessPermission>;

export const SuggestedAction = z.enum(['create_pr', 'fork_and_pr', 'request_review']);
export type SuggestedAction = z.infer<typeof SuggestedAction>;

export const CheckRepoAccessResult = z.object({
  permission: RepoAccessPermission,
  hasWriteAccess: z.boolean(),
  suggestedAction: SuggestedAction,
});
export type CheckRepoAccessResult = z.infer<typeof CheckRepoAccessResult>;

// ── Input schema ──────────────────────────────────────────────────────────────

const CheckRepoAccessInputSchema = z.object({
  owner: z.string().describe('Repository owner (org or user login)'),
  repo: z.string().describe('Repository name'),
  username: z.string().describe('GitHub username to check access for'),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export function deriveResult(permission: string): CheckRepoAccessResult {
  const parsed = RepoAccessPermission.safeParse(permission);
  const perm: RepoAccessPermission = parsed.success ? parsed.data : 'unknown';
  const hasWriteAccess = perm === 'admin' || perm === 'write';
  const suggestedAction: SuggestedAction = hasWriteAccess
    ? 'create_pr'
    : 'fork_and_pr';
  return { permission: perm, hasWriteAccess, suggestedAction };
}

/**
 * Fetches the collaborator permission level for a user on a repo.
 * Returns a CheckRepoAccessResult. 403/404 are treated as `none` access.
 *
 * @internal exported for testing
 */
export async function fetchRepoAccess(
  owner: string,
  repo: string,
  username: string,
  token: string,
): Promise<CheckRepoAccessResult> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/collaborators/${encodeURIComponent(username)}/permission`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  // 404 or 403 means not a collaborator → no write access
  if (response.status === 404 || response.status === 403) {
    return { permission: 'none', hasWriteAccess: false, suggestedAction: 'fork_and_pr' };
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${response.status} checking repo access: ${response.statusText}`,
    );
  }

  const body = (await response.json()) as { permission?: string };
  return deriveResult(body.permission ?? 'unknown');
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const checkRepoAccessTool: ToolContribution = {
  name: 'github.check_repo_access',
  tool: tool({
    name: 'github.check_repo_access',
    description:
      'Checks the authenticated user\'s permission level for a GitHub repository. ' +
      'Returns permission level (admin/write/read/none/unknown), ' +
      'whether the user has write access, and a suggested action ' +
      '(create_pr if write access, fork_and_pr if not). ' +
      'Use this before github:create_pr when targeting a third-party repository.',
    parameters: CheckRepoAccessInputSchema,
    execute: async (input, runCtx): Promise<CheckRepoAccessResult> => {
      const session = runCtx?.context as SessionCtx | undefined;
      const token = getGithubToken(session);
      return fetchRepoAccess(input.owner, input.repo, input.username, token);
    },
  }),
};
