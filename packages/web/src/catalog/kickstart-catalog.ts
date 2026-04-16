import { Catalog } from '../vendor/a2ui/web_core/index';
import { basicCatalog } from '../vendor/a2ui/react/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { fluentOverrides } from './fluent-components';
import { RadioGroup } from './components/RadioGroup';
import { FormGroup } from './components/FormGroup';
import { CodeBlock } from './components/CodeBlock';
import { ProgressSteps } from './components/ProgressSteps';
import { Markdown } from './components/Markdown';
import { GitHubLoginCard } from './components/GitHubLoginCard';
import { GitHubRepoPicker } from './components/GitHubRepoPicker';
import { GitHubAction } from './components/GitHubAction';
import { GitHubCommit } from './components/GitHubCommit';
import { AuthCard } from './components/AuthCard';
import { AzureLoginCard } from './components/AzureLoginCard';
import { AzureResourcePicker } from './components/AzureResourcePicker';
import { AzureResourceForm } from './components/AzureResourceForm';
import { AzureAction } from './components/AzureAction';
import { ArchitectureDiagram } from './components/ArchitectureDiagram';
import { FileEditor } from './components/FileEditor';
import { CostEstimate } from './components/CostEstimate';
import { GenerationProgress } from './components/GenerationProgress';
import { SteppedCarousel } from './components/SteppedCarousel';
import { Questionnaire } from './components/Questionnaire';
import { SummaryCard } from './components/SummaryCard';
import { DecisionCard } from './components/DecisionCard';

const kickstartComponents: ReactComponentImplementation[] = [
  ...Array.from(basicCatalog.components.values()),
  ...fluentOverrides,
  RadioGroup,
  FormGroup,
  CodeBlock,
  ProgressSteps,
  Markdown,
  AuthCard,
  GitHubLoginCard,
  GitHubRepoPicker,
  GitHubAction,
  GitHubCommit,
  AzureLoginCard,
  AzureResourcePicker,
  AzureResourceForm,
  AzureAction,
  ArchitectureDiagram,
  FileEditor,
  CostEstimate,
  GenerationProgress,
  SteppedCarousel,
  Questionnaire,
  SummaryCard,
  DecisionCard,
];

export const kickstartCatalog = new Catalog<ReactComponentImplementation>(
  'kickstart',
  kickstartComponents,
  Array.from(basicCatalog.functions.values()),
);
