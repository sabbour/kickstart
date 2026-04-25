/**
 * Server-safe Zod schemas for rich components (no JSX imports).
 *
 * These mirror the prop interfaces in packages/web/src/catalog/components/*.tsx
 * so the emit_ui tool can validate LLM output against real component shapes.
 *
 * #1130 Phase A — DecisionCard, RadioGroup, Questionnaire
 * #1130 Phase B — SummaryCard, ArchitectureDiagram
 * #3 G1/G2 — ProgressSteps, CodeBlock, Markdown, GenerationProgress, AuthCard, FormGroup, FileEditor, SteppedCarousel
 */

import { z } from 'zod';

// Dynamic string: literal string or data-binding reference.
// Subset of the full DynamicStringSchema used by the client catalog.
const DynStr = z.union([
  z.string(),
  z.object({ path: z.string() }),
]);

// Action schema matching the emit_ui action envelope.
// Re-declared here (subset) so this file stays self-contained and server-safe.
const ActionSchema = z.object({
  event: z.object({
    name: z.string(),
    payload: z
      .object({
        confirmed: z.boolean().nullable(),
        id: z.string().nullable(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]).nullable(),
        action: z.string().nullable(),
        target: z.string().nullable(),
      })
      .nullable(),
  }),
});

// ── DecisionCard ────────────────────────────────────────────────────────────
export const DecisionCardSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('DecisionCard'),
  title: DynStr.describe('Decision title — what is being decided.'),
  recommendation: DynStr.describe('The recommended option or course of action.'),
  rationale: DynStr.nullable().describe('Explanation for why this is recommended, or null.'),
  alternatives: z.array(DynStr).nullable().describe('Alternative options considered, or null.'),
  badge: z
    .enum(['recommended', 'best-practice', 'required', 'optional'])
    .nullable()
    .describe('Visual badge shown on the card, or null.'),
}).strict();

// ── RadioGroup ──────────────────────────────────────────────────────────────
export const RadioGroupSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('RadioGroup'),
  options: z.array(
    z.object({
      id: z.string().describe('Unique option identifier.'),
      label: DynStr.describe('Display label for this option.'),
      description: DynStr.nullable().describe('Sub-text shown below the label, or null.'),
      recommended: z.boolean().nullable().describe('Whether to show a Recommended badge, or null.'),
    }),
  ).min(1).describe('Array of radio options — at least one required.'),
  value: DynStr.nullable().describe('Pre-selected option ID, or null for no default.'),
  action: ActionSchema.describe('Action dispatched when the user selects an option.'),
}).strict();

// ── Questionnaire ───────────────────────────────────────────────────────────
export const QuestionnaireSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('Questionnaire'),
  questions: z.array(
    z.object({
      id: z.string().describe('Unique question identifier.'),
      label: DynStr.describe('Question text displayed to the user.'),
      type: z
        .enum(['text', 'choice', 'multiChoice'])
        .nullable()
        .describe('Input type — defaults to text if null.'),
      choices: z.array(
        z.object({
          id: z.string().describe('Choice identifier.'),
          label: DynStr.describe('Choice label text.'),
        }),
      ).nullable().describe('Available choices for choice/multiChoice types, or null.'),
      required: z.boolean().nullable().describe('Whether the question must be answered, or null.'),
    }),
  ).min(1).describe('Array of questions — at least one required.'),
  submitLabel: DynStr.nullable().describe('Custom submit button label, or null for default.'),
  onSubmit: ActionSchema.nullable().describe('Action dispatched when the user submits, or null.'),
}).strict();

// ── SummaryCard (#1113 Phase B) ─────────────────────────────────────────────
export const SummaryCardSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('SummaryCard'),
  title: DynStr.nullable().describe('Card title, or null.'),
  items: z.array(
    z.object({
      label: DynStr.describe('Summary item label (left column).'),
      value: DynStr.describe('Summary item value (right column).'),
      badge: z
        .enum(['neutral', 'success', 'warning', 'danger', 'info'])
        .nullable()
        .describe('Visual badge for this item, or null.'),
      link: z.union([
        z.string()
          .refine(
            (val) => {
              try { return new URL(val).protocol === 'https:'; } catch { return false; }
            },
            { message: 'Only HTTPS URLs allowed' },
          )
          .describe('HTTPS URL for external link.'),
        z.object({ path: z.string() }),
      ])
        .nullable()
        .describe('HTTPS URL or data-binding reference for external link, or null.'),
    }),
  ).describe('Array of key-value summary items displayed in a grid.'),
  children: z.array(z.string()).nullable().describe(
    'Ordered array of child component IDs rendered below the items grid ' +
      '(e.g. an ArchitectureDiagram or action buttons), or null.',
  ),
}).strict();

