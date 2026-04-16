/**
 * @module @kickstart/core/catalog
 *
 * TypeScript types for the Kickstart A2UI v0.9 catalog.
 * Components use flat adjacency lists: each component has an "id" and
 * references children by id via "children" (array) or "child" (single).
 */

// ── Base ────────────────────────────────────────────────────────────

export interface BaseComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

// ── Basic Catalog Components (18) ──────────────────────────────────

export interface TextComponent extends BaseComponent {
  component: "Text";
  text: string;
  variant?: "h1" | "h2" | "h3" | "body" | "caption" | "code";
}

export interface ImageComponent extends BaseComponent {
  component: "Image";
  src: string;
  alt: string;
}

export interface IconComponent extends BaseComponent {
  component: "Icon";
  name: string;
  size?: string;
}

export interface VideoComponent extends BaseComponent {
  component: "Video";
  src: string;
}

export interface AudioPlayerComponent extends BaseComponent {
  component: "AudioPlayer";
  src: string;
}

export interface RowComponent extends BaseComponent {
  component: "Row";
  children: string[];
  gap?: string;
  justify?: "start" | "center" | "end" | "spaceBetween" | "spaceAround";
  align?: "start" | "center" | "end" | "stretch";
  wrap?: boolean;
}

export interface ColumnComponent extends BaseComponent {
  component: "Column";
  children: string[];
  gap?: string;
}

export interface ListComponent extends BaseComponent {
  component: "List";
  children: string[];
  ordered?: boolean;
}

export interface CardComponent extends BaseComponent {
  component: "Card";
  children: string[];
}

export interface TabDef {
  label: string;
  children: string[];
}

export interface TabsComponent extends BaseComponent {
  component: "Tabs";
  tabs: TabDef[];
}

export interface DividerComponent extends BaseComponent {
  component: "Divider";
}

export interface ModalComponent extends BaseComponent {
  component: "Modal";
  child: string;
  title: string;
  open?: boolean;
}

export interface ButtonAction {
  event: {
    name: string;
    data?: Record<string, unknown>;
  };
}

export interface ButtonComponent extends BaseComponent {
  component: "Button";
  child: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  disabled?: boolean;
  action: ButtonAction;
}

export interface TextFieldComponent extends BaseComponent {
  component: "TextField";
  label: string;
  placeholder?: string;
  value?: string;
  action?: { event: { name: string } };
}

export interface CheckBoxComponent extends BaseComponent {
  component: "CheckBox";
  label: string;
  checked?: boolean;
  action?: { event: { name: string } };
}

export interface ChoiceOption {
  label: string;
  value: string;
}

export interface ChoicePickerComponent extends BaseComponent {
  component: "ChoicePicker";
  label: string;
  options: ChoiceOption[];
  action?: { event: { name: string } };
}

export interface SliderComponent extends BaseComponent {
  component: "Slider";
  label: string;
  min: number;
  max: number;
  value?: number;
  action?: { event: { name: string } };
}

export interface DateTimeInputComponent extends BaseComponent {
  component: "DateTimeInput";
  label: string;
  value?: string;
}

// ── Custom Kickstart Components (5) ─────────────────────────────────

export interface CostEstimateSkuOption {
  label: string;
  value: string;
  monthlyEstimate: number;
}

export interface CostEstimatePricingTier {
  label: string;
  monthlyEstimate: number;
}

export type CostEstimatePricingKind =
  | "aksAutomaticControlPlane"
  | "aksAutomaticSystemNodes"
  | "aksAutomaticWorkloadCompute"
  | "appRouting"
  | "containerRegistry"
  | "storage"
  | "azureOpenAI";

export type CostEstimateResourcePricingModel = "monthly" | "usage" | "included";

export interface CostEstimateResource {
  name: string;
  sku?: string;
  monthlyEstimate: number;
  pricingModel?: CostEstimateResourcePricingModel;
  unitPrice?: number;
  unitOfMeasure?: string;
  skuOptions?: CostEstimateSkuOption[];
  pricingTiers?: CostEstimatePricingTier[];
}

export interface CostEstimatePricingLineItem {
  id: string;
  kind: CostEstimatePricingKind;
  name?: string;
  sku?: string;
  quantity?: number;
}

export interface CostEstimatePricingRequest {
  region: string;
  lineItems: CostEstimatePricingLineItem[];
}

/** Backward-compatible alias for older CostEstimate item naming. */
export type CostItem = CostEstimateResource;

export interface CostEstimateLoadingState {
  supported: boolean;
  state?: "idle" | "loading" | "ready";
  message?: string;
}

export interface CostEstimateCacheMetadata {
  status: "miss" | "hit" | "stale";
  updatedAt?: string;
  expiresAt?: string;
}

export interface CostEstimateFallbackMetadata {
  used: boolean;
  reason?: "live_pricing_unavailable" | "unsupported_request";
  message?: string;
}

