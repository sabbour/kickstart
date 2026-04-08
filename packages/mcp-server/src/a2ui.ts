/**
 * @module @kickstart/mcp-server/a2ui
 *
 * Helper to wrap A2UI component trees as MCP embedded resources
 * with the application/json+a2ui MIME type.
 */

import type { A2UIDocument, Component } from "@kickstart/core";

/** MIME type for A2UI JSON payloads in MCP embedded resources. */
export const A2UI_MIME_TYPE = "application/json+a2ui" as const;

/**
 * Wrap an A2UI component tree into a full A2UI document.
 *
 * @param root - The root component of the UI tree
 * @returns A complete A2UI v0.9 document
 */
export function createA2UIDocument(root: Component): A2UIDocument {
  return {
    version: "0.9",
    root,
  };
}

/**
 * Create an MCP embedded resource containing an A2UI document.
 *
 * Used when returning tool results that include UI components.
 * The MCP client should detect the MIME type and render the A2UI tree.
 *
 * @param root - The root A2UI component
 * @param uri - Resource URI (e.g., "a2ui://kickstart/conversation-phase")
 * @returns MCP EmbeddedResource object
 */
export function createA2UIResource(
  root: Component,
  uri: string,
): { type: "resource"; resource: { uri: string; mimeType: string; text: string } } {
  const doc = createA2UIDocument(root);
  return {
    type: "resource",
    resource: {
      uri,
      mimeType: A2UI_MIME_TYPE,
      text: JSON.stringify(doc, null, 2),
    },
  };
}
