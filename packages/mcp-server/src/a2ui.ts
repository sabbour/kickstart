/**
 * @module @kickstart/mcp-server/a2ui
 *
 * Helper to wrap A2UI component trees as MCP embedded resources
 * with the application/json+a2ui MIME type.
 *
 * Handles catalog negotiation per the MCP A2UI spec:
 * - Kickstart catalog → full custom components
 * - basic_catalog only → degrade to Card/Text/Button
 * - No A2UI support → text-only responses
 */

import type { A2UIDocument, Component, CardComponent, TextComponent, ColumnComponent } from "@kickstart/harness";

/** MIME type for A2UI JSON payloads in MCP embedded resources. */
export const A2UI_MIME_TYPE = "application/json+a2ui" as const;

/** Kickstart A2UI catalog identifier for MCP initialize handshake. */
export const KICKSTART_CATALOG_ID =
  "https://kickstart.aks.azure.com/catalog/v1/kickstart-catalog.json" as const;

/** Supported A2UI capability tiers for a connected client. */
export type A2UICapability = "kickstart" | "basic" | "none";

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
export function createA2UIDocument(root: Component): A2UIDocument {
  return {
    version: "0.9",
    root,
  };
}

/**
 * Degrade a custom Kickstart component to a basic Card+Text fallback.
 * Used when the client supports basic_catalog but not the Kickstart catalog.
 */
export function degradeToBasic(root: Component, title?: string): Component {
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
  root: Component,
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
