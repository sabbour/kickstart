import type { Pack, ComponentContribution } from '@aks-kickstart/harness';
import type { ReactComponentImplementation } from './vendor/a2ui/react/adapter.js';
import { createCoreTools } from './core-tools.js';

// Guardrails
import { tokenBudgetGuardrail } from './guardrails/token_budget.js';
import { noPiiInLogsGuardrail } from './guardrails/no_pii_in_logs.js';
import { noSecretsInArtifactsGuardrail } from './guardrails/no_secrets_in_artifacts.js';
import { noCredentialLeakGuardrail } from './guardrails/no-credential-leak.js';

// Basic components (27 Fluent renderers)
import { fluentOverrides } from './components/basic/index.js';

// Rich components (13 domain-neutral)
import { ArchitectureDiagram } from './components/rich/ArchitectureDiagram.js';
import { AuthCard } from './components/rich/AuthCard.js';
import { CodeBlock } from './components/rich/CodeBlock.js';
import { DecisionCard } from './components/rich/DecisionCard.js';
import { FileEditor } from './components/rich/FileEditor.js';
import { FormGroup } from './components/rich/FormGroup.js';
import { GenerationProgress } from './components/rich/GenerationProgress.js';
import { Markdown } from './components/rich/Markdown.js';
import { ProgressSteps } from './components/rich/ProgressSteps.js';
import { Questionnaire } from './components/rich/Questionnaire.js';
import { RadioGroup } from './components/rich/RadioGroup.js';
import { SteppedCarousel } from './components/rich/SteppedCarousel.js';
import { SummaryCard } from './components/rich/SummaryCard.js';

// Playground scenarios
import { questionnaireScenario } from './playground/questionnaire.scenario.js';
import { generationProgressScenario } from './playground/generation-progress.scenario.js';

function toContrib(impl: ReactComponentImplementation): ComponentContribution {
  return {
    name: `core/${impl.name}`,
    propertySchema: impl.schema,
    renderer: impl.render,
  };
}

const richComponents: ReactComponentImplementation[] = [
  ArchitectureDiagram,
  AuthCard,
  CodeBlock,
  DecisionCard,
  FileEditor,
  FormGroup,
  GenerationProgress,
  Markdown,
  ProgressSteps,
  Questionnaire,
  RadioGroup,
  SteppedCarousel,
  SummaryCard,
];

const coreComponents: ComponentContribution[] = [
  ...fluentOverrides.map(toContrib),
  ...richComponents.map(toContrib),
];

export const corePack: Pack = {
  name: 'core',
  version: '0.1.0',

  // Agents and skills are loaded from directory by the harness registry
  agentsDir: new URL('./agents/', import.meta.url),
  skillsDir: new URL('./skills/', import.meta.url),

  tools: createCoreTools(coreComponents),

  components: coreComponents,

  guardrails: [
    tokenBudgetGuardrail,
    noPiiInLogsGuardrail,
    noSecretsInArtifactsGuardrail,
    noCredentialLeakGuardrail,
  ],

  playgroundScenarios: [questionnaireScenario, generationProgressScenario],
};
