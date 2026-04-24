import { describe, expect, it } from 'vitest';
import { ClientComponentRegistry } from '../contexts/A2UIRegistryContext';
import {
  DecisionCard as WebDecisionCard,
  Questionnaire as WebQuestionnaire,
  RadioGroup as WebRadioGroup,
} from '../catalog/components';
import { DecisionCard as CoreDecisionCard } from '../../../pack-core/src/components/rich/DecisionCard';
import { RadioGroup as CoreRadioGroup } from '../../../pack-core/src/components/rich/RadioGroup';
import { Questionnaire as CoreQuestionnaire } from '../../../pack-core/src/components/rich/Questionnaire';

function buildRegistry(): ClientComponentRegistry {
  const registry = new ClientComponentRegistry();
  registry.register(WebDecisionCard);
  registry.register(WebRadioGroup);
  registry.register(WebQuestionnaire);
  registry.seal();
  return registry;
}

describe('Phase A rich component parity', () => {
  it('registers DecisionCard, RadioGroup, and Questionnaire in the client catalog', () => {
    const registry = buildRegistry();

    expect(registry.getNames()).toEqual(expect.arrayContaining([
      'DecisionCard',
      'RadioGroup',
      'Questionnaire',
    ]));
  });

  it.each([
    {
      name: 'DecisionCard',
      client: WebDecisionCard,
      server: CoreDecisionCard,
      validProps: {
        title: 'What would you like to build on AKS?',
        recommendation: 'Use AKS Automatic to keep operations light.',
        alternatives: ['Static site', 'Containerized web app', 'Agentic AI app', 'Existing repo uplift'],
        badge: 'recommended',
      },
      invalidProps: {
        title: 'What would you like to build on AKS?',
        recommendation: 'Use AKS Automatic to keep operations light.',
        injected: true,
      },
    },
    {
      name: 'RadioGroup',
      client: WebRadioGroup,
      server: CoreRadioGroup,
      validProps: {
        options: [
          { id: 'foundry', label: 'Azure AI Foundry', description: 'Managed agent tooling' },
          { id: 'kaito', label: 'KAITO-hosted OSS model', description: 'More model control' },
        ],
        action: { event: { name: 'select_inference' } },
      },
      invalidProps: {
        options: [{ id: 'foundry', label: 'Azure AI Foundry' }],
        action: { event: { name: 'select_inference' } },
        injected: true,
      },
    },
    {
      name: 'Questionnaire',
      client: WebQuestionnaire,
      server: CoreQuestionnaire,
      validProps: {
        questions: [
          { id: 'model-family', label: 'Model family', type: 'choice', choices: [{ id: 'llama', label: 'Llama' }] },
          { id: 'gpu-budget', label: 'GPU budget', required: true },
        ],
        submitLabel: 'Continue',
        onSubmit: { event: { name: 'submit_requirements' } },
      },
      invalidProps: {
        questions: [{ id: 'model-family', label: 'Model family' }],
        submitLabel: 'Continue',
        extraField: 'nope',
      },
    },
  ])('$name stays aligned between pack-core and web', ({ client, server, validProps, invalidProps }) => {
    expect(client.name).toBe(server.name);
    expect(client.schema.safeParse(validProps).success).toBe(true);
    expect(server.schema.safeParse(validProps).success).toBe(true);
    expect(client.schema.safeParse(invalidProps).success).toBe(false);
    expect(server.schema.safeParse(invalidProps).success).toBe(false);
  });
});
