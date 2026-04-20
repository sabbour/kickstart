/**
 * Server-safe pack manifest for `corePack` — no JSX imports.
 *
 * This file is intentionally separate from core-pack.ts so that server-side
 * code (Azure Functions) can import the pack without pulling in React or
 * Fluent UI dependencies.
 *
 * Component property schemas are provided for the 22 basic components sourced
 * from the a2ui catalog. The 5 Fluent-only overrides (Badge, Accordion, Toggle,
 * ComboBox, MultiSelect) and the 13 rich components use z.unknown() as a
 * placeholder schema.
 *
 * TODO: Extract rich component schemas to a shared non-JSX file so the server
 * can serve accurate JSON schemas for all 40 components.
 */
import { z } from 'zod';
import { resolveAssetURL } from '@kickstart/harness/runtime/asset-url';
import { BASIC_COMPONENTS } from './vendor/a2ui/web_core/basic_catalog/components/basic_components.js';
// Tools (no JSX)
import { emitUiTool } from './tools/emit_ui.js';
import { fetchWebpageTool } from './tools/fetch_webpage.js';
import { readFileTool } from './tools/read_file.js';
import { writeFileTool } from './tools/write_file.js';
import { listFilesTool } from './tools/list_files.js';
import { validateArtifactsTool } from './tools/validate_artifacts.js';
import { createSearchComponentsTool } from './tools/search_components.js';
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
];
const serverComponents = [
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
    // 13 rich components — schema placeholder (TODO: extract from tsx)
    ...RICH_COMPONENT_NAMES.map((name) => ({
        name: `core/${name}`,
        propertySchema: z.unknown(),
        renderer: null,
    })),
];
// ---------------------------------------------------------------------------
// Server-safe corePack
// ---------------------------------------------------------------------------
export const corePackServer = {
    name: 'core',
    version: '0.1.0',
    agentsDir: resolveAssetURL(import.meta.url, './agents/', './pack-assets/core/agents/'),
    skillsDir: resolveAssetURL(import.meta.url, './skills/', './pack-assets/core/skills/'),
    tools: [
        emitUiTool,
        fetchWebpageTool,
        readFileTool,
        writeFileTool,
        listFilesTool,
        validateArtifactsTool,
        createSearchComponentsTool({ components: serverComponents }),
    ],
    components: serverComponents,
    guardrails: [
        tokenBudgetGuardrail,
        noPiiInLogsGuardrail,
        noSecretsInArtifactsGuardrail,
    ],
};
//# sourceMappingURL=server-manifest.js.map