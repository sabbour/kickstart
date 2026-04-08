/**
 * @module @kickstart/core/catalog
 *
 * TypeScript types derived from the Kickstart A2UI Catalog schema.
 * These types mirror the JSON Schema definitions in kickstart-catalog.json.
 */

// ── Base ────────────────────────────────────────────────────────────

export interface BaseComponent {
  type: string;
  id?: string;
}

// ── Basic Catalog Components ────────────────────────────────────────

export interface TextComponent extends BaseComponent {
  type: "Text";
  content: string;
  variant?: "body" | "heading" | "caption" | "code";
}

export interface ButtonComponent extends BaseComponent {
  type: "Button";
  label: string;
  action: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export interface TextFieldComponent extends BaseComponent {
  type: "TextField";
  label: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
}

export interface RowComponent extends BaseComponent {
  type: "Row";
  children: Component[];
  gap?: string;
}

export interface ColumnComponent extends BaseComponent {
  type: "Column";
  children: Component[];
  gap?: string;
}

export interface CardComponent extends BaseComponent {
  type: "Card";
  title?: string;
  children: Component[];
}

// ── Kickstart Custom Components ─────────────────────────────────────

export interface PhaseItem {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "skipped";
}

export interface ConversationPhaseComponent extends BaseComponent {
  type: "ConversationPhase";
  phases: PhaseItem[];
  currentPhase: string;
}

export interface CodeBlockComponent extends BaseComponent {
  type: "CodeBlock";
  code: string;
  language: string;
  filename?: string;
  action?: "copy" | "download";
}

export interface ResourceOption {
  label: string;
  value: string;
}

export interface ResourcePickerComponent extends BaseComponent {
  type: "ResourcePicker";
  resourceType: "subscription" | "resourceGroup" | "region" | "cluster";
  label: string;
  value?: string;
  options?: ResourceOption[];
}

export interface DeploymentStep {
  id: string;
  label: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  detail?: string;
}

export interface DeploymentProgressComponent extends BaseComponent {
  type: "DeploymentProgress";
  steps: DeploymentStep[];
  overallStatus: "pending" | "running" | "success" | "error";
}

export interface ArchitectureDiagramComponent extends BaseComponent {
  type: "ArchitectureDiagram";
  /** Mermaid diagram source code */
  mermaid: string;
}

export interface CostItem {
  name: string;
  sku: string;
  monthlyCost: number;
  currency?: string;
}

export interface CostEstimateComponent extends BaseComponent {
  type: "CostEstimate";
  items: CostItem[];
  total: number;
  currency: string;
}

export interface HandoffCardComponent extends BaseComponent {
  type: "HandoffCard";
  title: string;
  description: string;
  url: string;
  provider: "codespaces" | "vscode-dev";
  repoUrl: string;
}

// ── Union Type ──────────────────────────────────────────────────────

export type Component =
  | TextComponent
  | ButtonComponent
  | TextFieldComponent
  | RowComponent
  | ColumnComponent
  | CardComponent
  | ConversationPhaseComponent
  | CodeBlockComponent
  | ResourcePickerComponent
  | DeploymentProgressComponent
  | ArchitectureDiagramComponent
  | CostEstimateComponent
  | HandoffCardComponent;

// ── A2UI Document ───────────────────────────────────────────────────

export interface A2UIDocument {
  version: "0.9";
  root: Component;
}
