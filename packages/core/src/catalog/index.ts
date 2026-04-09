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

export interface CostItem {
  name: string;
  sku: string;
  monthlyCost: number;
}

export interface CostEstimateComponent extends BaseComponent {
  component: "CostEstimate";
  items: CostItem[];
  total: number;
  currency: string;
}

export interface ArchNode {
  id: string;
  label: string;
  type: "compute" | "database" | "cache" | "network" | "storage" | "ai" | "messaging";
}

export interface ArchEdge {
  from: string;
  to: string;
}

export interface ArchitectureDiagramComponent extends BaseComponent {
  component: "ArchitectureDiagram";
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export interface FileEditorComponent extends BaseComponent {
  component: "FileEditor";
  filename: string;
  language: string;
  content: string;
}

export interface AuthCardComponent extends BaseComponent {
  component: "AuthCard";
  provider: "azure" | "github";
  title: string;
  description?: string;
}

export interface DeploymentStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error" | "skipped";
}

export interface DeploymentProgressComponent extends BaseComponent {
  component: "DeploymentProgress";
  steps: DeploymentStep[];
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
  | DeploymentProgressComponent;

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