export interface CostEstimateProps {
  resources: CostEstimateResource[];
  monthlyEstimate?: number;
  total?: number;
  currency?: string;
  title?: string;
  projectionMonths?: number;
  showProjectionSlider?: boolean;
  source?: "live" | "estimated";
  citation?: string;
  loading?: CostEstimateLoadingState;
  cache?: CostEstimateCacheMetadata;
  fallback?: CostEstimateFallbackMetadata;
  pricingRequest?: CostEstimatePricingRequest;
  estimatedAt?: string;
}

export interface CostEstimateComponent extends BaseComponent, CostEstimateProps {
  component: "CostEstimate";
}

export interface ArchNode {
  id: string;
  label: string;
  type?: "compute" | "database" | "cache" | "network" | "storage" | "ai" | "messaging";
}

export interface ArchEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ArchitectureDiagramComponent extends BaseComponent {
  component: "ArchitectureDiagram";
  diagram?: string;
  title?: string;
  description?: string;
  nodes?: ArchNode[];
  edges?: ArchEdge[];
}

export interface FileEditorFileEntry {
  filename?: string;
  path?: string;
  language?: string;
  content?: string;
  artifactPath?: string;
}

export interface FileEditorComponent extends BaseComponent {
  component: "FileEditor";
  filename?: string;
  path?: string;
  language?: string;
  content?: string;
  artifactPath?: string;
  files?: FileEditorFileEntry[];
  readOnly?: boolean;
}

export interface AuthCardComponent extends BaseComponent {
  component: "AuthCard";
  provider: "azure" | "github";
  title?: string;
  description?: string;
}

export interface GenerationStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error" | "skipped";
  detail?: string;
  timestamp?: string;
}

export interface GenerationProgressComponent extends BaseComponent {
  component: "GenerationProgress";
  steps?: GenerationStep[];
  title?: string;
  overallStatus?: "idle" | "running" | "complete" | "error";
  runId?: string;
  statusMessage?: string;
  appUrl?: string;
  portalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  lastUpdated?: string;
  pollIntervalMs?: number;
}

// ── New Fluent Components (5) — Issue #18 ───────────────────────────

export interface BadgeComponent extends BaseComponent {
  component: "Badge";
  text?: string;
  color?: "brand" | "danger" | "important" | "informative" | "severe" | "subtle" | "success" | "warning";
  shape?: "circular" | "rounded" | "square";
  size?: "tiny" | "small" | "medium" | "large" | "extra-large";
  appearance?: "filled" | "ghost" | "outline" | "tint";
  variant?: "badge" | "counter" | "presence";
  count?: number;
  status?: "available" | "away" | "busy" | "do-not-disturb" | "offline" | "out-of-office" | "unknown";
}

export interface AccordionItemDef {
  title: string;
  children: string[];
}

export interface AccordionComponent extends BaseComponent {
  component: "Accordion";
  items: AccordionItemDef[];
  collapsible?: boolean;
  multiple?: boolean;
}

export interface ToggleComponent extends BaseComponent {
  component: "Toggle";
  label?: string;
  checked?: boolean;
  disabled?: boolean;
}

export interface ComboBoxOption {
  text: string;
  value: string;
}

export interface ComboBoxComponent extends BaseComponent {
  component: "ComboBox";
  label?: string;
  options: ComboBoxOption[];
  placeholder?: string;
  allowCustom?: boolean;
  value?: string;
}

export interface MultiSelectComponent extends BaseComponent {
  component: "MultiSelect";
  label?: string;
  options: ComboBoxOption[];
  placeholder?: string;
  selectedValues?: string[];
}

// ── Union Type ──────────────────────────────────────────────────────

export type Component =
  | TextComponent
  | ImageComponent
  | IconComponent
  | VideoComponent
  | AudioPlayerComponent
  | RowComponent
  | ColumnComponent
  | ListComponent
  | CardComponent
  | TabsComponent
  | DividerComponent
  | ModalComponent
  | ButtonComponent
  | TextFieldComponent
  | CheckBoxComponent
  | ChoicePickerComponent
  | SliderComponent
  | DateTimeInputComponent
  | CostEstimateComponent
  | ArchitectureDiagramComponent
  | FileEditorComponent
  | AuthCardComponent
  | GenerationProgressComponent
  | BadgeComponent
  | AccordionComponent
  | ToggleComponent
  | ComboBoxComponent
  | MultiSelectComponent;

// ── A2UI v0.9 Document ──────────────────────────────────────────────

export interface A2UIDocument {
  version: "0.9";
  root: Component;
}

// ── Legacy re-exports for backward compat ───────────────────────────

/** @deprecated Use ChoiceOption instead */
export type ResourceOption = ChoiceOption;

/** @deprecated Phase indicator is now handled via the JSON envelope */
export interface PhaseItem {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "skipped";
}
