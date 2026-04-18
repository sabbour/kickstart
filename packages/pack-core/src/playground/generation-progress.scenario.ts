import type { PlaygroundScenario } from '@kickstart/harness';
import { A2UI_VERSION } from '@kickstart/harness';

/**
 * Playground scenario: core.generation-progress
 * Renders the core/GenerationProgress component mid-run with mixed step statuses.
 */
export const generationProgressScenario: PlaygroundScenario = {
  id: 'core.generation-progress',
  title: 'Core Generation Progress',
  description: 'Shows the GenerationProgress rich component in running state with complete, running, and pending steps.',
  group: 'core',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'core-generation-progress', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'core-generation-progress',
        components: [
          {
            type: 'core/GenerationProgress',
            title: 'Generating deployment artifacts',
            overallStatus: 'running',
            statusMessage: 'Writing manifests…',
            lastUpdated: '2026-04-18T09:12:05Z',
            steps: [
              {
                id: 'design',
                label: 'Design architecture',
                status: 'complete',
                detail: 'AKS Automatic + managed ACR + Key Vault',
                timestamp: '2026-04-18T09:11:10Z',
              },
              {
                id: 'bicep',
                label: 'Write Bicep templates',
                status: 'complete',
                detail: '3 files generated',
                timestamp: '2026-04-18T09:11:42Z',
              },
              {
                id: 'manifests',
                label: 'Write Kubernetes manifests',
                status: 'running',
                detail: 'Deployment, Service, HTTPRoute',
              },
              {
                id: 'workflow',
                label: 'Write GitHub Actions workflow',
                status: 'pending',
              },
              {
                id: 'review',
                label: 'Run validators',
                status: 'pending',
              },
            ],
          },
        ],
      },
    },
  ],
};
