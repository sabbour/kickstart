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
import { Phase } from '../engine/types.js';
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
    // Repository-first approach (general — all phases)
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

  phasePrompts: {
    [Phase.Discover]: [
      'If the user provides a GitHub repository URL or repo name, immediately call github_repo_info to detect ' +
      'the runtime language, framework, default branch, and any existing CI workflows. ' +
      'Use the result to pre-fill app details — do not ask questions you can answer from the repo.',
    ],

    [Phase.Design]: [
      'When designing the CI/CD pipeline, check for existing GitHub Actions workflows via github_repo_info. ' +
      'If the user already has CI set up, extend it rather than replacing it. ' +
      'Recommend a trunk-based strategy: default branch → production, PRs → preview environments.',
    ],

    [Phase.Generate]: [
      'Generate a GitHub Actions workflow at .github/workflows/deploy.yml. It must:\n' +
      '  • Trigger on push to the default branch and on pull_request\n' +
      '  • Build and push the container image to ACR using OIDC (azure/login@v2 + workload identity)\n' +
      '  • Run `az aks get-credentials` then apply deployment files\n' +
      '  • Never hardcode Azure credentials, subscription IDs, or tokens in the workflow file\n' +
      'Use github_repo_info to confirm the default branch name before generating.',
    ],

    [Phase.Handoff]: [
      'Walk the user through getting their generated files into GitHub:\n' +
      '  1. Ask: new repo or push to existing? Use ChoicePicker.\n' +
      '  2. Show AuthCard for GitHub sign-in if needed.\n' +
      '  3. After push: "Your workflow will deploy automatically on every push to {branch}."\n' +
      '  4. Offer a Codespaces link so they can edit and iterate in the browser.',
    ],

    [Phase.Deploy]: [
      'The GitHub Actions workflow handles deployment automatically. ' +
      'If the user wants to trigger a manual deploy, explain they can push to the default branch or ' +
      'use workflow_dispatch from the GitHub Actions tab. ' +
      'Show the Actions run URL once deployment starts.',
    ],
  },

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
