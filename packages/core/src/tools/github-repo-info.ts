/**
 * @module @kickstart/core/tools/github-repo-info
 *
 * Get GitHub repository metadata (language, topics, CI setup, etc.).
 * Uses GitHubConnector when authenticated; returns stub data otherwise.
 */

import type { Tool } from "../types.js";
import { defaultConnectorRegistry } from "../connectors/index.js";
import type { GitHubConnector } from "../connectors/index.js";

interface GitHubRepoInfoArgs {
  owner: string;
  repo: string;
}

export const githubRepoInfo: Tool<GitHubRepoInfoArgs> = {
  name: "github_repo_info",
  description:
    "Get GitHub repository metadata including primary language, topics, default branch, and CI workflow presence. Use this to auto-detect app runtime and deployment patterns.",
  parameters: {
    type: "object",
    properties: {
      owner: {
        type: "string",
        description: "GitHub organization or username that owns the repository",
      },
      repo: {
        type: "string",
        description: "Repository name",
      },
    },
    required: ["owner", "repo"],
  },

  async execute(args: GitHubRepoInfoArgs): Promise<unknown> {
    const gh = defaultConnectorRegistry.get("github") as GitHubConnector | undefined;
    if (gh && gh.isAuthenticated()) {
      const repo = await gh.getRepo(args.owner, args.repo);
      return {
        fullName: repo.full_name,
        description: repo.description,
        defaultBranch: repo.default_branch,
        language: repo.language,
        private: repo.private,
        url: repo.html_url,
      };
    }

    // Stub fallback for offline / unauthenticated development
    return {
      fullName: `${args.owner}/${args.repo}`,
      description: "Sample repository description",
      defaultBranch: "main",
      language: "TypeScript",
      topics: ["nodejs", "docker", "kubernetes"],
      hasDockerfile: true,
      hasWorkflows: false,
      workflowFiles: [],
      url: `https://github.com/${args.owner}/${args.repo}`,
      _stub: true,
    };
  },
};
