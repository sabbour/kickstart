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
// Known component types (46)
// ---------------------------------------------------------------------------

export const KNOWN_COMPONENT_TYPES = new Set([
  "Accordion",
  "Alert",
  "ArchitectureDiagram",
  "AudioPlayer",
  "AuthCard",
  "AzureAction",
  "AzureLoginCard",
  "AzureResourceForm",
  "AzureResourcePicker",
  "Badge",
  "Button",
  "Card",
  "CheckBox",
  "ChoicePicker",
  "CodeBlock",
  "Column",
  "ComboBox",
  "CostEstimate",
  "DateTimeInput",
  "GenerationProgress",
  "Divider",
  "FileEditor",
  "FormGroup",
  "GitHubAction",
  "GitHubCommit",
  "GitHubLoginCard",
  "GitHubRepoPicker",
  "Icon",
  "Image",
  "Link",
  "List",
  "Markdown",
  "Modal",
  "MultiSelect",
  "ProgressSteps",
  "Questionnaire",
  "RadioGroup",
  "Row",
  "Slider",
  "SteppedCarousel",
  "Tabs",
  "Table",
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
const dynamicString = z.union([boundedString, z.record(z.string(), z.unknown())]);

const actionSchema = z
  .object({
    event: z.object({
      name: z.string(),
      data: z.record(z.string(), z.unknown()).optional(),
      context: z.record(z.string(), z.unknown()).optional(),
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
  .strip()
  .refine((data) => data.child !== undefined || data.label !== undefined, {
    message: "Button must have at least one of 'child' or 'label'",
  });

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

const CostEstimateSkuOptionSchema = z.object({
  label: dynamicString,
  value: dynamicString,
  monthlyEstimate: z.number(),
});

const CostEstimatePricingTierSchema = z.object({
  label: dynamicString,
  monthlyEstimate: z.number(),
});

const CostEstimateResourcePricingModelSchema = z.enum([
  "monthly",
  "usage",
  "included",
]);

const CostEstimateResourceSchema = z.object({
  name: dynamicString,
  sku: dynamicString.optional(),
  monthlyEstimate: z.number(),
  pricingModel: CostEstimateResourcePricingModelSchema.optional(),
  unitPrice: z.number().optional(),
  unitOfMeasure: dynamicString.optional(),
  skuOptions: z.array(CostEstimateSkuOptionSchema).optional(),
  pricingTiers: z.array(CostEstimatePricingTierSchema).optional(),
});

const LegacyCostEstimateItemSchema = z.object({
  name: dynamicString,
  sku: dynamicString.optional(),
  monthlyCost: z.number(),
});

const CostEstimatePricingKindSchema = z.enum([
  "aksAutomaticControlPlane",
  "aksAutomaticSystemNodes",
  "aksAutomaticWorkloadCompute",
  "appRouting",
  "containerRegistry",
  "storage",
  "azureOpenAI",
]);

const CostEstimatePricingLineItemSchema = z.object({
  id: boundedString,
  kind: CostEstimatePricingKindSchema,
  name: dynamicString.optional(),
  sku: dynamicString.optional(),
  quantity: z.number().int().positive().max(100).optional(),
});

const CostEstimatePricingRequestSchema = z.object({
  region: dynamicString,
  lineItems: z.array(CostEstimatePricingLineItemSchema).min(1).max(12),
});

const CostEstimateLoadingStateSchema = z.object({
  supported: z.boolean(),
  state: z.enum(["idle", "loading", "ready"]).optional(),
  message: dynamicString.optional(),
});

const CostEstimateCacheMetadataSchema = z.object({
  status: z.enum(["miss", "hit", "stale"]),
  updatedAt: dynamicString.optional(),
  expiresAt: dynamicString.optional(),
});

const CostEstimateFallbackMetadataSchema = z.object({
  used: z.boolean(),
  reason: z.enum(["live_pricing_unavailable", "unsupported_request"]).optional(),
  message: dynamicString.optional(),
});

const CostEstimateSourceSchema = z.enum(["live", "estimated", "stub"]);

const CostEstimateFallbackSchema = z.union([
  z.boolean(),
  CostEstimateFallbackMetadataSchema,
]);

const CostEstimatePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("CostEstimate"),
    resources: z.array(CostEstimateResourceSchema).optional(),
    items: z.array(LegacyCostEstimateItemSchema).optional(),
    monthlyEstimate: z.number().optional(),
    total: z.number().optional(),
    currency: dynamicString.optional(),
    title: dynamicString.optional(),
    projectionMonths: z.number().optional(),
    showProjectionSlider: z.boolean().optional(),
    source: CostEstimateSourceSchema.optional(),
    citation: dynamicString.optional(),
    loading: CostEstimateLoadingStateSchema.optional(),
    cache: CostEstimateCacheMetadataSchema.optional(),
    fallback: CostEstimateFallbackSchema.optional(),
    pricingRequest: CostEstimatePricingRequestSchema.optional(),
    estimatedAt: dynamicString.optional(),
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
  ]).optional(),
});

const ArchEdgeSchema = z.object({
  from: boundedString,
  to: boundedString,
  label: dynamicString.optional(),
});

const ArchitectureDiagramPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("ArchitectureDiagram"),
    diagram: dynamicString.optional(),
    title: dynamicString.optional(),
    description: dynamicString.optional(),
    nodes: z.array(ArchNodeSchema).optional(),
    edges: z.array(ArchEdgeSchema).optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    const hasDiagram =
      typeof value.diagram === "string" && value.diagram.trim().length > 0;
    const hasLegacyNodes =
      Array.isArray(value.nodes) && Array.isArray(value.edges);

    if (!hasDiagram && !hasLegacyNodes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "ArchitectureDiagram requires `diagram` or both `nodes` and `edges`.",
      });
    }
  });