// ── ArchitectureDiagram (#1113 Phase B) ─────────────────────────────────────
export const ArchitectureDiagramSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('ArchitectureDiagram'),
  diagram: DynStr.nullable().describe(
    'Raw Mermaid graph definition string. Preferred input format. Null when using nodes/edges.',
  ),
  nodes: z.array(
    z.object({
      id: z.string().describe('Unique node identifier used in edges.'),
      label: z.string().describe('Display label for the node.'),
      type: z.string().nullable().describe('Node type hint (e.g. "aks", "storage"), or null.'),
    }),
  ).nullable().describe('Structured node list — alternative to diagram string, or null.'),
  edges: z.array(
    z.object({
      from: z.string().describe('Source node ID.'),
      to: z.string().describe('Target node ID.'),
      label: z.string().nullable().describe('Edge label text, or null.'),
    }),
  ).nullable().describe('Structured edge list — used with nodes, or null.'),
  title: DynStr.nullable().describe('Diagram title shown in the header, or null.'),
  description: DynStr.nullable().describe('Subtitle shown below the title, or null.'),
}).strict();

// ── CreatePRFlow (#1113 Phase D) ────────────────────────────────────────────
export const CreatePRFlowSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('github/CreatePRFlow'),
  status: z
    .enum(['idle', 'pushing', 'creating_pr', 'done', 'error'])
    .describe('Current step of the PR-creation flow.'),
  owner: DynStr.nullable().describe('Repository owner (org or user login), or null.'),
  repo: DynStr.nullable().describe('Repository name, or null.'),
  targetBranch: DynStr.nullable().describe('Branch to merge into (e.g. main), or null.'),
  files: z.array(z.string()).nullable().describe(
    'List of file paths being committed in this PR, or null.',
  ),
  prTitle: DynStr.nullable().describe('Pull request title, or null.'),
  prUrl: DynStr.nullable().describe('URL of the created pull request, or null.'),
  prNumber: z.number().int().nullable().describe('PR number, or null.'),
  errorMessage: DynStr.nullable().describe('Error message if status is error, or null.'),
  isActive: z.boolean().nullable().describe(
    'Whether the component is interactive. False makes it read-only/dimmed.',
  ),
}).strict();

// ── TrackPicker (#22) ───────────────────────────────────────────────────────
export const TrackPickerSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('TrackPicker'),
  title: DynStr.describe('Heading displayed above the track tiles.'),
  tracks: z.array(
    z.object({
      id: z.string().describe('Track identifier sent in pick_track event (e.g. "static_site").'),
      label: DynStr.describe('Display label for this track.'),
      description: DynStr.describe('One-line summary of the track.'),
      icon: z.string().nullable().describe('Optional icon reference, or null to omit.'),
    }).strict(),
  ).min(1).describe('Array of equal-weight track options — at least one required.'),
}).strict();

// ── ProgressSteps ───────────────────────────────────────────────────────────
export const ProgressStepsSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('ProgressSteps'),
  steps: z.array(z.object({
    id: z.string().describe('Step identifier.'),
    label: DynStr.describe('Step label text.'),
    status: z.enum(['pending', 'active', 'complete', 'error']).describe('Current step state.'),
  })).describe('Array of steps — each with id, label, and status.'),
}).strict();

// ── CodeBlock ───────────────────────────────────────────────────────────────
export const CodeBlockSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('CodeBlock'),
  code: DynStr.describe('The source code content to display.'),
  language: DynStr.nullable().describe('Language identifier for syntax highlighting (e.g. "typescript", "yaml", "python"), or null.'),
  filename: DynStr.nullable().describe('Filename shown in the header bar, or null to omit.'),
}).strict();

// ── Markdown ────────────────────────────────────────────────────────────────
export const MarkdownSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('Markdown'),
  content: DynStr.describe('Markdown string to render. Supports GFM (tables, task lists, strikethrough).'),
}).strict();

