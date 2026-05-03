import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@aks-kickstart/harness';
import type { SessionCtx } from '@aks-kickstart/harness';
import { getGithubToken } from '../services/github-auth.js';
import { stripNulls } from '@aks-kickstart/harness/runtime/z-strict';
import { strictOptional } from '@aks-kickstart/harness/runtime/z-strict';

const GITHUB_API_BASE = 'https://api.github.com';

export const UpdatePrDescriptionInputSchema = z.object({
  owner: z.string().describe('Repository owner (user or org login).'),
  repo: z.string().describe('Repository name.'),
  pullNumber: z.number().int().min(1).describe('Pull request number (must be a positive integer).'),
  body: z.string().describe(
    'New PR description (markdown). When appendMode is true, this text is appended to the existing body.',
  ),
  appendMode: strictOptional(z.boolean()).describe(
    'When true, appends body to the existing PR description instead of replacing it. Pass null to replace (default).',
  ),
});

export type UpdatePrDescriptionInput = z.infer<typeof UpdatePrDescriptionInputSchema>;

// ── Core logic (exported for testing) ─────────────────────────────────────────

export async function executeUpdatePrDescription(
  input: UpdatePrDescriptionInput,
  token: string,
): Promise<{ success: boolean; url: string }> {
  const { owner, repo, pullNumber, body, appendMode } = input;
  // URL-encode owner and repo to prevent path injection (e.g. names containing '/').
  const prUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`;
  // NOTE: appendMode performs a GET then PATCH with no locking — last-write-wins race possible
  // under concurrent calls. Acceptable for the current use case (single-agent handover sim).

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };

  let finalBody = body;

  if (appendMode) {
    const getRes = await fetch(prUrl, { method: 'GET', headers });
    if (!getRes.ok) {
      throw new Error(
        `GitHub API error ${getRes.status} fetching PR #${pullNumber}: ${getRes.statusText}`,
      );
    }
    const prData = (await getRes.json()) as { body?: string | null };
    const existing = prData.body ?? '';
    finalBody = existing ? `${existing}\n\n${body}` : body;
  }

  const patchRes = await fetch(prUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ body: finalBody }),
  });

  if (!patchRes.ok) {
    throw new Error(
      `GitHub API error ${patchRes.status} updating PR #${pullNumber}: ${patchRes.statusText}`,
    );
  }

  const updated = (await patchRes.json()) as { html_url: string };
  return { success: true, url: updated.html_url };
}

// ── Tool ──────────────────────────────────────────────────────────────────────

export const updatePrDescriptionTool: ToolContribution = {
  name: 'github.update_pr_description',
  tool: tool({
    name: 'github.update_pr_description',
    description:
      'Update (or append to) the description of an existing pull request. ' +
      'Wraps PATCH /repos/{owner}/{repo}/pulls/{pull_number}. ' +
      'When appendMode is true, the existing body is fetched first and the new text is appended. ' +
      'Token is injected from session — never passed as a parameter. ' +
      'Requires a GitHub session established via github:login.',
    parameters: UpdatePrDescriptionInputSchema,
    execute: async (input, runCtx): Promise<{ success: boolean; url: string }> => {
      const session = runCtx?.context as SessionCtx | undefined;
      const token = getGithubToken(session);
      const clean = stripNulls(input) as UpdatePrDescriptionInput;
      return executeUpdatePrDescription(clean, token);
    },
  }),
};
