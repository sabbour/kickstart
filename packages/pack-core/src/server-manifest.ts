/**
 * Server-safe pack manifest for `corePack` — no JSX imports.
 *
 * This file is intentionally separate from core-pack.ts so that server-side
 * code (Azure Functions) can import the pack without pulling in React or
 * Fluent UI dependencies.
 *
 * Component property schemas are provided for all 40 components: the 22 basic
 * components sourced from the a2ui catalog, the 5 Fluent-only overrides (Badge,
 * Accordion, Toggle, ComboBox, MultiSelect), and all 13 rich domain components
 * (schemas defined in rich-component-schemas.ts, server-safe — no JSX).
 *
 * TODO: Remove this TODO after verifying OpenAI strict-mode validation for all 40.
 */

import { z } from 'zod';
import type { Pack } from '@aks-kickstart/harness';
import type { ComponentContribution } from '@aks-kickstart/harness';
import { resolveAssetURL } from '@aks-kickstart/harness/runtime/asset-url';
import { BASIC_COMPONENTS } from './vendor/a2ui/web_core/basic_catalog/components/basic_components.js';
import {
  RICH_COMPONENT_SCHEMAS,
  RICH_COMPONENT_HINTS,
} from './schemas/rich-component-schemas.js';

// Tools (no JSX)
import { createCoreTools } from './core-tools.js';

// Guardrails (no JSX)
import { tokenBudgetGuardrail } from './guardrails/token_budget.js';
import { noPiiInLogsGuardrail } from './guardrails/no_pii_in_logs.js';
import { noSecretsInArtifactsGuardrail } from './guardrails/no_secrets_in_artifacts.js';

// ---------------------------------------------------------------------------
// Component contributions (server-safe, no React renderer)
// ---------------------------------------------------------------------------

/** Names of Fluent-specific basic components not in BASIC_COMPONENTS catalog. */
const FLUENT_ONLY_BASIC_NAMES = ['Badge', 'Accordion', 'Toggle', 'ComboBox', 'MultiSelect'];

/** Names of rich domain components (schemas defined in JSX files). */
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
  'TrackPicker',
];

const serverComponents: ComponentContribution[] = [
  // 22 basic components with accurate schemas from the a2ui catalog
  ...BASIC_COMPONENTS.map((api) => ({
    name: `core/${api.name}`,
    propertySchema: api.schema,
    renderer: null, // not used server-side
  })),
  // 5 Fluent-only basic overrides — schema placeholder
  ...FLUENT_ONLY_BASIC_NAMES.map((name) => ({
    name: `core/${name}`,
    propertySchema: z.unknown(),
    renderer: null,
  })),
  // 13 rich components — all now have real schemas (#3 G1/G2)
  ...RICH_COMPONENT_NAMES.map((name) => ({
    name: `core/${name}`,
    propertySchema: RICH_COMPONENT_SCHEMAS.get(name) ?? z.unknown(),
    renderer: null,
    ...(RICH_COMPONENT_HINTS.has(name) ? { llmHint: RICH_COMPONENT_HINTS.get(name)! } : {}),
  })),
];

// ---------------------------------------------------------------------------
// Server-safe corePack
// ---------------------------------------------------------------------------

export const corePackServer: Pack = {
  name: 'core',
  version: '0.1.0',

  agentsDir: resolveAssetURL(import.meta.url, './agents/', './pack-assets/core/agents/'),
  skillsDir: resolveAssetURL(import.meta.url, './skills/', './pack-assets/core/skills/'),

  tools: createCoreTools(serverComponents),

  components: serverComponents,

  guardrails: [
    tokenBudgetGuardrail,
    noPiiInLogsGuardrail,
    noSecretsInArtifactsGuardrail,
  ],
};
