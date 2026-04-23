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

/**
 * Curated scenario composition (Playground Ideas tab — #987).
 * See `pack-azure/client.ts` for the contract.
 */
export interface PackScenario {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly components: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

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

/**
 * Curated scenarios for the Playground Ideas tab (#987).
 *
 * Each entry composes GitHub pack components with core primitives into a
 * realistic end-to-end workflow.
 */
export const scenarios: readonly PackScenario[] = Object.freeze([
  {
    id: 'create-repo',
    title: 'Create a new GitHub repository',
    description: 'Owner picker + repo name + visibility + submit.',
    components: [
      { id: 'root', component: 'Card', children: ['col'] },
      { id: 'col', component: 'Column', children: ['heading', 'orgs', 'name', 'private', 'submit'] },
      { id: 'heading', component: 'Text', text: 'Create a GitHub repository' },
      {
        id: 'orgs',
        component: 'github/OrgPicker',
        status: 'loaded',
        owners: [
          { login: 'octocat', type: 'User', avatarUrl: 'https://github.com/octocat.png' },
          { login: 'github', type: 'Organization', avatarUrl: 'https://github.com/github.png' },
        ],
        selectedOwner: 'octocat',
      },
      { id: 'name', component: 'TextField', label: 'Repository name' },
      { id: 'private', component: 'CheckBox', label: 'Private repository', value: false },
      { id: 'submit', component: 'Button', child: 'submit-label' },
      { id: 'submit-label', component: 'Text', text: 'Create repository' },
    ],
  },
  {
    id: 'authorize-and-pick-repo',
    title: 'Sign in and pick a repository',
    description: 'Authorize with GitHub then browse repositories.',
    components: [
      { id: 'root', component: 'Column', children: ['login', 'repos'] },
      {
        id: 'login',
        component: 'github/Login',
        status: 'success',
        viewerSummary: {
          login: 'octocat',
          name: 'The Octocat',
          avatarUrl: 'https://github.com/octocat.png',
        },
      },
      {
        id: 'repos',
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
  },
  {
    id: 'configure-deploy',
    title: 'Configure a deploy workflow',
    description: 'Wire a repository secret and inspect the resulting Action run.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'secret', 'action'] },
      { id: 'heading', component: 'Text', text: 'Configure deploy workflow' },
      {
        id: 'secret',
        component: 'github/SecretSetter',
        secretName: 'AZURE_CREDENTIALS',
        hint: 'Service principal JSON used by the deploy workflow.',
        status: 'saved',
      },
      {
        id: 'action',
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
  },
]);
