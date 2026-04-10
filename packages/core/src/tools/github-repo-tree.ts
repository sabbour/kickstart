/**
 * @module @kickstart/core/tools/github-repo-tree
 *
 * Get the recursive file tree for a GitHub repository.
 * Used in the Discover-phase repo analysis protocol to understand
 * project structure before reading individual files.
 */

import type { Tool } from "../types.js";
import { defaultConnectorRegistry } from "../connectors/index.js";
import type { GitHubConnector } from "../connectors/index.js";

interface GitHubRepoTreeArgs {
  owner: string;
  repo: string;
  ref?: string;
}

/** Well-known files that signal app type, runtime, or deployment readiness. */
const KEY_FILE_PATTERNS = [
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  'package.json',
  'go.mod',
  'requirements.txt',
  'pyproject.toml',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'Gemfile',
  'composer.json',
  '.github/workflows/',
  'kubernetes/',
  'k8s/',
  'deploy/',
  'helm/',
  'Chart.yaml',
  'kustomization.yaml',
  'Makefile',
  'tsconfig.json',
  '.dockerignore',
];

export const githubRepoTree: Tool<GitHubRepoTreeArgs> = {
  name: "github_repo_tree",
  description:
    "Get the recursive file tree for a GitHub repository. Returns all file and directory paths, " +
    "sizes, and highlights well-known deployment-related files (Dockerfile, package.json, " +
    "CI workflows, K8s manifests, etc.). Use this in the Discover phase to understand " +
    "repository structure before reading individual files.",
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
      ref: {
        type: "string",
        description:
          "Git ref (branch, tag, or SHA) to read the tree from. Defaults to HEAD.",
      },
    },
    required: ["owner", "repo"],
  },

  async execute(args: GitHubRepoTreeArgs): Promise<unknown> {
    const gh = defaultConnectorRegistry.get("github") as
      | GitHubConnector
      | undefined;
    if (!gh || !gh.isAuthenticated()) {
      // Stub fallback
      return {
        owner: args.owner,
        repo: args.repo,
        ref: args.ref ?? "HEAD",
        totalFiles: 5,
        tree: [
          "package.json",
          "Dockerfile",
          "src/",
          "src/index.ts",
          ".github/workflows/ci.yml",
        ],
        keyFiles: ["Dockerfile", "package.json", ".github/workflows/ci.yml"],
        truncated: false,
        _stub: true,
      };
    }

    const treeData = await gh.getTree(args.owner, args.repo, args.ref);

    // Extract just the paths for a compact listing
    const paths = treeData.tree.map((entry) => {
      if (entry.type === "tree") return entry.path + "/";
      return entry.path;
    });

    // Identify well-known files for deployment analysis
    const keyFiles = treeData.tree
      .filter((entry) =>
        KEY_FILE_PATTERNS.some(
          (pattern) =>
            entry.path === pattern ||
            entry.path.endsWith("/" + pattern) ||
            entry.path.startsWith(pattern),
        ),
      )
      .map((entry) => entry.path);

    return {
      owner: args.owner,
      repo: args.repo,
      ref: args.ref ?? "HEAD",
      totalFiles: treeData.tree.filter((e) => e.type === "blob").length,
      tree: paths,
      keyFiles,
      truncated: treeData.truncated,
    };
  },
};
