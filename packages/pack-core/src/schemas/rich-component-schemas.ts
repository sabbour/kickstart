/**
 * Server-safe Zod schemas for rich components (no JSX imports).
 *
 * These mirror the prop interfaces in packages/web/src/catalog/components/*.tsx
 * so the emit_ui tool can validate LLM output against real component shapes.
 *
 * #1130 Phase A — DecisionCard, RadioGroup, Questionnaire
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
          .url('Must be a valid URL')
          .refine(url => url.startsWith('https://'), { message: 'Only HTTPS URLs allowed' }),
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

/** All rich component schemas keyed by component name. */
export const RICH_COMPONENT_SCHEMAS = new Map<string, z.ZodTypeAny>([
  ['DecisionCard', DecisionCardSchema],
  ['TrackPicker', TrackPickerSchema],
  ['RadioGroup', RadioGroupSchema],
  ['Questionnaire', QuestionnaireSchema],
  ['SummaryCard', SummaryCardSchema],
  ['ArchitectureDiagram', ArchitectureDiagramSchema],
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
]);
