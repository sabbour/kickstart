import type { PlaygroundScenario } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

/**
 * Playground scenario: aks.safeguard-violations
 * Renders the aks/SafeguardViolations component with a mixed-severity report.
 */
export const safeguardViolationsScenario: PlaygroundScenario = {
  id: 'aks.safeguard-violations',
  title: 'AKS Safeguard Violations',
  description: 'Shows the SafeguardViolations component with a non-compliant manifest and three violations.',
  group: 'aks',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'aks-safeguard-violations', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'aks-safeguard-violations',
        components: [
          {
            type: 'aks/SafeguardViolations',
            manifestName: 'deployment.yaml',
            compliant: false,
            summary: '3 safeguard violations must be resolved before deployment.',
            violations: [
              {
                ruleId: 'aks.no_latest_tag',
                severity: 'high',
                description: 'Container image uses the ":latest" tag. Pin to a specific tag or digest.',
                line: 24,
              },
              {
                ruleId: 'aks.require_resource_limits',
                severity: 'medium',
                description: 'Container does not declare resources.limits.memory.',
                line: 31,
              },
              {
                ruleId: 'aks.no_privileged_containers',
                severity: 'high',
                description: 'Container sets securityContext.privileged=true. AKS Automatic forbids privileged containers.',
                line: 38,
              },
            ],
          },
        ],
      },
    },
  ],
};
