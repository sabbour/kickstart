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
 *   - githubRepoPicker   (repository picker with search and client-side filtering)
 */

import type { IntegrationKit } from './types.js';
import type { KitAuthRequirement } from './types.js';
import { Phase } from '../engine/types.js';
import { githubRepoInfo } from '../tools/github-repo-info.js';
import { GitHubConnector } from '../connectors/GitHubConnector.js';

const githubAuth: KitAuthRequirement[] = [
  {
    provider: 'github-oauth',
    scopes: ['repo', 'read:user'],
    optional: false,
  },
];

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
    'The workflow should use OIDC Workload Identity Federation — never hardcode credentials. ' +
    'OIDC eliminates secret rotation but requires one-time setup of Azure credentials as GitHub repository secrets.',

    // Branch strategy
    'Recommend a trunk-based deployment strategy: pushes to the default branch trigger production deploys. ' +
    'Pull requests trigger preview environment deploys on a separate AKS namespace.',

    // OIDC pipeline setup protocol
    'When setting up the CI/CD pipeline for the first time, guide the user through OIDC federation setup:\n' +
    '  1. Create an Entra app registration (or User-Assigned Managed Identity) in the target Azure tenant.\n' +
    '  2. Add a federated credential: issuer "https://token.actions.githubusercontent.com", ' +
    'subject "repo:{owner}/{repo}:ref:refs/heads/{default_branch}" (and optionally for pull_request).\n' +
    '  3. Grant the app/identity the required Azure RBAC roles (Contributor on the resource group, AcrPush on the ACR).\n' +
    '  4. Set three GitHub repository secrets: AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_SUBSCRIPTION_ID.\n' +
    '  5. The deploy.yml workflow uses `azure/login@v2` with `client-id`, `tenant-id`, `subscription-id` from those secrets.\n' +
    'This replaces service principal client secrets with short-lived, scope-limited OIDC tokens. ' +
    'No secret rotation is needed. The federated credential is scoped to the specific repo and branch.',
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
      '  • Use `azure/login@v2` with OIDC: read client-id, tenant-id, subscription-id from GitHub secrets\n' +
      '  • Set `permissions: { id-token: write, contents: read }` for OIDC token issuance\n' +
      '  • Build and push the container image to ACR\n' +
      '  • Run `az aks get-credentials` then apply deployment files\n' +
      '  • Never hardcode Azure credentials, subscription IDs, or tokens in the workflow file\n' +
      'Use github_repo_info to confirm the default branch name before generating.\n' +
      'If OIDC is not yet configured, prompt the user to set up federated credentials (see OIDC setup protocol).',
    ],

    [Phase.Handoff]: [
      'Walk the user through getting their generated files into GitHub:\n' +
      '  1. Ask: new repo or push to existing? Use ChoicePicker.\n' +
      '  2. Show AuthCard for GitHub sign-in if needed.\n' +
      '  3. Verify OIDC federation is set up — ask the user to confirm that AZURE_CLIENT_ID, AZURE_TENANT_ID, and ' +
      'AZURE_SUBSCRIPTION_ID are configured as repository secrets. If not, walk the user through the setup.\n' +
      '  4. After push: "Your workflow will deploy automatically on every push to {branch}."\n' +
      '  5. Offer a Codespaces link so they can edit and iterate in the browser.',
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
      description:
        'OAuth Device Flow sign-in card with token confirmation.\n' +
        'Props:\n' +
        '  - username (optional string): GitHub username shown on the avatar and user info when signed in.\n' +
        '  - avatarUrl (optional string): URL of the user\'s GitHub avatar image.\n' +
        '  - onSignIn (optional action): Callback fired after successful GitHub OAuth sign-in.\n' +
        '  - onSignOut (optional action): Callback fired when the user signs out.',
    },
    {
      type: 'githubRepoPicker',
      description:
        'Repository picker with search and client-side filtering.\n' +
        'Props:\n' +
        '  - placeholder (optional string): Placeholder text for the search input. Defaults to "Search repositories…".\n' +
        '  - selectedRepo (optional string): Full name (owner/repo) of the pre-selected repository.\n' +
        '  - onSelect (optional action): Callback fired when the user selects a repository.',
    },
  ],

  auth: githubAuth,
};
