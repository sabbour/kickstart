/**
 * @module @kickstart/core/services/a2ui-schema
 *
 * Zod schemas for A2UI v0.9 message validation.
 * Per-component prop schemas for all 28 catalog types.
 * Payload limits to prevent DoS from oversized LLM output.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Payload Limits
// ---------------------------------------------------------------------------

export const PAYLOAD_LIMITS = {
  /** Max A2UI messages per response */
  maxMessages: 50,
  /** Max components per updateComponents message */
  maxComponents: 200,
  /** Max total payload size in bytes (JSON stringified) */
  maxPayloadBytes: 512 * 1024,
  /** Max nesting depth for updateDataModel values */
  maxNestingDepth: 10,
  /** Max string length per property value */
  maxStringLength: 50_000,
  /** Max actions array length */
  maxActions: 20,
} as const;

// ---------------------------------------------------------------------------
// Depth-check utility
// ---------------------------------------------------------------------------

/**
 * Check that a value's nesting depth does not exceed maxDepth.
 * Returns false if depth is exceeded.
 */
export function checkDepth(
  value: unknown,
  maxDepth: number,
  current = 0,
): boolean {
  if (current > maxDepth) return false;
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).every((v) =>
      checkDepth(v, maxDepth, current + 1),
    );
  }
  return true;
}

// ---------------------------------------------------------------------------
// Known component types (28)
// ---------------------------------------------------------------------------

export const KNOWN_COMPONENT_TYPES = new Set([
  "Accordion",
  "ArchitectureDiagram",
  "AudioPlayer",
  "AuthCard",
  "Badge",
  "Button",
  "Card",
  "CheckBox",
  "ChoicePicker",
  "Column",
  "ComboBox",
  "CostEstimate",
  "DateTimeInput",
  "DeploymentProgress",
  "Divider",
  "FileEditor",
  "Icon",
  "Image",
  "List",
  "Modal",
  "MultiSelect",
  "Row",
  "Slider",
  "Tabs",
  "Text",
  "TextField",
  "Toggle",
  "Video",
] as const);

export type KnownComponentType =
  typeof KNOWN_COMPONENT_TYPES extends Set<infer T> ? T : never;

// ---------------------------------------------------------------------------
// Shared Zod helpers
// ---------------------------------------------------------------------------

/** Truncate a string to the configured max length instead of rejecting. */
const truncateToLimit = (s: string): string =>
  s.length > PAYLOAD_LIMITS.maxStringLength
    ? s.slice(0, PAYLOAD_LIMITS.maxStringLength)
    : s;

const boundedString = z.string().transform(truncateToLimit);

/** Bounded string that must be non-empty (validated before truncation). */
const boundedStringNonEmpty = z.string().min(1).transform(truncateToLimit);

/** Bounded string that must start with "/" (validated before truncation). */
const boundedStringPath = z.string().startsWith("/").transform(truncateToLimit);

/** For dynamic props that can be string or object (DataBinding/FunctionCall). */
const dynamicString = z.union([boundedString, z.record(z.unknown())]);

const actionSchema = z
  .object({
    event: z.object({
      name: z.string(),
      data: z.record(z.unknown()).optional(),
    }),
  })
  .passthrough();

const childrenArray = z.array(boundedString);

// ---------------------------------------------------------------------------
// Per-component prop schemas (28 types)
// ---------------------------------------------------------------------------

const TextPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Text"),
    text: dynamicString,
    variant: z
      .enum(["h1", "h2", "h3", "body", "caption", "code"])
      .optional(),
  })
  .strip();

const ImagePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Image"),
    src: dynamicString,
    alt: dynamicString,
  })
  .strip();

const IconPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Icon"),
    name: dynamicString,
    size: dynamicString.optional(),
  })
  .strip();

const VideoPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Video"),
    src: dynamicString,
  })
  .strip();

const AudioPlayerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AudioPlayer"),
    src: dynamicString,
  })
  .strip();

const RowPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Row"),
    children: childrenArray,
    gap: dynamicString.optional(),
    justify: z
      .enum(["start", "center", "end", "spaceBetween", "spaceAround"])
      .optional(),
    align: z.enum(["start", "center", "end", "stretch"]).optional(),
    wrap: z.boolean().optional(),
  })
  .strip();

const ColumnPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Column"),
    children: childrenArray,
    gap: dynamicString.optional(),
  })
  .strip();

const ListPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("List"),
    children: childrenArray,
    ordered: z.boolean().optional(),
  })
  .strip();

const CardPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Card"),
    children: childrenArray,
  })
  .strip();

const TabDefSchema = z.object({
  label: boundedString,
  children: childrenArray,
});

const TabsPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Tabs"),
    tabs: z.array(TabDefSchema),
  })
  .strip();

const DividerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Divider"),
  })
  .strip();

const ModalPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Modal"),
    child: dynamicString,
    title: dynamicString,
    open: z.boolean().optional(),
  })
  .strip();

const ButtonPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Button"),
    child: dynamicString.optional(),
    label: dynamicString.optional(),
    variant: z
      .enum(["primary", "secondary", "outline", "danger", "ghost"])
      .optional(),
    disabled: z.boolean().optional(),
    action: actionSchema,
  })
  .strip();

const TextFieldPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("TextField"),
    label: dynamicString,
    placeholder: dynamicString.optional(),
    value: dynamicString.optional(),
    action: actionSchema.optional(),
  })
  .strip();

const CheckBoxPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("CheckBox"),
    label: dynamicString,
    checked: z.boolean().optional(),
    action: actionSchema.optional(),
  })
  .strip();

const ChoiceOptionSchema = z.object({
  label: dynamicString,
  value: dynamicString,
});

const ChoicePickerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("ChoicePicker"),
    label: dynamicString,
    options: z.array(ChoiceOptionSchema),
    action: actionSchema.optional(),
  })
  .strip();

const SliderPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Slider"),
    label: dynamicString,
    min: z.number(),
    max: z.number(),
    value: z.number().optional(),
    action: actionSchema.optional(),
  })
  .strip();

const DateTimeInputPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("DateTimeInput"),
    label: dynamicString,
    value: dynamicString.optional(),
  })
  .strip();

// Custom Kickstart components

const CostItemSchema = z.object({
  name: dynamicString,
  sku: dynamicString,
  monthlyCost: z.number(),
});

const CostEstimatePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("CostEstimate"),
    items: z.array(CostItemSchema),
    total: z.number(),
    currency: dynamicString,
  })
  .strip();

const ArchNodeSchema = z.object({
  id: boundedString,
  label: dynamicString,
  type: z.enum([
    "compute",
    "database",
    "cache",
    "network",
    "storage",
    "ai",
    "messaging",
  ]),
});

const ArchEdgeSchema = z.object({
  from: boundedString,
  to: boundedString,
});

const ArchitectureDiagramPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("ArchitectureDiagram"),
    nodes: z.array(ArchNodeSchema),
    edges: z.array(ArchEdgeSchema),
  })
  .strip();

const FileEditorPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("FileEditor"),
    filename: dynamicString,
    language: dynamicString,
    content: dynamicString,
  })
  .strip();

const AuthCardPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AuthCard"),
    provider: z.enum(["azure", "github"]),
    title: dynamicString,
    description: dynamicString.optional(),
  })
  .strip();

const DeploymentStepSchema = z.object({
  id: boundedString,
  label: dynamicString,
  status: z.enum(["pending", "running", "complete", "error", "skipped"]),
});

const DeploymentProgressPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("DeploymentProgress"),
    steps: z.array(DeploymentStepSchema),
  })
  .strip();

// New Fluent Components (5)

const BadgePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Badge"),
    text: dynamicString.optional(),
    color: z
      .enum([
        "brand",
        "danger",
        "important",
        "informative",
        "severe",
        "subtle",
        "success",
        "warning",
      ])
      .optional(),
    shape: z.enum(["circular", "rounded", "square"]).optional(),
    size: z
      .enum(["tiny", "small", "medium", "large", "extra-large"])
      .optional(),
    appearance: z.enum(["filled", "ghost", "outline", "tint"]).optional(),
    variant: z.enum(["badge", "counter", "presence"]).optional(),
    count: z.number().optional(),
    status: z
      .enum([
        "available",
        "away",
        "busy",
        "do-not-disturb",
        "offline",
        "out-of-office",
        "unknown",
      ])
      .optional(),
  })
  .strip();

const AccordionItemDefSchema = z.object({
  title: dynamicString,
  children: childrenArray,
});

const AccordionPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Accordion"),
    items: z.array(AccordionItemDefSchema),
    collapsible: z.boolean().optional(),
    multiple: z.boolean().optional(),
  })
  .strip();

const TogglePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Toggle"),
    label: dynamicString.optional(),
    checked: z.boolean().optional(),
    disabled: z.boolean().optional(),
  })
  .strip();

const ComboBoxOptionSchema = z.object({
  text: dynamicString,
  value: dynamicString,
});

const ComboBoxPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("ComboBox"),
    label: dynamicString.optional(),
    options: z.array(ComboBoxOptionSchema),
    placeholder: dynamicString.optional(),
    allowCustom: z.boolean().optional(),
    value: dynamicString.optional(),
  })
  .strip();

const MultiSelectPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("MultiSelect"),
    label: dynamicString.optional(),
    options: z.array(ComboBoxOptionSchema),
    placeholder: dynamicString.optional(),
    selectedValues: z.array(boundedString).optional(),
  })
  .strip();

// ---------------------------------------------------------------------------
// Component schema registry
// ---------------------------------------------------------------------------

/**
 * Maps each known component type to its Zod schema.
 * Used by the response processor to validate per-component props.
 */
export const COMPONENT_SCHEMA_REGISTRY: Record<string, z.ZodType> = {
  Accordion: AccordionPropsSchema,
  ArchitectureDiagram: ArchitectureDiagramPropsSchema,
  AudioPlayer: AudioPlayerPropsSchema,
  AuthCard: AuthCardPropsSchema,
  Badge: BadgePropsSchema,
  Button: ButtonPropsSchema,
  Card: CardPropsSchema,
  CheckBox: CheckBoxPropsSchema,
  ChoicePicker: ChoicePickerPropsSchema,
  Column: ColumnPropsSchema,
  ComboBox: ComboBoxPropsSchema,
  CostEstimate: CostEstimatePropsSchema,
  DateTimeInput: DateTimeInputPropsSchema,
  DeploymentProgress: DeploymentProgressPropsSchema,
  Divider: DividerPropsSchema,
  FileEditor: FileEditorPropsSchema,
  Icon: IconPropsSchema,
  Image: ImagePropsSchema,
  List: ListPropsSchema,
  Modal: ModalPropsSchema,
  MultiSelect: MultiSelectPropsSchema,
  Row: RowPropsSchema,
  Slider: SliderPropsSchema,
  Tabs: TabsPropsSchema,
  Text: TextPropsSchema,
  TextField: TextFieldPropsSchema,
  Toggle: TogglePropsSchema,
  Video: VideoPropsSchema,
};

// ---------------------------------------------------------------------------
// A2UI message schemas
// ---------------------------------------------------------------------------

const surfaceIdField = boundedStringNonEmpty;

const CreateSurfaceMessageSchema = z
  .object({
    version: z.literal("v0.9"),
    createSurface: z.object({
      surfaceId: surfaceIdField,
      catalogId: boundedString.optional(),
      theme: z.record(z.unknown()).optional(),
      sendDataModel: z.boolean().optional(),
    }),
  })
  .strip();

/** Schema for a single component within an updateComponents message. */
const ComponentEntrySchema = z.object({
  id: boundedStringNonEmpty,
  component: boundedString,
}).passthrough();

const UpdateComponentsMessageSchema = z
  .object({
    version: z.literal("v0.9"),
    updateComponents: z.object({
      surfaceId: surfaceIdField,
      components: z.array(ComponentEntrySchema).transform((arr) =>
        arr.length > PAYLOAD_LIMITS.maxComponents
          ? arr.slice(0, PAYLOAD_LIMITS.maxComponents)
          : arr,
      ),
    }),
  })
  .strip();

const UpdateDataModelMessageSchema = z
  .object({
    version: z.literal("v0.9"),
    updateDataModel: z.object({
      surfaceId: surfaceIdField,
      path: boundedStringPath,
      value: z.unknown(),
    }),
  })
  .strip();

const DeleteSurfaceMessageSchema = z
  .object({
    version: z.literal("v0.9"),
    deleteSurface: z.object({
      surfaceId: surfaceIdField,
    }),
  })
  .strip();

/**
 * Union of all A2UI v0.9 message types (nested wire format).
 * Discriminated by key presence (createSurface | updateComponents | …).
 */
export const A2UIMessageSchema = z.union([
  CreateSurfaceMessageSchema,
  UpdateComponentsMessageSchema,
  UpdateDataModelMessageSchema,
  DeleteSurfaceMessageSchema,
]);

/** Schema for an action in the actions array. */
export const ActionSchema = z
  .object({
    type: boundedStringNonEmpty,
  })
  .passthrough();
