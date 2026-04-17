import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution } from '@kickstart/harness';
import type { SessionCtx } from '@kickstart/harness';

// ── GitHub path validation (Zapp conditions) ──────────────────────────────────

/**
 * Allowlist: 7 anchored patterns covering valid GitHub file paths.
 * decodeURIComponent is applied FIRST, then the two-step check.
 */
export const GITHUB_PATH_ALLOWLIST = [
  /^[\w\-. ]+$/,                                   // simple filename: README.md
  /^[\w\-. ]+\/[\w\-. /]+$/,                       // subpath: src/index.ts
  /^\.github\/[\w\-. /]+$/,                         // .github dir: .github/workflows/ci.yml
  /^[\w][\w\-. /]*[\w\-.]$/,                        // general path not starting with ./ or /
  /^docs\/[\w\-. /]+$/,                             // docs subpath
  /^k8s\/[\w\-. /]+$/,                              // k8s manifests
  /^[\w\-. ]+\.[\w]+$/,                             // file with extension at root
];

/**
 * Forbidden sequences: path traversal and double-slash variants.
 */
export const FORBIDDEN_SEQ = /(\.\.|%2e%2e|%252e|\/\/|\\)/i;

export function validateGithubPath(rawPath: string): string {
  const decoded = decodeURIComponent(rawPath);

  // Two-step: allowlist first, then forbidden-sequence rejection
  const isAllowed = GITHUB_PATH_ALLOWLIST.some((re) => re.test(decoded));
  if (!isAllowed) {
    throw new Error(
      `GitHub path not in allowlist: "${decoded}". Path must be a valid relative file path.`,
    );
  }
  if (FORBIDDEN_SEQ.test(decoded)) {
    throw new Error(
      `GitHub path contains a forbidden sequence (traversal or double-slash): "${decoded}"`,
    );
  }

  return decoded;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const GITHUB_API_BASE = 'https://api.github.com';

const ApiGetInputSchema = z.object({
  path: z
    .string()
    .describe(
      'GitHub API path, e.g. /repos/{owner}/{repo} or /users/{username}. Must start with /.',
    ),
  params: z
    .record(z.string(), z.string())
    .optional()
    .describe('Optional query string parameters'),
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const apiGetTool: ToolContribution = {
  name: 'github.api_get',
  tool: tool({
    name: 'github.api_get',
    description:
      'Read-only GitHub REST API GET. Returns parsed JSON. ' +
      'Token is injected from session — never passed as a parameter. ' +
      'Requires a GitHub session established via github:login.',
    parameters: ApiGetInputSchema,
    execute: async (input, runCtx): Promise<unknown> => {
      const session = runCtx?.context as SessionCtx | undefined;
      const token =
        (session as unknown as { tokens?: Record<string, string> })?.tokens?.['github'];
      if (!token) {
        throw new Error(
          'No GitHub token found in session. Please authenticate first via github:login.',
        );
      }

      const url = new URL(`${GITHUB_API_BASE}${input.path}`);
      if (input.params) {
        for (const [key, value] of Object.entries(input.params)) {
          url.searchParams.set(key, value);
        }
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        throw new Error(
          `GitHub API error ${response.status}: ${response.statusText}`,
        );
      }

      return response.json();
    },
  }),
};
