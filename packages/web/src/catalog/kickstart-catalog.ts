import { Catalog } from '../vendor/a2ui/web_core/index';
import { basicCatalog } from '../vendor/a2ui/react/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { RadioGroup } from './components/RadioGroup';
import { FormGroup } from './components/FormGroup';
import { CodeBlock } from './components/CodeBlock';
import { ProgressSteps } from './components/ProgressSteps';

const kickstartComponents: ReactComponentImplementation[] = [
  ...Array.from(basicCatalog.components.values()),
  RadioGroup,
  FormGroup,
  CodeBlock,
  ProgressSteps,
];

export const kickstartCatalog = new Catalog<ReactComponentImplementation>(
  'kickstart',
  kickstartComponents,
  Array.from(basicCatalog.functions.values()),
);
