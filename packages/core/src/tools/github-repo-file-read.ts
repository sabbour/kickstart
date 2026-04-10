/**
 * @module @kickstart/core/tools/github-repo-file-read
 *
 * Read a specific file from a GitHub repository.
 * Used in the Discover-phase repo analysis protocol to inspect
 * Dockerfiles, package.json, K8s manifests, and CI workflows.
 */

import type { Tool } from "../types.js";
import { defaultConnectorRegistry } from "../connectors/index.js";
import type { GitHubConnector } from "../connectors/index.js";

interface GitHubRepoFileReadArgs {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

/** Maximum decoded file size (in bytes) to return inline. */
const MAX_INLINE_SIZE = 100_000;

/** Portable base64 decode that works in both Node.js and browsers. */
function decodeBase64(encoded: string): string {
  // GitHub API returns content with newlines in the base64 — strip them
  const cleaned = encoded.replace(/\n/g, '');
  return globalThis.atob(cleaned);
}

export const githubRepoFileRead: Tool<GitHubRepoFileReadArgs> = {
  name: "github_repo_file_read",
  description:
    "Read the contents of a specific file from a GitHub repository. Returns the decoded " +
    "text content for files up to 100 KB. Use after github_repo_tree to read key files " +
    "like Dockerfile, package.json, K8s manifests, or CI workflow definitions.",
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
      path: {
        type: "string",
        description:
          "Path to the file within the repository, e.g. 'Dockerfile' or 'src/package.json'",
      },
      ref: {
        type: "string",
        description:
          "Git ref (branch, tag, or SHA). Defaults to the repository's default branch.",
      },
    },
    required: ["owner", "repo", "path"],
  },

  async execute(args: GitHubRepoFileReadArgs): Promise<unknown> {
    const gh = defaultConnectorRegistry.get("github") as
      | GitHubConnector
      | undefined;
    if (!gh || !gh.isAuthenticated()) {
      return {
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        content: "# stub content -- authenticate to read real files",
        size: 0,
        _stub: true,
      };
    }

    try {
      const file = await gh.getFileContent(
        args.owner,
        args.repo,
        args.path,
        args.ref,
      );

      if (file.type === "dir") {
        return {
          owner: args.owner,
          repo: args.repo,
          path: args.path,
          error: "Path is a directory, not a file. Use github_repo_tree to list directory contents.",
        };
      }

      if (!file.content || !file.encoding) {
        return {
          owner: args.owner,
          repo: args.repo,
          path: args.path,
          error: "File content not available (may exceed GitHub API size limit). Use github_api_get with the raw media type.",
          size: file.size,
          htmlUrl: file.html_url,
        };
      }

      // Decode base64 content
      const decoded = decodeBase64(file.content);

      if (decoded.length > MAX_INLINE_SIZE) {
        return {
          owner: args.owner,
          repo: args.repo,
          path: args.path,
          content: decoded.slice(0, MAX_INLINE_SIZE),
          truncated: true,
          totalSize: file.size,
          htmlUrl: file.html_url,
        };
      }

      return {
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        content: decoded,
        size: file.size,
        htmlUrl: file.html_url,
      };
    } catch (err) {
      return {
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
