/**
 * @module @kickstart/core/kits/types
 *
 * IntegrationKit — a composable bundle of tools, connectors, prompts, and
 * optional component registrations.  Kits are the canonical unit for
 * extending Kickstart with a new integration target (e.g. Azure, GitHub).
 *
 * ServicePack extensions (issue #30) add:
 *   - Declarative auth requirements
 *   - Kit-to-kit dependency declarations
 *   - Async lifecycle hooks (onActivate / onDeactivate)
 *
 * Usage:
 *   const myKit: IntegrationKit = { name: 'my-kit', ... };
 *   await registerKit(myKit);
 */

import type { Tool } from '../tools/types.js';
import type { APIConnector } from '../connectors/types.js';
import type { Phase } from '../engine/types.js';
import type { ComponentCategory } from '../prompts/component-catalog.js';

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
  /**
   * Optional prompt metadata -- when present, the component is included
   * in the dynamically generated A2UI component catalog.
   */
  promptMeta?: {
    /** Category grouping for the prompt catalog */
    category: ComponentCategory;
    /** JSON example string shown to the LLM */
    example: string;
    /** Optional notes appended after the example */
    notes?: string;
  };
}

/**
 * Declarative auth requirement for a kit. The web layer reads these to
 * determine which auth providers must be configured before the kit is
 * fully functional.  Core never performs actual auth — it only declares
 * what is needed.
 */
export interface KitAuthRequirement {
  /** Auth provider identifier, e.g. 'azure-msal', 'github-oauth' */
  provider: string;
  /** OAuth scopes or permission strings required */
  scopes: string[];
  /** If true, the kit can function (degraded) without this auth */
  optional?: boolean;
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
 * - **auth** — Declarative auth requirements (web layer uses these to
 *   wire up auth providers).
 * - **dependencies** — Names of kits that must be registered before this one.
 * - **onActivate / onDeactivate** — Lifecycle hooks for setup/teardown.
 *
 * ## Trust Model
 *
 * Kits are trusted first-party code. No sandboxing is applied — lifecycle
 * hooks (`onActivate`, `onDeactivate`) and tool `execute` functions run
 * with full process privileges. If third-party kits are needed in the
 * future, implement capability restrictions and sandboxing before allowing
 * untrusted code to register as a kit.
 */
export interface IntegrationKit {
  /** Unique kit identifier, e.g. 'azure', 'github' */
  name: string;
  /** Human-readable summary of what this kit provides */
  description: string;
  /** Tools this kit contributes to the LLM tool registry */
  tools: Tool<any>[];
  /** Authenticated API connectors this kit contributes */
  connectors: APIConnector[];
  /**
   * Optional flat system-prompt augmentations.  These are injected for all
   * phases (or filtered by keyword heuristics in the skill resolver when
   * `phasePrompts` is not set).  Use `phasePrompts` for explicit phase
   * targeting.
   */
  prompts?: string[];
  /**
   * Optional per-phase system-prompt augmentations.  When present for a
   * given phase, these take priority over the flat `prompts` array.
   * Keys are Phase enum values; values are arrays of prompt strings.
   */
  phasePrompts?: Partial<Record<Phase, string[]>>;
  /** Optional A2UI component registrations (frontend-only) */
  components?: ComponentRegistration[];

  /**
   * Typed skill definitions — structured domain knowledge injected per-phase.
   * When present, skills are resolved alongside (not replacing) `phasePrompts`
   * and flat `prompts`.  Skills provide keyword-based activation, priority
   * ordering, and per-phase filtering.
   */
  skills?: import("../engine/types.js").Skill[];

  // ── ServicePack extensions (issue #30) ───────────────────────────────

  /** Declarative auth requirements — web layer uses these to wire providers */
  auth?: KitAuthRequirement[];
  /** Names of kits that must be registered before this kit */
  dependencies?: string[];
  /** Called after the kit is registered and all deps are validated */
  onActivate?: () => Promise<void>;
  /** Called before the kit is removed from the registry */
  onDeactivate?: () => Promise<void>;
}