// ── GenerationProgress ──────────────────────────────────────────────────────
export const GenerationProgressSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('GenerationProgress'),
  steps: z.array(z.object({
    id: z.string().describe('Step identifier.'),
    label: DynStr.describe('Step label text.'),
    status: z.enum(['pending', 'running', 'complete', 'error', 'skipped']).describe('Step state.'),
    detail: DynStr.nullable().describe('Optional secondary detail text shown beneath the label, or null.'),
    timestamp: DynStr.nullable().describe('Optional timestamp string, or null.'),
  }).strict()).describe('Array of generation steps.'),
  title: DynStr.nullable().describe('Optional heading above the step list, or null.'),
  overallStatus: z.enum(['idle', 'running', 'complete', 'error']).nullable().describe('Overall operation status, or null.'),
  statusMessage: DynStr.nullable().describe('Optional status message shown below the step list, or null.'),
  appUrl: DynStr.nullable().describe('Deployed application URL shown on completion, or null.'),
  portalUrl: DynStr.nullable().describe('Azure Portal URL shown on completion, or null.'),
  errorMessage: DynStr.nullable().describe('Error message shown when overallStatus is "error", or null.'),
}).strict();

// ── AuthCard ─────────────────────────────────────────────────────────────────
export const AuthCardSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('AuthCard'),
  provider: z.enum(['azure', 'github']).describe('Authentication provider — "azure" or "github".'),
  title: DynStr.nullable().describe('Optional card title override, or null for default.'),
  description: DynStr.nullable().describe('Optional description text shown below the title, or null.'),
}).strict();

// ── FormGroup ────────────────────────────────────────────────────────────────
export const FormGroupSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('FormGroup'),
  title: DynStr.describe('Form group section title.'),
  step: z.number().nullable().describe('Optional step number shown as a badge, or null to omit.'),
  child: z.string().describe('ID of the child component rendered inside this form group.'),
}).strict();

// ── FileEditor ───────────────────────────────────────────────────────────────
const FileEntrySchema = z.object({
  filename: DynStr.nullable().describe('Display name for this file tab, or null.'),
  path: DynStr.nullable().describe('File path (used as tab label if filename is null), or null.'),
  content: DynStr.nullable().describe('Inline file content string, or null when using artifactPath.'),
  language: DynStr.nullable().describe('Language identifier for syntax highlighting, or null for auto-detect.'),
  artifactPath: DynStr.nullable().describe('Path into ArtifactContext to load content from, or null for inline content.'),
}).strict();

export const FileEditorSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('FileEditor'),
  filename: DynStr.nullable().describe('Display name for a single file, or null when using files array.'),
  path: DynStr.nullable().describe('File path for a single file, or null.'),
  content: DynStr.nullable().describe('Inline content for a single file, or null when using artifactPath or files.'),
  language: DynStr.nullable().describe('Language identifier for a single file, or null for auto-detect.'),
  readOnly: z.boolean().nullable().describe('If true, show read-only syntax-highlighted view instead of Monaco editor. Null for default (editable).'),
  artifactPath: DynStr.nullable().describe('Path into ArtifactContext to load content from, or null for inline content.'),
  files: z.array(FileEntrySchema).nullable().describe('Multiple files shown as tabs, or null for single-file mode.'),
}).strict();

// ── SteppedCarousel ──────────────────────────────────────────────────────────
export const SteppedCarouselSchema = z.object({
  id: z.string().describe('Unique component ID within this surface.'),
  component: z.literal('SteppedCarousel'),
  steps: z.array(z.object({
    title: DynStr.describe('Step section title.'),
    child: z.string().describe('ID of the child component rendered in this carousel step.'),
  }).strict()).describe('Array of carousel steps — each with a title and one child component ID.'),
  activeStep: z.number().nullable().describe('Zero-based index of the currently displayed step, or null for default (0).'),
}).strict();
export const RICH_COMPONENT_SCHEMAS = new Map<string, z.ZodTypeAny>([
  ['DecisionCard', DecisionCardSchema],
  ['TrackPicker', TrackPickerSchema],
  ['RadioGroup', RadioGroupSchema],
  ['Questionnaire', QuestionnaireSchema],
  ['SummaryCard', SummaryCardSchema],
  ['ArchitectureDiagram', ArchitectureDiagramSchema],
  ['ProgressSteps', ProgressStepsSchema],
  ['CodeBlock', CodeBlockSchema],
  ['Markdown', MarkdownSchema],
  ['GenerationProgress', GenerationProgressSchema],
  ['AuthCard', AuthCardSchema],
  ['FormGroup', FormGroupSchema],
  ['FileEditor', FileEditorSchema],
  ['SteppedCarousel', SteppedCarouselSchema],
  ['github/CreatePRFlow', CreatePRFlowSchema],
]);

