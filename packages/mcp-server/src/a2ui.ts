/**
 * @module @kickstart/mcp-server/a2ui
 *
 * Helper to wrap MCP App component trees as embedded resources with the
 * application/json+a2ui MIME type.
 *
 * The MCP App HTML surface currently renders a nested, self-contained schema
 * (`type` + nested `children`) rather than the core package's flat catalog
 * (`component` + child IDs). Keep these types local so the server and the app
 * stay in lockstep even when the shared catalog evolves independently.
 */

/** MIME type for A2UI JSON payloads in MCP embedded resources. */
export const A2UI_MIME_TYPE = "application/json+a2ui" as const;

/** Kickstart A2UI catalog identifier for MCP initialize handshake. */
export const KICKSTART_CATALOG_ID =
  "https://kickstart.aks.azure.com/catalog/v1/kickstart-catalog.json" as const;

/** Supported A2UI capability tiers for a connected client. */
export type A2UICapability = "kickstart" | "basic" | "none";

export interface BaseComponent {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface PhaseItem {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "skipped";
}

export interface TextComponent extends BaseComponent {
  type: "Text";
  text?: string;
  content?: string;
  variant?: "heading" | "h1" | "h2" | "h3" | "body" | "caption" | "code";
}

export interface RowComponent extends BaseComponent {
  type: "Row";
  children: AppComponent[];
  gap?: string;
  align?: "start" | "center" | "end" | "stretch";
  wrap?: boolean;
}

export interface ColumnComponent extends BaseComponent {
  type: "Column";
  children: AppComponent[];
  gap?: string;
  flex?: string;
}

export interface CardComponent extends BaseComponent {
  type: "Card";
  title?: string;
  subtitle?: string;
  children: AppComponent[];
}

export interface ConversationPhaseComponent extends BaseComponent {
  type: "ConversationPhase";
  phases: PhaseItem[];
  currentPhase: string | number;
}

export interface CodeBlockComponent extends BaseComponent {
  type: "CodeBlock";
  code: string;
  language?: string;
  filename?: string;
  action?: "copy";
}

export interface DeploymentStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error" | "skipped";
  detail?: string;
  duration?: string;
}

export interface DeploymentProgressComponent extends BaseComponent {
  type: "DeploymentProgress";
  steps?: DeploymentStep[];
  title?: string;
  overallStatus?: "pending" | "idle" | "running" | "complete" | "error";
  statusMessage?: string;
  appUrl?: string;
  portalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  lastUpdated?: string;
  pollIntervalMs?: number;
}

export type AppComponent =
  | TextComponent
  | RowComponent
  | ColumnComponent
  | CardComponent
  | ConversationPhaseComponent
  | CodeBlockComponent
  | DeploymentProgressComponent
  | BaseComponent;

export interface A2UIDocument {
  version: "0.9";
  root: AppComponent;
}

/**
 * Determine what level of A2UI the client supports based on the
 * catalogs it advertised during the MCP `initialize` handshake.
 *
 * @param clientCatalogs - Array of catalog IDs from the client's `initialize` params
 * @returns The highest capability tier the client supports
 */
export function resolveA2UICapability(
  clientCatalogs: readonly string[] | undefined,
): A2UICapability {
  if (!clientCatalogs || clientCatalogs.length === 0) return "none";
  if (clientCatalogs.includes(KICKSTART_CATALOG_ID)) return "kickstart";
  // Any catalog implies at least basic_catalog support
  if (clientCatalogs.length > 0) return "basic";
  return "none";
}

/**
 * Wrap an A2UI component tree into a full A2UI document.
 */
export function createA2UIDocument(root: AppComponent): A2UIDocument {
  return {
    version: "0.9",
    root,
  };
}

/**
 * Degrade a custom Kickstart component to a basic Card+Text fallback.
 * Used when the client supports basic_catalog but not the Kickstart catalog.
 */
export function degradeToBasic(root: AppComponent, title?: string): CardComponent {
  const text: TextComponent = {
    type: "Text",
    id: `${root.id ?? "degraded"}-text`,
    content: JSON.stringify(root, null, 2),
    variant: "code",
  };
  const card: CardComponent = {
    type: "Card",
    id: `${root.id ?? "degraded"}-card`,
    title: title ?? root.type,
    children: [text],
  };
  return card;
}

/**
 * Create an MCP embedded resource containing an A2UI document.
 *
 * @param root - The root A2UI component
 * @param uri - Resource URI (e.g., "a2ui://kickstart/conversation-phase")
 * @param capability - Client's A2UI capability tier
 * @returns MCP EmbeddedResource object, or null if the client has no A2UI support
 */
export function createA2UIResource(
  root: AppComponent,
  uri: string,
  capability: A2UICapability = "kickstart",
): { type: "resource"; resource: { uri: string; mimeType: string; text: string } } | null {
  if (capability === "none") return null;

  const effectiveRoot = capability === "basic" ? degradeToBasic(root) : root;
  const doc = createA2UIDocument(effectiveRoot);
  return {
    type: "resource",
    resource: {
      uri,
      mimeType: A2UI_MIME_TYPE,
      text: JSON.stringify(doc, null, 2),
    },
  };
}
