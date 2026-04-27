/**
 * @file show_card.ts
 *
 * `core.show_card` — render informational (display-only) surfaces.
 *
 * Handles `createSurface` and `updateComponents` for display components:
 * text, images, tables, alerts, badges, progress, code blocks, diagrams, etc.
 * For interactive/form surfaces use `core.show_form`.
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
  SummaryCardSchema,
  ArchitectureDiagramSchema,
  ProgressStepsSchema,
  CodeBlockSchema,
  MarkdownSchema,
  GenerationProgressSchema,
} from '../schemas/rich-component-schemas.js';

// ── Display-only component union ──────────────────────────────────────────────

const DisplayComponentSchema = z.discriminatedUnion('component', [
  // ── Leaf / content ────────────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Text'),
    text: A2UIDynamicString.describe('Text content to display. Required for Text components.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Image'),
    url: A2UIDynamicString.describe('URL of the image.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Icon'),
    name: z.string().describe('Icon name from the catalog (e.g. "add", "delete").'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Video'),
    url: A2UIDynamicString.describe('URL of the video.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('AudioPlayer'),
    url: A2UIDynamicString.describe('URL of the audio.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Link'),
    text: A2UIDynamicString.describe('Visible link text.'),
    url: A2UIDynamicString.describe('URL the link navigates to.'),
  }).strict(),
  // ── Layout / container ────────────────────────────────────────────────
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
    component: z.literal('Modal'),
    trigger: z.string().describe('ID of the component that opens the modal.'),
    content: z.string().describe('ID of the component displayed inside the modal.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Divider'),
  }).strict(),
  // ── Data display ───────────────────────────────────────────────────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Table'),
    columns: z.array(A2UIDynamicString).min(1).describe('Column headers.'),
    rows: z.array(z.array(A2UIDynamicString)).describe('Table rows matching columns order.'),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Alert'),
    message: A2UIDynamicString.describe('Alert message text.'),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Badge'),
    text: A2UIDynamicString.describe('Badge label text.'),
  }).strict(),
  // ── Fluent toggle (display mode — no user interaction handler) ─────────
  z.object({
    id: z.string().describe('Unique component ID within this surface.'),
    component: z.literal('Toggle'),
    label: A2UIDynamicString.nullable().describe('Toggle label, or null.'),
    checked: A2UIDynamicBoolean.nullable().describe('Toggle state, or null.'),
    action: A2UIActionSchema.nullable(),
  }).strict(),
  // ── Rich display components ────────────────────────────────────────────
  SummaryCardSchema,
  ArchitectureDiagramSchema,
  ProgressStepsSchema,
  CodeBlockSchema,
  MarkdownSchema,
  GenerationProgressSchema,
]);

// ── Message input schema ───────────────────────────────────────────────────────

const ShowCardInputSchema = z.object({
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
        components: z.array(DisplayComponentSchema).min(1),
      }),
    }),
  ]).describe(
    'A2UI v0.9 envelope scoped to informational display. ' +
      'Use "createSurface" to initialise a card surface, then ' +
      '"updateComponents" with display-only components. ' +
      'For forms/inputs use core.show_form. ' +
      'For confirmation dialogs use core.confirm.',
  ),
});

// ── Tool ───────────────────────────────────────────────────────────────────────

export const showCardTool: ToolContribution = {
  name: 'core.show_card',
  tool: tool({
    name: 'core.show_card',
    description:
      'Creates or updates an informational card surface (A2UI v0.9). ' +
      'Use for display-only content: status cards, summaries, code blocks, ' +
      'architecture diagrams, progress steps, tables, alerts, markdown text, etc. ' +
      'IMPORTANT rules:\n' +
      '- catalogId must always be "kickstart".\n' +
      '- Emit a FLAT adjacency list of components; hierarchy is declared via children/child IDs.\n' +
      '- Each component only carries its own fields (no extra keys).\n' +
      '- Do NOT use interactive/form components here; use core.show_form for those.\n' +
      'Example: {"version":"v0.9","op":"updateComponents","updateComponents":{"surfaceId":"status",' +
      '"components":[{"id":"root","component":"Column","children":["title","msg"]},' +
      '{"id":"title","component":"Text","text":"Deployment Complete"},' +
      '{"id":"msg","component":"Alert","message":"All pods are running.","action":null}]}}',
    parameters: ShowCardInputSchema,
    execute: async (input, runCtx): Promise<string> => {
      const session = runCtx?.context as SessionCtx | undefined;
      return executeA2UIMessage(input.message, session, 'core.show_card');
    },
  }),
};
