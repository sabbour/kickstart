/**
 * @module @kickstart/core/tools/github-api-get
 *
 * General-purpose read-only GitHub REST API tool.
 * Uses GitHubConnector when authenticated; returns an error otherwise.
 */

import type { Tool } from "../types.js";
import { defaultConnectorRegistry } from "../connectors/index.js";

interface GitHubApiGetArgs {
  path: string;
  accept?: string;
}

export const githubApiGet: Tool<GitHubApiGetArgs> = {
  name: "github_api_get",
  description:
    "Make a read-only GET request to the GitHub REST API. Use this to fetch any GitHub resource — repos, issues, pull requests, actions, users, etc. The path is relative to https://api.github.com.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "API path relative to https://api.github.com, e.g. '/repos/owner/repo/issues' or '/users/octocat'",
      },
      accept: {
        type: "string",
        description:
          "Optional Accept header override. Defaults to 'application/vnd.github+json'.",
      },
    },
    required: ["path"],
  },

  async execute(args: GitHubApiGetArgs): Promise<unknown> {
    const gh = defaultConnectorRegistry.get("github");
    if (!gh || !gh.isAuthenticated()) {
      return {
        error: "GitHub connector is not authenticated. Sign in to use GitHub API tools.",
        _stub: true,
      };
    }

    try {
      const headers: Record<string, string> = {};
      if (args.accept) headers.Accept = args.accept;

      const res = await gh.request("GET", args.path, undefined, { headers });

      if (!res.ok) {
        return {
          error: `GitHub API returned ${res.status}: ${res.statusText}`,
          status: res.status,
        };
      }

      const data = await res.json();

      // Slim down large array responses to avoid blowing context
      if (Array.isArray(data) && data.length > 50) {
        return {
          count: data.length,
          items: data.slice(0, 50),
          truncated: true,
        };
      }

      return data;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
