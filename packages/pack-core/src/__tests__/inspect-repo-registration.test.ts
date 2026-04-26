import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { corePackServer } from '../server-manifest.js';

const RICH_COMPONENT_NAMES = [
  'ArchitectureDiagram',
  'AuthCard',
  'CodeBlock',
  'DecisionCard',
  'FileEditor',
  'FormGroup',
  'GenerationProgress',
  'Markdown',
  'ProgressSteps',
  'Questionnaire',
  'RadioGroup',
  'SteppedCarousel',
  'SummaryCard',
];

function createMockedComponent(name: string) {
  const component = {
    name,
    schema: z.object({}),
    render: () => null,
  };
  return {
    [component.name]: component,
  };
}

vi.mock('../components/basic/index.js', () => ({
  fluentOverrides: [],
}));
for (const name of RICH_COMPONENT_NAMES) {
  vi.doMock(`../components/rich/${name}.js`, () => createMockedComponent(name));
}
vi.mock('../playground/questionnaire.scenario.js', () => ({
  questionnaireScenario: { id: 'core/questionnaire', title: 'Questionnaire', components: [] },
}));
vi.mock('../playground/generation-progress.scenario.js', () => ({
  generationProgressScenario: { id: 'core/generation-progress', title: 'Generation progress', components: [] },
}));

describe('core.inspect_repo registration', () => {
  it('is available in the main core pack manifest', async () => {
    const { corePack } = await import('../core-pack.js');

    expect(corePack.tools?.some((tool) => tool.name === 'core.inspect_repo')).toBe(true);
  });

  it('is available in the server-safe core pack manifest used by API startup', () => {
    expect(corePackServer.tools?.some((tool) => tool.name === 'core.inspect_repo')).toBe(true);
  });
});
