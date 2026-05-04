/**
 * Client subpath for `@aks-kickstart/pack-core` — browser-safe React renderers
 * and component contributions for domain-neutral rich components.
 *
 * Consumed by `packages/web` during client bootstrap via `registerCoreClient(target)`.
 * Server-only code (agents, skills, tools) lives in `./server-manifest` and
 * is not re-exported from here.
 *
 * All 14 core components are sourced from `./components/rich/` as the single
 * source of truth. Web no longer maintains copies (eliminated drift bugs like
 * ArchitectureDiagram missing from web entirely).
 *
 * Marked side-effect-free (`sideEffects: false` in package.json) so unused
 * renderers tree-shake out of the initial chunk per route.
 */

import type { ComponentContribution } from '@aks-kickstart/harness';
import type { ReactComponentImplementation } from './vendor/a2ui/react/adapter.js';

// Import components from pack-core/rich as ReactComponentImplementation
// (compatible with ComponentContribution interface: name, schema, render)
export { AuthCard } from './components/rich/AuthCard.js';
export { CodeBlock } from './components/rich/CodeBlock.js';
export { DecisionCard } from './components/rich/DecisionCard.js';
export { FileEditor } from './components/rich/FileEditor.js';
export { FormGroup } from './components/rich/FormGroup.js';
export { GenerationProgress } from './components/rich/GenerationProgress.js';
export { Markdown } from './components/rich/Markdown.js';
export { ProgressSteps } from './components/rich/ProgressSteps.js';
export { Questionnaire } from './components/rich/Questionnaire.js';
export { RadioGroup } from './components/rich/RadioGroup.js';
export { SteppedCarousel } from './components/rich/SteppedCarousel.js';
export { SummaryCard } from './components/rich/SummaryCard.js';
export { TrackPicker } from './components/rich/TrackPicker.js';
export { ArchitectureDiagram } from './components/rich/ArchitectureDiagram.js';

// Import all components for the registry array
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
import { TrackPicker } from './components/rich/TrackPicker.js';
import { ArchitectureDiagram } from './components/rich/ArchitectureDiagram.js';

/**
 * All core components eligible for client-side registration.
 * Single source of truth for the complete list — used by web bootstrap,
 * server manifest, and component inventory tools.
 * 
 * Note: These are ReactComponentImplementation objects (from createReactComponent)
 * which are structurally compatible with ComponentContribution but have different
 * field naming (schema vs propertySchema, render vs renderer). The adaptPackComponent
 * adapter in web bootstrap handles the conversion.
 */
export const coreClientComponents: readonly ReactComponentImplementation[] = Object.freeze([
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
  TrackPicker,
  ArchitectureDiagram,
]);

/** Minimal registration target — any object that accepts a `ReactComponentImplementation`. */
export interface PackClientRegisterTarget {
  register(impl: ReactComponentImplementation): void;
}

/**
 * Register every core component with the host registry.
 * Called once at client bootstrap in `packages/web/src/bootstrap/registerPackComponents.ts`.
 * Explicit invocation (no import-time side effects) matches the registration
 * contract for pack-contributed renderers.
 */
export function registerClient(target: PackClientRegisterTarget): void {
  for (const contribution of coreClientComponents) {
    target.register(contribution);
  }
}