const FileEditorEntrySchema = z
  .object({
    filename: dynamicString.optional(),
    path: dynamicString.optional(),
    language: dynamicString.optional(),
    content: dynamicString.optional(),
    artifactPath: dynamicString.optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    if (!value.filename && !value.path && !value.artifactPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FileEditor entries require filename, path, or artifactPath.",
      });
    }
  });

const FileEditorPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("FileEditor"),
    filename: dynamicString.optional(),
    path: dynamicString.optional(),
    language: dynamicString.optional(),
    content: dynamicString.optional(),
    artifactPath: dynamicString.optional(),
    files: z.array(FileEditorEntrySchema).optional(),
    readOnly: z.boolean().optional(),
  })
  .strip()
  .superRefine((value, ctx) => {
    if (Array.isArray(value.files) && value.files.length > 0) {
      return;
    }

    if (!value.filename && !value.path && !value.artifactPath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "FileEditor requires filename, path, artifactPath, or files.",
        path: ["filename"],
      });
    }
  });

const AuthCardPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AuthCard"),
    provider: z.enum(["azure", "github"]),
    title: dynamicString.optional(),
    description: dynamicString.optional(),
  })
  .strip();

const GenerationStepSchema = z.object({
  id: boundedString,
  label: dynamicString,
  status: z.enum(["pending", "running", "complete", "error", "skipped"]),
  detail: dynamicString.optional(),
  timestamp: dynamicString.optional(),
});

const GenerationProgressPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("GenerationProgress"),
    steps: z.array(GenerationStepSchema).optional(),
    title: dynamicString.optional(),
    overallStatus: z.enum(["idle", "running", "complete", "error"]).optional(),
    runId: dynamicString.optional(),
    statusMessage: dynamicString.optional(),
    appUrl: dynamicString.optional(),
    portalUrl: dynamicString.optional(),
    errorCode: dynamicString.optional(),
    errorMessage: dynamicString.optional(),
    lastUpdated: dynamicString.optional(),
    pollIntervalMs: z.number().int().positive().optional(),
  })
  .strip();

// Basic catalog components (missing from original set)

const AlertPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Alert"),
    message: dynamicString,
    severity: z.enum(["info", "warning", "error", "success"]).optional(),
    dismissible: z.boolean().optional(),
    action: actionSchema.optional(),
  })
  .strip();

const LinkPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Link"),
    text: dynamicString,
    url: dynamicString,
    external: z.boolean().optional(),
  })
  .strip();

const TablePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Table"),
    columns: z.array(dynamicString),
    rows: z.array(z.array(dynamicString)).optional(),
    caption: dynamicString.optional(),
  })
  .strip();

// Custom Kickstart components (missing from original set)

const MarkdownPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Markdown"),
    content: dynamicString,
  })
  .strip();

const CodeBlockPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("CodeBlock"),
    code: dynamicString,
    language: dynamicString.optional(),
    filename: dynamicString.optional(),
  })
  .strip();

const ProgressStepsPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("ProgressSteps"),
    steps: z.array(
      z.object({
        id: boundedString,
        label: dynamicString,
        status: z.enum(["pending", "active", "complete", "error"]),
      }),
    ),
  })
  .strip();

const RadioGroupPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("RadioGroup"),
    options: z.array(
      z.object({
        id: boundedString,
        label: dynamicString,
        description: dynamicString.optional(),
        recommended: z.boolean().optional(),
      }),
    ),
    value: dynamicString.optional(),
    action: actionSchema,
  })
  .strip();

const FormGroupPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("FormGroup"),
    title: dynamicString,
    step: z.number().optional(),
    child: boundedString,
  })
  .strip();

const GitHubLoginCardPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("GitHubLoginCard"),
    username: dynamicString.optional(),
    avatarUrl: dynamicString.optional(),
    onSignIn: actionSchema.optional(),
    onSignOut: actionSchema.optional(),
  })
  .strip();

const GitHubRepoPickerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("GitHubRepoPicker"),
    placeholder: dynamicString.optional(),
    owner: dynamicString.optional(),
    selectedRepo: dynamicString.optional(),
    suggestedName: dynamicString.optional(),
    allowCreate: z.boolean().optional(),
    onSelect: actionSchema.optional(),
  })
  .strip();

const GitHubActionPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("GitHubAction"),
    title: dynamicString,
    description: dynamicString.optional(),
    method: z.enum(["POST", "PUT", "PATCH", "DELETE"]),
    path: dynamicString,
    operationType: dynamicString,
    body: z.record(z.string(), z.unknown()).optional(),
    confirmLabel: dynamicString.optional(),
    onSuccess: actionSchema.optional(),
    onError: actionSchema.optional(),
  })
  .strip();

const GitHubCommitPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("GitHubCommit"),
    repoFullName: dynamicString.optional(),
    defaultBranch: dynamicString.optional(),
    suggestedBranchName: dynamicString.optional(),
    suggestedTitle: dynamicString.optional(),
    suggestedBody: dynamicString.optional(),
    onSuccess: actionSchema.optional(),
    onError: actionSchema.optional(),
  })
  .strip();

const AzureLoginCardPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AzureLoginCard"),
    displayName: dynamicString.optional(),
    showTokenInfo: z.boolean().optional(),
    onSignIn: actionSchema.optional(),
    onSignOut: actionSchema.optional(),
  })
  .strip();

const AzureResourcePickerPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AzureResourcePicker"),
    subscriptionId: dynamicString.optional(),
    resourceGroup: dynamicString.optional(),
    resourceType: dynamicString.optional(),
    label: dynamicString.optional(),
    onSelect: actionSchema.optional(),
  })
  .strip();

const AzureResourceFormPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AzureResourceForm"),
    title: dynamicString.optional(),
    subscriptionId: dynamicString.optional(),
    resourceGroup: dynamicString.optional(),
    resourceType: dynamicString.optional(),
    apiVersion: dynamicString.optional(),
  })
  .strip();

const AzureActionPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("AzureAction"),
    title: dynamicString,
    description: dynamicString.optional(),
    method: z.enum(["PUT", "POST", "PATCH", "DELETE"]),
    path: dynamicString,
    body: z.record(z.string(), z.unknown()).optional(),
    apiVersion: dynamicString.optional(),
    confirmLabel: dynamicString.optional(),
    onSuccess: actionSchema.optional(),
    onError: actionSchema.optional(),
  })
  .strip();

const SteppedCarouselStepSchema = z.object({
  title: dynamicString,
  child: boundedString,
});

const SteppedCarouselPropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("SteppedCarousel"),
    steps: z.array(SteppedCarouselStepSchema),
    activeStep: z.number().optional(),
  })
  .strip();

const QuestionDefSchema = z.object({
  id: boundedString,
  label: dynamicString,
  type: z.enum(["text", "choice", "multiChoice"]).optional(),
  choices: z
    .array(z.object({ id: boundedString, label: dynamicString }))
    .optional(),
  required: z.boolean().optional(),
});

const QuestionnairePropsSchema = z
  .object({
    id: boundedString,
    component: z.literal("Questionnaire"),
    questions: z.array(QuestionDefSchema),
    submitLabel: dynamicString.optional(),
    onSubmit: actionSchema.optional(),
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
  Alert: AlertPropsSchema,
  ArchitectureDiagram: ArchitectureDiagramPropsSchema,
  AudioPlayer: AudioPlayerPropsSchema,
  AuthCard: AuthCardPropsSchema,
  AzureAction: AzureActionPropsSchema,
  AzureLoginCard: AzureLoginCardPropsSchema,
  AzureResourceForm: AzureResourceFormPropsSchema,
  AzureResourcePicker: AzureResourcePickerPropsSchema,
  Badge: BadgePropsSchema,
  Button: ButtonPropsSchema,
  Card: CardPropsSchema,
  CheckBox: CheckBoxPropsSchema,
  ChoicePicker: ChoicePickerPropsSchema,
  CodeBlock: CodeBlockPropsSchema,
  Column: ColumnPropsSchema,
  ComboBox: ComboBoxPropsSchema,
  CostEstimate: CostEstimatePropsSchema,
  DateTimeInput: DateTimeInputPropsSchema,
  GenerationProgress: GenerationProgressPropsSchema,
  Divider: DividerPropsSchema,
  FileEditor: FileEditorPropsSchema,
  FormGroup: FormGroupPropsSchema,
  GitHubAction: GitHubActionPropsSchema,
  GitHubCommit: GitHubCommitPropsSchema,
  GitHubLoginCard: GitHubLoginCardPropsSchema,
  GitHubRepoPicker: GitHubRepoPickerPropsSchema,
  Icon: IconPropsSchema,
  Image: ImagePropsSchema,
  Link: LinkPropsSchema,
  List: ListPropsSchema,
  Markdown: MarkdownPropsSchema,
  Modal: ModalPropsSchema,
  MultiSelect: MultiSelectPropsSchema,
  ProgressSteps: ProgressStepsPropsSchema,
  Questionnaire: QuestionnairePropsSchema,
  RadioGroup: RadioGroupPropsSchema,
  Row: RowPropsSchema,
  Slider: SliderPropsSchema,
  SteppedCarousel: SteppedCarouselPropsSchema,
  Tabs: TabsPropsSchema,
  Table: TablePropsSchema,
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
      theme: z.record(z.string(), z.unknown()).optional(),
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
