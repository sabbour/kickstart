/**
 * @module @kickstart/core/tools/github-repo-info
 *
 * Get GitHub repository metadata (language, topics, CI setup, etc.).
 * Stub implementation — real calls wired by APIConnector (B-11).
 */

import type { Tool } from "../types.js";

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
    // Stub — APIConnector (B-11) will replace with real GitHub API calls
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
