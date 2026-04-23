import type { PlaygroundScenario } from '@aks-kickstart/harness';
import { A2UI_VERSION } from '@aks-kickstart/harness';

/**
 * Playground scenario: core.questionnaire
 * Renders the core/Questionnaire component with a short multi-type question set.
 */
export const questionnaireScenario: PlaygroundScenario = {
  id: 'core.questionnaire',
  title: 'Core Questionnaire',
  description: 'Shows the Questionnaire rich component with text, choice, and multiChoice questions.',
  group: 'core',
  a2ui: [
    {
      version: A2UI_VERSION,
      createSurface: { surfaceId: 'core-questionnaire', catalogId: 'kickstart' },
    },
    {
      version: A2UI_VERSION,
      updateComponents: {
        surfaceId: 'core-questionnaire',
        components: [
          {
            type: 'core/Questionnaire',
            questions: [
              {
                id: 'app-name',
                label: 'What is the name of your application?',
                type: 'text',
                required: true,
              },
              {
                id: 'runtime',
                label: 'Which runtime does your app use?',
                type: 'choice',
                choices: [
                  { id: 'node', label: 'Node.js' },
                  { id: 'python', label: 'Python' },
                  { id: 'dotnet', label: '.NET' },
                  { id: 'java', label: 'Java' },
                ],
                required: true,
              },
              {
                id: 'concerns',
                label: 'Which non-functional concerns matter most?',
                type: 'multiChoice',
                choices: [
                  { id: 'cost', label: 'Cost' },
                  { id: 'latency', label: 'Latency' },
                  { id: 'availability', label: 'Availability' },
                  { id: 'compliance', label: 'Compliance' },
                ],
              },
            ],
            submitLabel: 'Continue',
          },
        ],
      },
    },
  ],
};
