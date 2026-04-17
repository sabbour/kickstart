import type { Pack, ComponentContribution } from '@kickstart/harness';

// Tool
import { apiGetTool } from './tools/api-get.js';

// User actions
import { loginUserAction } from './user-actions/login.js';
import { pickOrgUserAction } from './user-actions/pick-org.js';
import { pickRepoUserAction } from './user-actions/pick-repo.js';
import { createRepoUserAction } from './user-actions/create-repo.js';
import { createPRUserAction } from './user-actions/create-pr.js';
import { setSecretUserAction } from './user-actions/set-secret.js';

// Components
import { loginContribution } from './components/Login/index.js';
import { orgPickerContribution } from './components/OrgPicker/index.js';
import { repoPickerContribution } from './components/RepoPicker/index.js';
import { repoInfoContribution } from './components/RepoInfo/index.js';
import { actionContribution } from './components/Action/index.js';
import { createPRFlowContribution } from './components/CreatePRFlow/index.js';
import { secretSetterContribution } from './components/SecretSetter/index.js';

// Guardrail
import { noSecretExposureGuardrail } from './guardrails/no-secret-exposure.js';

// Playground scenarios
import { repoPickerScenario } from './playground/repo-picker.scenario.js';
import { createPRScenario } from './playground/create-pr.scenario.js';

const githubComponents: ComponentContribution[] = [
  loginContribution,
  orgPickerContribution,
  repoPickerContribution,
  repoInfoContribution,
  actionContribution,
  createPRFlowContribution,
  secretSetterContribution,
];

export const githubPack: Pack = {
  name: 'github',
  version: '0.1.0',
  dependsOn: ['core'],

  // Agents and skills are loaded from directory by the harness registry
  agentsDir: new URL('../agents/', import.meta.url),
  skillsDir: new URL('../skills/', import.meta.url),

  tools: [apiGetTool],

  userActions: [
    loginUserAction,
    pickOrgUserAction,
    pickRepoUserAction,
    createRepoUserAction,
    createPRUserAction,
    setSecretUserAction,
  ],

  components: githubComponents,

  guardrails: [noSecretExposureGuardrail],

  playgroundScenarios: [repoPickerScenario, createPRScenario],

  playgroundStubs: {
    'github:login': async () => ({
      authenticated: true,
      viewer: { login: 'octocat', name: 'The Octocat', avatarUrl: 'https://github.com/octocat.png' },
    }),
    'github:pick_org': async () => ({ owner: 'acme-corp', type: 'Organization' }),
    'github:pick_repo': async () => ({
      owner: 'acme-corp',
      name: 'aks-deploy',
      defaultBranch: 'main',
      htmlUrl: 'https://github.com/acme-corp/aks-deploy',
    }),
    'github:create_repo': async () => ({
      owner: 'acme-corp',
      name: 'aks-deploy',
      private: true,
      htmlUrl: 'https://github.com/acme-corp/aks-deploy',
    }),
    'github:create_pr': async () => ({
      prNumber: 42,
      prUrl: 'https://github.com/acme-corp/aks-deploy/pull/42',
      branch: 'feat/aks-deploy',
    }),
    'github:set_secret': async () => ({ secretName: 'AZURE_CLIENT_ID', set: true }),
  },
};
