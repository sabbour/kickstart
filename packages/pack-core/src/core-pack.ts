import type { Pack, ComponentContribution } from '@kickstart/harness';
import type { ReactComponentImplementation } from './vendor/a2ui/react/adapter.js';

// Tools
import { emitUiTool } from './tools/emit_ui.js';
import { fetchWebpageTool } from './tools/fetch_webpage.js';
import { readFileTool } from './tools/read_file.js';
import { writeFileTool } from './tools/write_file.js';
import { listFilesTool } from './tools/list_files.js';
import { validateArtifactsTool } from './tools/validate_artifacts.js';

// Guardrails
import { tokenBudgetGuardrail } from './guardrails/token_budget.js';
import { noPiiInLogsGuardrail } from './guardrails/no_pii_in_logs.js';
import { noSecretsInArtifactsGuardrail } from './guardrails/no_secrets_in_artifacts.js';

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

export const corePack: Pack = {
  name: 'core',
  version: '0.1.0',

  // Agents and skills are loaded from directory by the harness registry
  agentsDir: new URL('./agents/', import.meta.url),
  skillsDir: new URL('./skills/', import.meta.url),

  tools: [
    emitUiTool,
    fetchWebpageTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    validateArtifactsTool,
  ],

  components: [
    ...fluentOverrides.map(toContrib),
    ...richComponents.map(toContrib),
  ],

  guardrails: [
    tokenBudgetGuardrail,
    noPiiInLogsGuardrail,
    noSecretsInArtifactsGuardrail,
  ],
};
