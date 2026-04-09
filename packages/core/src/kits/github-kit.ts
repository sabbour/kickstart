/**
 * @module @kickstart/core/kits/github-kit
 *
 * GitHubKit — bundles GitHub-specific tools, connectors, and system-prompt
 * augmentations into a single registerable unit.
 *
 * Provided tools:
 *   - github_repo_info   (detect runtime, language, CI setup, topics)
 *
 * Provided connectors:
 *   - GitHubConnector    (GitHub REST API with OAuth Device Flow + PAT auth)
 *
 * Component registrations (rendered by packages/web):
 *   - githubLoginCard    (OAuth Device Flow sign-in card)
 *   - githubRepoPicker   (repository picker with search and pagination)
 */

import type { IntegrationKit } from './types.js';
import { githubRepoInfo } from '../tools/github-repo-info.js';
import { GitHubConnector } from '../connectors/GitHubConnector.js';

export const githubKit: IntegrationKit = {
  name: 'github',
  description:
    'GitHub integration kit — repository inspection, CI detection, and source-to-AKS deployment wiring.',

  tools: [
    githubRepoInfo,
  ],

  connectors: [
    new GitHubConnector(),
  ],

  prompts: [
    // Repository-first approach
    'When a user provides a GitHub repository URL or name, always call github_repo_info first to detect ' +
    'the primary language, runtime framework, default branch, and existing CI workflows. Use this to ' +
    'inform your deployment recommendations without asking the user what language their app uses.',

    // CI/CD wiring
    'When generating deployment artifacts, always include a GitHub Actions workflow (.github/workflows/deploy.yml) ' +
    'that builds the container image, pushes to ACR, and triggers a rolling update on AKS. ' +
    'The workflow should use OIDC Workload Identity — never hardcode credentials.',

    // Branch strategy
    'Recommend a trunk-based deployment strategy: pushes to the default branch trigger production deploys. ' +
    'Pull requests trigger preview environment deploys on a separate AKS namespace.',
  ],

  components: [
    {
      type: 'githubLoginCard',
      description: 'OAuth Device Flow sign-in card with token confirmation',
    },
    {
      type: 'githubRepoPicker',
      description: 'Repository picker with search, pagination, and org/personal account support',
    },
  ],
};
