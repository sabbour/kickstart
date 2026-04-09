/**
 * @module @kickstart/core/kits/types
 *
 * IntegrationKit — a composable bundle of tools, connectors, prompts, and
 * optional component registrations.  Kits are the canonical unit for
 * extending Kickstart with a new integration target (e.g. Azure, GitHub).
 *
 * Usage:
 *   const myKit: IntegrationKit = { name: 'my-kit', ... };
 *   registerKit(myKit);
 */

import type { Tool } from '../tools/types.js';
import type { APIConnector } from '../connectors/types.js';

/**
 * A lightweight descriptor for a UI component contributed by a kit.
 * The actual React component binding lives in the web package — core only
 * records the type identifier and a human-readable description so the
 * surface layer can look them up by name.
 */
export interface ComponentRegistration {
  /** A2UI component type identifier, e.g. 'azureLoginCard' */
  type: string;
  /** Human-readable description of what this component renders */
  description: string;
}

/**
 * An IntegrationKit bundles everything needed to add a new integration
 * surface into Kickstart:
 *
 * - **tools** — LLM-callable functions this kit provides (auto-registered
 *   into ToolRegistry on `registerKit`).
 * - **connectors** — Authenticated API clients (auto-registered into
 *   APIConnectorRegistry on `registerKit`).
 * - **prompts** — Optional system-prompt augmentations.  Each string is
 *   appended to the active phase's system prompt when this kit is loaded.
 * - **components** — Optional A2UI component type registrations
 *   (frontend-only; core records names, web layer binds React components).
 */
export interface IntegrationKit {
  /** Unique kit identifier, e.g. 'azure', 'github' */
  name: string;
  /** Human-readable summary of what this kit provides */
  description: string;
  /** Tools this kit contributes to the LLM tool registry */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: Tool<any>[];
  /** Authenticated API connectors this kit contributes */
  connectors: APIConnector[];
  /** Optional system-prompt augmentations injected per phase */
  prompts?: string[];
  /** Optional A2UI component registrations (frontend-only) */
  components?: ComponentRegistration[];
}
