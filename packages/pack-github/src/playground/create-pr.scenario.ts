import type { PlaygroundScenario } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

/**
 * Playground scenario: create-pr
 * Renders the github/CreatePRFlow component with a stub file tree.
 */
export const createPRScenario: PlaygroundScenario = {
  id: 'github.create-pr',
  title: 'GitHub Create PR Flow',
  description: 'Shows the CreatePRFlow component with a stub list of generated deployment files.',
  group: 'github',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'github-create-pr', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'github-create-pr',
        components: [
          {
            type: 'github/CreatePRFlow',
            status: 'idle',
            owner: 'acme-corp',
            repo: 'aks-deploy',
            targetBranch: 'main',
            prTitle: 'feat: add AKS deployment manifests',
            files: [
              'k8s/deployment.yaml',
              'k8s/service.yaml',
              'k8s/ingress.yaml',
              '.github/workflows/deploy.yml',
            ],
            isActive: true,
          },
        ],
      },
    },
  ],
  requiresUserActionStubs: ['github:create_pr'],
};
