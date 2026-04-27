/**
 * @file show_form.ts
 *
 * `core.show_form` — render interactive form surfaces.
 *
 * Handles `createSurface` and `updateComponents` for form and interactive
 * components: text fields, checkboxes, buttons, pickers, questionnaires, etc.
 * Layout containers (Row, Column, Card, etc.) are also accepted here so agents
 * can structure multi-field forms.
 *
 * For display-only surfaces use `core.show_card`.
 * For confirmation dialogs use `core.confirm`.
 * For data-model updates or surface deletion use `core.navigate`.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { ToolContribution, SessionCtx } from '@aks-kickstart/harness';
import {
  SurfaceIdSchema,
  A2UIDynamicString,
  A2UIDynamicBoolean,
  A2UIDynamicNumber,
  A2UIActionSchema,
  executeA2UIMessage,
} from './_a2ui-shared.js';
import {
  DecisionCardSchema,
  TrackPickerSchema,
  RadioGroupSchema,
  QuestionnaireSchema,
  AuthCardSchema,
  FormGroupSchema,
  FileEditorSchema,
  SteppedCarouselSchema,
} from '../schemas/rich-component-schemas.js';

// ── Form / interactive component union ───────────────────────────────────────

const FormComponentSchema = z.discriminatedUnion('component', [
  // ── Layout (needed to structure multi-field forms) ─────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Row'),
    children: z.array(z.string()).describe('Ordered child component IDs for horizontal layout.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Column'),
    children: z.array(z.string()).describe('Ordered child component IDs for vertical layout.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('List'),
    children: z.array(z.string()).describe('Ordered child component IDs.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Card'),
    child: z.string().describe('ID of the single child component inside the card.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Tabs'),
    tabs: z.array(
      z.object({
        title: A2UIDynamicString.describe('Tab title.'),
        child: z.string().describe('ID of the child component for this tab.'),
      }),
    ).min(1).describe('Array of tab definitions.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Divider'),
  }).strict(),
  // ── Label / helper text ────────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Text'),
    text: A2UIDynamicString.describe('Text content. Use for labels, headings, or helper text.'),
  }).strict(),
  // ── Interactive input components ───────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Button'),
    child: z.string().describe(
      'ID of the Text (or Icon) child providing the button label. Required.',
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
    value: A2UIDynamicBoolean.describe('Current checked state. Required.'),
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
    value: A2UIDynamicNumber.describe('Current slider value.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('DateTimeInput'),
    value: A2UIDynamicString.describe('Selected date/time in ISO 8601 format, or a data-binding path.'),
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
    label: A2UIDynamicString.nullable().describe('Toggle label, or null.'),
    checked: A2UIDynamicBoolean.nullable().describe('Toggle state, or null.'),
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
    ).describe('Accordion sections.'),
  }).strict(),
  // ── Rich form / wizard components ──────────────────────────────────────
  DecisionCardSchema,
  TrackPickerSchema,
  RadioGroupSchema,
  QuestionnaireSchema,
  AuthCardSchema,
  FormGroupSchema,
  FileEditorSchema,
  SteppedCarouselSchema,
]);

// ── Message input schema ───────────────────────────────────────────────────────

const ShowFormInputSchema = z.object({
  message: z.discriminatedUnion('op', [
    z.object({
      version: z.literal('v0.9'),
      op: z.literal('createSurface'),
      createSurface: z.object({
        surfaceId: SurfaceIdSchema,
        catalogId: z.string().describe('Must always be "kickstart"'),
        sendDataModel: z
          .boolean()
          .nullable()
          .describe('Whether the surface expects data-model updates. Set to null if not needed.'),
      }),
    }),
    z.object({
      version: z.literal('v0.9'),
      op: z.literal('updateComponents'),
      updateComponents: z.object({
        surfaceId: SurfaceIdSchema,
        components: z.array(FormComponentSchema).min(1),
      }),
    }),
  ]).describe(
    'A2UI v0.9 envelope scoped to interactive forms. ' +
      'Use "createSurface" to initialise a form surface, then ' +
      '"updateComponents" with form and interactive components. ' +
      'For display-only content use core.show_card.',
  ),
});

// ── Tool ───────────────────────────────────────────────────────────────────────

export const showFormTool: ToolContribution = {
  name: 'core.show_form',
  tool: tool({
    name: 'core.show_form',
    description:
      'Creates or updates an interactive form surface (A2UI v0.9). ' +
      'Use for forms, questionnaires, deployment wizards, configuration panels, ' +
      'and any surface that collects user input via buttons, text fields, ' +
      'checkboxes, pickers, toggles, or stepped carousels. ' +
      'IMPORTANT rules:\n' +
      '- catalogId must always be "kickstart".\n' +
      '- Emit a FLAT adjacency list; hierarchy is declared via children/child IDs.\n' +
      '- Each component only carries its own fields.\n' +
      '- A Button\'s label is a Text CHILD referenced via `child`. Button.action is required.\n' +
      '- Interactions use `action: { event: { name: "...", payload: null } }`.\n' +
      '- Do NOT use display-only components here; use core.show_card for those.\n' +
      'Example: {"version":"v0.9","op":"updateComponents","updateComponents":{"surfaceId":"setup",' +
      '"components":[{"id":"root","component":"Column","children":["name","submit"]},' +
      '{"id":"name","component":"TextField","label":"Cluster name"},' +
      '{"id":"submit","component":"Button","child":"submit-lbl",' +
      '"action":{"event":{"name":"submit","payload":null}}},' +
      '{"id":"submit-lbl","component":"Text","text":"Create"}]}}',
    parameters: ShowFormInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;
      return executeA2UIMessage(input.message, session, 'core.show_form');
    },
  }),
};