/** LLM hints for each rich component — one-liner use-case + key props. */
export const RICH_COMPONENT_HINTS = new Map<string, string>([
  [
    'DecisionCard',
    'Display an architectural decision with a recommended option, rationale, and alternatives. ' +
      'Props: title (required), recommendation (required), rationale, alternatives (string[]), ' +
      'badge ("recommended"|"best-practice"|"required"|"optional"). Read-only — no action slot.',
  ],
  [
    'TrackPicker',
    'Equal-weight track/option picker with no recommendation bias. ' +
      'Props: title (required — heading above tiles), tracks (required — array of ' +
      '{id, label, description, icon?}). Each tile fires pick_track event with ' +
      'context.value = selected track id. Use instead of DecisionCard for unbiased choice selection.',
  ],
  [
    'RadioGroup',
    'Single-select option picker with an action event on selection. ' +
      'Props: options (array of {id, label, description?, recommended?}), value (pre-selected id), ' +
      'action (required — fires on pick with event.context.value = selected id).',
  ],
  [
    'Questionnaire',
    'Multi-question form with text, choice, and multiChoice inputs. Submit fires onSubmit action. ' +
      'Props: questions (array of {id, label, type?, choices?, required?}), submitLabel, onSubmit.',
  ],
  [
    'SummaryCard',
    'Plan summary card with key-value items grid and optional embedded children. ' +
      'Props: title (string|null), items (array of {label, value, badge?, link?}), ' +
      'children (array of child component IDs rendered below the items — e.g. an ArchitectureDiagram ' +
      'and action Button row). ' +
      'Use link on an item to render value as a clickable external link (e.g. PR URL). ' +
      'Exemplar: {"id":"plan","component":"SummaryCard","title":"Your AKS plan",' +
      '"items":[{"label":"Platform","value":"AKS Automatic","badge":"success"},' +
      '{"label":"AI Runtime","value":"KAITO (Llama-3.1-70B)","badge":null},' +
      '{"label":"Estimated cost","value":"~$420/mo","badge":"info"}],' +
      '"children":["arch-diagram","action-row"]}',
  ],
  [
    'ArchitectureDiagram',
    'Mermaid-based architecture diagram with zoom/pan controls. Accepts raw Mermaid string via ' +
      'diagram prop OR structured nodes+edges arrays. ' +
      'Props: diagram (Mermaid string|null), nodes (array of {id, label, type?}|null), ' +
      'edges (array of {from, to, label?}|null), title (string|null), description (string|null). ' +
      'Exemplar: {"id":"arch","component":"ArchitectureDiagram","title":"Solution Architecture",' +
      '"description":"AKS Automatic with KAITO","diagram":null,' +
      '"nodes":[{"id":"aks","label":"AKS Automatic","type":"aks"},' +
      '{"id":"kaito","label":"KAITO Model Pod","type":"ai"},' +
      '{"id":"ingress","label":"Ingress Controller","type":"networking"},' +
      '{"id":"storage","label":"Azure Files","type":"storage"}],' +
      '"edges":[{"from":"ingress","to":"aks","label":"HTTPS"},{"from":"aks","to":"kaito","label":"inference"},' +
      '{"from":"kaito","to":"storage","label":"model weights"}]}',
  ],
  [
    'Card',
    'Flexible container card wrapping a single child component. ' +
      'Props: child (required — ID of the child component inside the card). ' +
      'Wrap multiple elements in a Column or Row first, then reference as child.',
  ],
  [
    'github/CreatePRFlow',
    'PR-creation card showing status of a push-and-PR workflow. ' +
      'Props: status ("idle"|"pushing"|"creating_pr"|"done"|"error"), ' +
      'owner, repo, targetBranch, files (string[]), prTitle, prUrl, prNumber, ' +
      'errorMessage, isActive. ' +
      'Exemplar: {"id":"pr-flow","component":"github/CreatePRFlow","status":"done",' +
      '"owner":"octocat","repo":"kickstart-sample","targetBranch":"main",' +
      '"files":["infra/main.bicep",".github/workflows/deploy.yml"],' +
      '"prTitle":"feat: kickstart infra","prUrl":"https://github.com/octocat/kickstart-sample/pull/42",' +
      '"prNumber":42,"isActive":true}',
  ],
  [
    'ProgressSteps',
    'Horizontal step progress indicator with status dots. ' +
      'Props: steps (required — array of {id, label, status}). ' +
      'status values: "pending" | "active" | "complete" | "error". ' +
      'Exemplar: {"id":"steps","component":"ProgressSteps","steps":[' +
      '{"id":"plan","label":"Plan","status":"complete"},{"id":"generate","label":"Generate","status":"active"},' +
      '{"id":"deploy","label":"Deploy","status":"pending"}]}',
  ],
  [
    'CodeBlock',
    'Syntax-highlighted code display with optional copy button. ' +
      'Props: code (required — the source code string), language (e.g. "typescript", "yaml", "python", "bash"), ' +
      'filename (shown in header). ' +
      'Exemplar: {"id":"snippet","component":"CodeBlock","language":"typescript",' +
      '"filename":"main.ts","code":"const x = 42;"}',
  ],
  [
    'Markdown',
    'Renders a Markdown string with GFM support (tables, task lists, code fences). ' +
      'Props: content (required — the Markdown string). ' +
      'Use for free-form formatted text, instructions, or summaries. ' +
      'Exemplar: {"id":"md","component":"Markdown","content":"## Summary\\n\\n- Item 1\\n- Item 2"}',
  ],
  [
    'GenerationProgress',
    'Multi-step deployment/generation progress tracker with real-time polling. ' +
      'Props: steps (required — array of {id, label, status, detail?, timestamp?}), ' +
      'title, overallStatus ("idle"|"running"|"complete"|"error"), ' +
      'statusMessage, appUrl (deployed app URL), portalUrl, errorMessage. ' +
      'Exemplar: {"id":"gen","component":"GenerationProgress","title":"Deploying AKS cluster",' +
      '"overallStatus":"running","steps":[{"id":"s1","label":"Provision nodes","status":"complete"},' +
      '{"id":"s2","label":"Deploy workload","status":"running"}]}',
  ],
  [
    'AuthCard',
    'Authentication card for Azure or GitHub sign-in. ' +
      'Props: provider (required — "azure" or "github"), title, description. ' +
      'Shows sign-in state and triggers the browser auth flow on click. ' +
      'Exemplar: {"id":"auth","component":"AuthCard","provider":"azure",' +
      '"title":"Sign in to Azure","description":"Required to deploy resources."}',
  ],
  [
    'FormGroup',
    'Named form section wrapper with an optional step badge. ' +
      'Props: title (required), step (optional integer badge), child (required — ID of the single child component). ' +
      'Exemplar: {"id":"fg","component":"FormGroup","title":"Cluster settings","step":2,"child":"q1"}',
  ],
  [
    'FileEditor',
    'Inline code file viewer/editor with syntax highlighting (Monaco). ' +
      'For a single file: set filename, language, content (or artifactPath). ' +
      'For multiple files as tabs: use files array of {filename, language, content, artifactPath?}. ' +
      'readOnly: true for display-only (no editor toolbar). ' +
      'Exemplar (single): {"id":"fe","component":"FileEditor","filename":"Dockerfile",' +
      '"language":"dockerfile","readOnly":true,"content":"FROM node:20\\nRUN npm install"} ' +
      'Exemplar (multi-tab): {"id":"fe2","component":"FileEditor","files":[' +
      '{"filename":"main.bicep","language":"bicep","artifactPath":"/infra/main.bicep"},' +
      '{"filename":"deploy.yml","language":"yaml","artifactPath":"/workflows/deploy.yml"}]}',
  ],
  [
    'SteppedCarousel',
    'Sequential wizard-style carousel with navigation arrows and progress indicators. ' +
      'Each step shows one child component. ' +
      'Props: steps (required — array of {title, child} where child is a component ID), ' +
      'activeStep (optional — 0-based index, defaults to 0). ' +
      'Exemplar: {"id":"wiz","component":"SteppedCarousel","steps":[' +
      '{"title":"Step 1: Configure","child":"form-config"},' +
      '{"title":"Step 2: Review","child":"summary-card"},' +
      '{"title":"Step 3: Deploy","child":"gen-progress"}]}',
  ],
]);
