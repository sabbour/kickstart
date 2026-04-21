/**
 * Client subpath for `@aks-kickstart/pack-github` — browser-safe React
 * renderers and preview fixtures for the GitHub pack.
 *
 * See `pack-azure/client.ts` for the contract.
 */

import type { ComponentContribution } from '@aks-kickstart/harness';

export { LoginRenderer, loginContribution } from './components/Login/index.js';
export { OrgPickerRenderer, orgPickerContribution } from './components/OrgPicker/index.js';
export { RepoPickerRenderer, repoPickerContribution } from './components/RepoPicker/index.js';
export { RepoInfoRenderer, repoInfoContribution } from './components/RepoInfo/index.js';
export { ActionRenderer, actionContribution } from './components/Action/index.js';
export {
  CreatePRFlowRenderer,
  createPRFlowContribution,
} from './components/CreatePRFlow/index.js';
export {
  SecretSetterRenderer,
  secretSetterContribution,
} from './components/SecretSetter/index.js';

import { loginContribution } from './components/Login/index.js';
import { orgPickerContribution } from './components/OrgPicker/index.js';
import { repoPickerContribution } from './components/RepoPicker/index.js';
import { repoInfoContribution } from './components/RepoInfo/index.js';
import { actionContribution } from './components/Action/index.js';
import { createPRFlowContribution } from './components/CreatePRFlow/index.js';
import { secretSetterContribution } from './components/SecretSetter/index.js';

/** All GitHub pack components eligible for client-side registration. */
export const githubClientComponents: readonly ComponentContribution[] = Object.freeze([
  loginContribution,
  orgPickerContribution,
  repoPickerContribution,
  repoInfoContribution,
  actionContribution,
  createPRFlowContribution,
  secretSetterContribution,
]);

export interface PackClientRegisterTarget {
  register(contribution: ComponentContribution): void;
}

export function registerClient(target: PackClientRegisterTarget): void {
  for (const contribution of githubClientComponents) {
    target.register(contribution);
  }
}

export type PackPreview = Array<Record<string, unknown>>;

export const previews: Readonly<Record<string, PackPreview>> = Object.freeze({
  'github/Login': [
    {
      id: 'root',
      component: 'github/Login',
      status: 'success',
      viewerSummary: {
        login: 'octocat',
        name: 'The Octocat',
        avatarUrl: 'https://github.com/octocat.png',
      },
    },
  ],
  'github/OrgPicker': [
    {
      id: 'root',
      component: 'github/OrgPicker',
      status: 'loaded',
      owners: [
        { login: 'octocat', type: 'User', avatarUrl: 'https://github.com/octocat.png' },
        { login: 'github', type: 'Organization', avatarUrl: 'https://github.com/github.png' },
      ],
      selectedOwner: 'octocat',
    },
  ],
  'github/RepoPicker': [
    {
      id: 'root',
      component: 'github/RepoPicker',
      status: 'loaded',
      owner: 'octocat',
      mode: 'pick',
      repos: [
        { name: 'hello-world', description: 'My first repository', defaultBranch: 'main', htmlUrl: 'https://github.com/octocat/hello-world' },
        { name: 'kickstart-sample', description: 'Sample AKS kickstart app', private: true, defaultBranch: 'main', htmlUrl: 'https://github.com/octocat/kickstart-sample' },
      ],
      selectedRepo: 'kickstart-sample',
    },
  ],
  'github/RepoInfo': [
    {
      id: 'root',
      component: 'github/RepoInfo',
      repo: {
        name: 'kickstart-sample',
        fullName: 'octocat/kickstart-sample',
        description: 'Sample AKS kickstart app',
        language: 'TypeScript',
        defaultBranch: 'main',
        htmlUrl: 'https://github.com/octocat/kickstart-sample',
        private: false,
        stargazersCount: 42,
        forksCount: 7,
      },
    },
  ],
  'github/Action': [
    {
      id: 'root',
      component: 'github/Action',
      workflowRun: {
        status: 'completed',
        conclusion: 'success',
        url: 'https://github.com/octocat/kickstart-sample/actions/runs/12345',
        runNumber: 17,
        workflowName: 'Deploy to AKS',
      },
    },
  ],
  'github/CreatePRFlow': [
    {
      id: 'root',
      component: 'github/CreatePRFlow',
      status: 'done',
      owner: 'octocat',
      repo: 'kickstart-sample',
      targetBranch: 'main',
      files: ['infra/main.bicep', '.github/workflows/deploy.yml'],
      prTitle: 'feat: kickstart infra and deploy workflow',
      prUrl: 'https://github.com/octocat/kickstart-sample/pull/42',
      prNumber: 42,
    },
  ],
  'github/SecretSetter': [
    {
      id: 'root',
      component: 'github/SecretSetter',
      secretName: 'AZURE_CREDENTIALS',
      hint: 'Service principal JSON used by the deploy workflow.',
      status: 'saved',
    },
  ],
});
