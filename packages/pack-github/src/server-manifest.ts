/**
 * Server-safe pack manifest for `githubPack` — no JSX imports.
 *
 * Mirrors `pack-core/src/server-manifest.ts`: tools, user actions,
 * guardrails, and playground scenarios are imported directly because they
 * are plain TypeScript with no React dependency. Component contributions
 * are listed by name with placeholder schemas so the server can expose
 * the catalog over `/api/packs` without pulling Fluent UI or React into
 * the Azure Functions bundle.
 *
 * TODO: Extract component schemas from the `.tsx` files into shared
 * non-JSX modules so the server can serve accurate JSON schemas.
 */

import { z } from 'zod';
import type { Pack, ComponentContribution } from '@aks-kickstart/harness';
import { resolveAssetURL } from '@aks-kickstart/harness/runtime/asset-url';

// Tools (no JSX)
import { apiGetTool } from './tools/api-get.js';

// User actions (no JSX)
import { loginUserAction } from './user-actions/login.js';
import { pickOrgUserAction } from './user-actions/pick-org.js';
import { pickRepoUserAction } from './user-actions/pick-repo.js';
import { createRepoUserAction } from './user-actions/create-repo.js';
import { createPRUserAction } from './user-actions/create-pr.js';
import { setSecretUserAction } from './user-actions/set-secret.js';

// Guardrails (no JSX)
import { noSecretExposureGuardrail } from './guardrails/no-secret-exposure.js';

// Playground scenarios (no JSX)
import { repoPickerScenario } from './playground/repo-picker.scenario.js';
import { createPRScenario } from './playground/create-pr.scenario.js';

// ---------------------------------------------------------------------------
// Component contributions (server-safe, no React renderer)
// ---------------------------------------------------------------------------

const GITHUB_COMPONENT_NAMES = [
  'Login',
  'OrgPicker',
  'RepoPicker',
  'RepoInfo',
  'Action',
  'CreatePRFlow',
  'SecretSetter',
];

const serverComponents: ComponentContribution[] = GITHUB_COMPONENT_NAMES.map((name) => ({
  name: `github/${name}`,
  propertySchema: z.unknown(),
  renderer: null,
}));

// ---------------------------------------------------------------------------
// Server-safe githubPack
// ---------------------------------------------------------------------------

export const githubPackServer: Pack = {
  name: 'github',
  version: '0.1.0',
  dependsOn: ['core'],

  // pack-github keeps agents/skills at the package root (not under src/),
  // matching the live manifest in ./index.ts.
  agentsDir: resolveAssetURL(import.meta.url, '../agents/', './pack-assets/github/agents/'),
  skillsDir: resolveAssetURL(import.meta.url, '../skills/', './pack-assets/github/skills/'),

  tools: [apiGetTool],

  userActions: [
    loginUserAction,
    pickOrgUserAction,
    pickRepoUserAction,
    createRepoUserAction,
    createPRUserAction,
    setSecretUserAction,
  ],

  components: serverComponents,

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
