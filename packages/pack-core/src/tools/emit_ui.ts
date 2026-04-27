import { tool } from '@openai/agents';
import { z } from 'zod';
import { A2UIMessageSchema } from '@aks-kickstart/harness';
import type { A2UIMessageV09 } from '@aks-kickstart/harness';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';
import { stripNulls } from '@aks-kickstart/harness/runtime/z-strict';
import {
  DecisionCardSchema,
  RadioGroupSchema,
  QuestionnaireSchema,
  SummaryCardSchema,
  ArchitectureDiagramSchema,
  TrackPickerSchema,
  ProgressStepsSchema,
  CodeBlockSchema,
  MarkdownSchema,
  GenerationProgressSchema,
  AuthCardSchema,
  FormGroupSchema,
  FileEditorSchema,
  SteppedCarouselSchema,
} from '../schemas/rich-component-schemas.js';

// ── Schema ────────────────────────────────────────────────────────────────────

// Scalar values for data-model and action payload fields.
const A2UIScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);

// Dynamic string: a literal string or a data-binding reference `{ path: "..." }`.
// Subset of the full DynamicStringSchema accepted by the client catalog.
const A2UIDynamicString = z.union([
  z.string(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

// Dynamic boolean: a literal boolean or a data-binding reference.
const A2UIDynamicBoolean = z.union([
  z.boolean(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

// Dynamic number: a literal number or a data-binding reference.
const A2UIDynamicNumber = z.union([
  z.number(),
  z.object({ path: z.string().describe('JSON Pointer path into the data model.') }),
]);

// Action schema for interactive components.
// Uses a flat event envelope; `payload` is nullable so null is stripped by
// stripNulls() before runtime validation (satisfies OpenAI strict-mode required).
//
// #1032 — The `payload` field WAS `z.record(z.string(), A2UIScalar).nullable()`.
// OpenAI strict mode rejects records because the converter
// (@openai/agents-core/dist/utils/zodJsonSchemaCompat.mjs:237-242 / buildRecordSchema)
// emits `{ type: 'object', additionalProperties: <scalar> }` with NO `properties`
// key, which violates OpenAI's rule that every object node must declare
// `properties` (and `additionalProperties: false`). The fix narrows `payload`
// to a closed object with a fixed key set. Unused keys MUST be set to null
// and are stripped by `stripNulls()` before `A2UIMessageSchema.parse()`.
//
// Closed key set:
//   - `confirmed` — evidence-backed (see
//     packages/pack-core/src/__tests__/tools/emit_ui.test.ts, existing
//     confirm-dialog fixture).
//   - `id`, `value`, `action`, `target` — forward-looking interaction keys.
//     Intentional narrowing per DP Amendment #1 / Nibbler N2: not present in
//     current repo usage. Adding new keys requires a code change + test update.
//     If this list ever needs to grow past ~8 entries, switch to
//     Alternative 2 (JSON-string payload parsed in execute()).
const A2UIActionSchema = z.object({
  event: z.object({
    // Guidance moved here from the removed container-level .describe() to avoid
    // $ref+description sibling violations in OpenAI strict-mode JSON Schema.
    name: z.string().describe(
      'Structured event name emitted when the component is activated. ' +
        'Use `action: { event: { name: "..." } }` — never a bare onClick string.',
    ),
    payload: z
      .object({
        confirmed: z.boolean().nullable(),
        id: z.string().nullable(),
        value: A2UIScalar.nullable(),
        action: z.string().nullable(),
        target: z.string().nullable(),
      })
      .nullable()
      .describe(
        'Event payload with a closed key set (confirmed, id, value, action, target). ' +
          'Unused keys MUST be set to null. Unknown keys are stripped by OpenAI strict ' +
          'mode + zod. See .changeset for the narrowing contract.',
      ),
  }),
});

// ── Per-component discriminated union ─────────────────────────────────────────
//
// Each variant is keyed on `component` (the A2UI v0.9 discriminator) and
// declares ONLY the fields applicable to that component type. This prevents
// the LLM from emitting non-spec fields (e.g. `child` on Text, `text` on
// Button) that cause the client registry to reject the component as
// _ErrorComponent (#1017).
//
// OpenAI strict-mode requires every key in `properties` to appear in
// `required`. All fields in each variant are therefore included in `required`
// (no `.optional()`). Fields that the LLM may not always populate are typed
// as `.nullable()` and stripped by stripNulls() before runtime validation.
//
// This schema is a SUBSET of the client-side component catalog schemas
// (packages/web/src/vendor/a2ui/web_core/basic_catalog/components/basic_components.ts
//  + packages/web/src/catalog/fluent-components/).
// Required fields per Ahmed's directive (MUST be emitted when the component
// is used, never null):
//   Text      → text
//   Image     → url
//   Button    → child + action
//   TextField → label
//   CheckBox  → label + value
const A2UIComponentSchema = z.discriminatedUnion('component', [
  // ── Leaf / content components ──────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Text'),
    text: A2UIDynamicString.describe('Text content to display. Required for Text components.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Image'),
    url: A2UIDynamicString.describe('URL of the image. Required for Image components.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Icon'),
    name: z.string().describe('Icon name from the catalog (e.g. "add", "delete", "search").'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Video'),
    url: A2UIDynamicString.describe('URL of the video. Required for Video components.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('AudioPlayer'),
    url: A2UIDynamicString.describe('URL of the audio. Required for AudioPlayer components.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Link'),
    text: A2UIDynamicString.describe('Visible link text.'),
    url: A2UIDynamicString.describe('URL the link navigates to.'),
  }).strict(),
  // ── Layout / container components ─────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Row'),
    children: z.array(z.string()).describe(
      'Ordered array of child component IDs. Use for horizontal layouts.',
    ),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Column'),
    children: z.array(z.string()).describe(
      'Ordered array of child component IDs. Use for vertical layouts.',
    ),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('List'),
    children: z.array(z.string()).describe('Ordered array of child component IDs.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Card'),
    child: z.string().describe(
      'ID of the single child component inside the card. ' +
        'Wrap multiple elements in a Column or Row first.',
    ),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Tabs'),
    tabs: z.array(
      z.object({
        title: A2UIDynamicString.describe('Tab title.'),
        child: z.string().describe('ID of the child component shown in this tab.'),
      }),
    ).min(1).describe('Array of tab definitions; each tab has a title and a child component ID.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Modal'),
    trigger: z.string().describe('ID of the component that opens the modal.'),
    content: z.string().describe('ID of the component displayed inside the modal.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Divider'),
  }).strict(),
  // ── Interactive components ─────────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Button'),
    child: z.string().describe(
      'ID of the Text (or Icon) child component that provides the button label. ' +
        'Required — a Button without a label child is invalid.',
    ),
    action: A2UIActionSchema,
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('TextField'),
    label: A2UIDynamicString.describe('Text label for the input field. Required.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('CheckBox'),
    label: A2UIDynamicString.describe('Label displayed next to the checkbox. Required.'),
    value: A2UIDynamicBoolean.describe('Current checked state of the checkbox. Required.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('ChoicePicker'),
    options: z.array(
      z.object({
        label: A2UIDynamicString.describe('Option label text.'),
        value: z.string().describe('Stable value for this option.'),
      }),
    ).describe('List of available options.'),
    value: z.union([
      z.array(z.string()),
      z.object({ path: z.string() }),
    ]).describe('Currently selected value(s) — array of strings or a data-binding path.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Slider'),
    max: z.number().describe('Maximum value of the slider.'),
    value: A2UIDynamicNumber.describe('Current value of the slider.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('DateTimeInput'),
    value: A2UIDynamicString.describe('Selected date/time in ISO 8601 format, or a data-binding path.'),
  }).strict(),
  // ── Data display ──────────────────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Table'),
    columns: z.array(A2UIDynamicString).min(1).describe('Column headers.'),
    rows: z.array(z.array(A2UIDynamicString)).describe(
      'Table rows; each row is an array of cell values matching the columns order.',
    ),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Alert'),
    message: A2UIDynamicString.describe('Alert message text.'),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  // ── Fluent-catalog-only components ────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Badge'),
    text: A2UIDynamicString.describe('Badge label text.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('ComboBox'),
    options: z.array(
      z.object({
        text: A2UIDynamicString.describe('Option display text.'),
        value: A2UIDynamicString.describe('Option value.'),
      }),
    ).describe('List of available options.'),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('MultiSelect'),
    options: z.array(
      z.object({
        text: A2UIDynamicString.describe('Option display text.'),
        value: A2UIDynamicString.describe('Option value.'),
      }),
    ).describe('List of available options.'),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Toggle'),
    label: A2UIDynamicString.nullable().describe('Label for the toggle, or null.'),
    checked: A2UIDynamicBoolean.nullable().describe(
      'Current toggle state bound to the data model, or null.',
    ),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Accordion'),
    items: z.array(
      z.object({
        title: A2UIDynamicString.describe('Accordion section title.'),
        children: z.array(z.string()).describe('Child component IDs for this section.'),
      }),
    ).describe('Accordion sections, each with a title and child IDs.'),
  }).strict(),
  // ── Rich domain components (registry-derived #1130) ────────────────────
  DecisionCardSchema,
  TrackPickerSchema,
  RadioGroupSchema,
  QuestionnaireSchema,
  // ── Phase B rich components (#1113 Phase B) ────────────────────────────
  SummaryCardSchema,
  ArchitectureDiagramSchema,
  // ── G1/G2 remaining rich components (#3) ──────────────────────────────
  ProgressStepsSchema,
  CodeBlockSchema,
  MarkdownSchema,
  GenerationProgressSchema,
  AuthCardSchema,
  FormGroupSchema,
  FileEditorSchema,
  SteppedCarouselSchema,
]);

// Full discriminated union for the A2UI v0.9 envelope.
//
// z.unknown() was previously used here, but the OpenAI Responses API rejects
// tool schemas where any property in `properties` is missing a `type` key
// (HTTP 400: "schema must have a 'type' key"). z.discriminatedUnion produces
// a `oneOf` with all branches carrying `type: "object"`, which satisfies the
// validator. The `op` discriminator is required by the schema; the runtime
// A2UIMessageSchema.parse() in execute() still accepts envelopes with or
// without `op` via the `withDiscriminator` preprocessor.
// Bounded surface id — D11 / Zapp M1 (#1075). Replaces the four raw
// `z.string()` sites below. Length-only (1–128); no charset regex — see L1
// deferral in Leela DP v2.
//
// NOTE: no `.describe()` here. The schema is reused across four branches of
// the discriminated union; the zod→JSON-Schema converter emits later uses as
// `$ref` and a sibling `description` on a `$ref` node violates the
// OpenAI strict-mode $ref-sibling guard enforced by
// emit_ui-schema.test.ts (#1050). The min/max constraints are self-
// documenting; a description can be attached at each call site if needed.
const SurfaceIdSchema = z.string().min(1).max(128);

const A2UIMessageInputSchema = z.discriminatedUnion('op', [
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('createSurface'),
    createSurface: z.object({
      surfaceId: SurfaceIdSchema,
      catalogId: z.string().describe('Must always be "kickstart"'),
      sendDataModel: z
        .boolean()
        .nullable()
        .describe(
          'Whether the surface expects server-pushed data-model updates. ' +
            'Set to null when not applicable.',
        ),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('updateComponents'),
    updateComponents: z.object({
      surfaceId: SurfaceIdSchema,
      components: z.array(A2UIComponentSchema).min(1),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('updateDataModel'),
    updateDataModel: z.object({
      surfaceId: SurfaceIdSchema,
      path: z
        .string()
        .nullable()
        .describe('JSON-pointer-like path to the data-model field being updated, or null for root.'),
      value: A2UIScalar
        .nullable()
        .describe('New scalar value to set at `path`. May be null.'),
    }),
  }),
  z.object({
    version: z.literal('v0.9'),
    op: z.literal('deleteSurface'),
    deleteSurface: z.object({
      surfaceId: SurfaceIdSchema,
    }),
  }),
]).describe(
  'A valid A2UI v0.9 message envelope. Must have "version": "v0.9" and "op" set to one of: ' +
  '"createSurface", "updateComponents", "updateDataModel", "deleteSurface". ' +
  'Include the matching payload object (e.g. "createSurface": { "surfaceId": "...", "catalogId": "..." }).',
);

const EmitUiInputSchema = z.object({
  message: A2UIMessageInputSchema,
});

// ── Tool ──────────────────────────────────────────────────────────────────────

export const emitUiTool: ToolContribution = {
  name: 'core.emit_ui',
  tool: tool({
    name: 'core.emit_ui',
    description:
      'Validates and emits an A2UI v0.9 message (spec: https://a2ui.org/specification/v0.9-a2ui/). ' +
      'The message is validated against the A2UI schema and recorded on the session context ' +
      'so the runner can stream it to the browser as an "a2ui" SSE event. ' +
      'IMPORTANT rules (v0.9):\n' +
      '- In createSurface messages, always set catalogId to "kickstart".\n' +
      '- In updateComponents, emit a FLAT adjacency list of components. Every entry has ' +
      '`id` (unique within surface) and `component` (component type, e.g. "Button", "Row", "Text").\n' +
      '- Hierarchy is EXPLICIT: containers (Row, Column, Card) declare `child`/`children` IDs. ' +
      'Components are never nested by emit order.\n' +
      '- EACH COMPONENT ONLY CARRIES ITS OWN FIELDS. Do NOT add extra fields (e.g. do NOT add ' +
      '`child` or `action` to a Text; do NOT add `text` to a Button). The schema is a discriminated ' +
      'union — each `component` type accepts only its own properties.\n' +
      '- A Button\'s visible label is a Text CHILD referenced via `child`. Button.action is required.\n' +
      '- Interactions use `action: { event: { name: "...", payload: null } }`. ' +
      'Do NOT emit `onClick` / `onChange` / `items` / `placeholder` / `disabled`.\n' +
      '- Text.text is required. Image.url is required. Button.child and Button.action are required. ' +
      'TextField.label is required. CheckBox.label and CheckBox.value are required.\n' +
      'Spec-compliant example:\n' +
      '{"version":"v0.9","op":"updateComponents","updateComponents":{"surfaceId":"main","components":[' +
      '{"id":"root","component":"Column","children":["greeting","buttons"]},' +
      '{"id":"greeting","component":"Text","text":"Hello"},' +
      '{"id":"buttons","component":"Row","children":["cancel-btn","ok-btn"]},' +
      '{"id":"cancel-btn","component":"Button","child":"cancel-text","action":{"event":{"name":"cancel","payload":null}}},' +
      '{"id":"cancel-text","component":"Text","text":"Cancel"},' +
      '{"id":"ok-btn","component":"Button","child":"ok-text","action":{"event":{"name":"ok","payload":null}}},' +
      '{"id":"ok-text","component":"Text","text":"OK"}]}}',
    parameters: EmitUiInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;

      // Re-validate through the full harness A2UIMessageSchema which applies
      // the withDiscriminator preprocessor and strips the 'op' discriminator
      // field. This is the canonical runtime validation path.
      let parsed: A2UIMessageV09;
      try {
        const cleaned = stripNulls(input.message);
        parsed = A2UIMessageSchema.parse(cleaned) as A2UIMessageV09;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`emit_ui: invalid A2UI message — ${msg}`, { cause: err });
      }

      if (session) {
        // ── D11 / Zapp M1 (#1075) — surface lifecycle invariants ───────────
        // Ordering of checks, authoritative per Leela DP v2:
        //   1. Schema parse (already done above; also length-bounds surfaceId)
        //   2. Dedupe:  createSurface on already-live id → reject
        //   3. Cap:     createSurface when liveSurfaceIds is full → reject
        //   4. Exists:  update*/delete on unknown id → reject
        //   5. recordA2UIEmission() mutates the set
        // Dedupe is intentionally checked before the cap: a duplicate is a
        // correctness bug and should surface even when the session is also
        // full. `parsed` has the `op` discriminator stripped by
        // A2UIMessageSchema — identify the op via the payload key instead.
        const parsedRec = parsed as unknown as {
          createSurface?: { surfaceId: string };
          updateComponents?: { surfaceId: string };
          updateDataModel?: { surfaceId: string };
          deleteSurface?: { surfaceId: string };
        };

        if (parsedRec.createSurface) {
          const surfaceId = parsedRec.createSurface.surfaceId;
          if (session.liveSurfaceIds.has(surfaceId)) {
            throw new Error(
              `emit_ui: surface '${surfaceId}' already exists — use updateComponents to modify it`,
            );
          }
          if (session.liveSurfaceIds.size >= session.maxLiveSurfaces) {
            throw new Error(
              `emit_ui: session surface cap reached (${session.maxLiveSurfaces}) — ` +
                `delete unused surfaces with op:'deleteSurface' before creating new ones`,
            );
          }
        } else {
          const targeted =
            parsedRec.updateComponents ??
            parsedRec.updateDataModel ??
            parsedRec.deleteSurface;
          if (targeted) {
            const surfaceId = targeted.surfaceId;
            if (!session.liveSurfaceIds.has(surfaceId)) {
              throw new Error(
                `emit_ui: surface '${surfaceId}' does not exist — call createSurface first`,
              );
            }
          }
        }

        session.recordA2UIEmission(parsed);
      }

      // Derive op name from the key that isn't 'version' (A2UIMessageSchema strips the 'op' field).
      const op = Object.keys(parsed as Record<string, unknown>)
        .find(k => k !== 'version') ?? 'unknown';
      return `emitted: ${op}`;
    },
  }),
};
