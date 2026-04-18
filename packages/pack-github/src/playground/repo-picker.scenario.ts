import type { PlaygroundScenario } from '@kickstart/harness';
import { A2UI_VERSION } from '@kickstart/harness';

/**
 * Playground scenario: repo-picker
 * Renders the github/RepoPicker component with a stub owner list.
 */
export const repoPickerScenario: PlaygroundScenario = {
  id: 'github.repo-picker',
  title: 'GitHub Repo Picker',
  description: 'Shows the RepoPicker component in pick mode with stub repositories.',
  group: 'github',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'github-repo-picker', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'github-repo-picker',
        components: [
          {
            type: 'github/RepoPicker',
            status: 'loaded',
            owner: 'acme-corp',
            mode: 'pick',
            repos: [
              { name: 'aks-deploy', description: 'AKS deployment manifests', private: true, defaultBranch: 'main' },
              { name: 'web-app', description: 'Frontend web application', private: false, defaultBranch: 'main' },
              { name: 'api-service', description: 'Backend API', private: true, defaultBranch: 'main' },
            ],
            selectedRepo: 'aks-deploy',
            isActive: true,
          },
        ],
      },
    },
  ],
  requiresUserActionStubs: ['github:pick_repo'],
};
