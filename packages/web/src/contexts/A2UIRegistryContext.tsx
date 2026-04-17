/**
 * A2UIRegistryContext — client-side component registry for the A2UI renderer.
 *
 * Bootstrap ordering (Phase A, DP Step 10):
 *   1. Import clientRegistry in main.tsx
 *   2. Call clientRegistry.register(impl) for every pack component (synchronous)
 *   3. Call clientRegistry.seal() — freezes the Map as ReadonlyMap
 *   4. ReactDOM.createRoot(…).render(<App />) — only then mount
 *
 * useA2UIRegistry() throws if called before seal().
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { Catalog } from '../vendor/a2ui/web_core/catalog/types';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { BASIC_FUNCTIONS } from '../vendor/a2ui/web_core/basic_catalog/index';
import { MessageBar, MessageBarBody } from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Prop-safety constants (Zapp B4)
// ---------------------------------------------------------------------------

export const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
export const URL_PROP_KEYS = new Set(['href', 'src', 'action', 'formAction']);
export const MAX_PROP_DEPTH = 5;
export const MAX_PROP_BYTES = 64 * 1024;

// ---------------------------------------------------------------------------
// Catalog ID
// ---------------------------------------------------------------------------

export const KICKSTART_CATALOG_ID = 'kickstart/v2';

// ---------------------------------------------------------------------------
// Error renderer (unknown component → visible error, no raw prop forwarding)
// ---------------------------------------------------------------------------

const _ErrorComponentImpl: ReactComponentImplementation = {
  name: '_ErrorComponent',
  schema: {} as ReactComponentImplementation['schema'],
  render: ({ context }) => {
    const compName = (context as unknown as { componentModel?: { type?: string } })
      ?.componentModel?.type ?? 'unknown';
    return (
      <MessageBar intent="error">
        <MessageBarBody>Component not available: {compName}</MessageBarBody>
      </MessageBar>
    );
  },
};

// ---------------------------------------------------------------------------
// ClientComponentRegistry
// ---------------------------------------------------------------------------

export class ClientComponentRegistry {
  private readonly _impls = new Map<string, ReactComponentImplementation>();
  private _sealed = false;
  private _frozenImpls: ReadonlyMap<string, ReactComponentImplementation> | null = null;

  /** Register a component renderer. Must be called before seal(). */
  register(impl: ReactComponentImplementation): void {
    if (this._sealed) {
      throw new Error(
        `[A2UIRegistry] Registry is already sealed — cannot register "${impl.name}" after seal().`,
      );
    }
    if (impl.name && impl.name !== '_ErrorComponent') {
      this._impls.set(impl.name, impl);
    }
  }

  /**
   * Seal the registry. After sealing:
   * - No new registrations are accepted
   * - The internal map is frozen as a ReadonlyMap snapshot
   * - buildCatalog() and getImpl() become available
   */
  seal(): void {
    // Register the error fallback under its internal name
    this._impls.set('_ErrorComponent', _ErrorComponentImpl);
    this._frozenImpls = Object.freeze(new Map(this._impls)) as ReadonlyMap<
      string,
      ReactComponentImplementation
    >;
    this._sealed = true;
    Object.freeze(this._impls);
  }

  get isSealed(): boolean {
    return this._sealed;
  }

  /**
   * Look up a renderer by component name.
   * Throws if called before seal() (Phase A safety invariant).
   */
  getImpl(name: string): ReactComponentImplementation | undefined {
    if (!this._sealed) {
      throw new Error(
        '[A2UIRegistry] getImpl() called before seal(). Call registry.seal() before ReactDOM.render().',
      );
    }
    return this._frozenImpls!.get(name);
  }

  /** List of all registered component names (post-seal). */
  getNames(): string[] {
    if (!this._sealed) {
      throw new Error('[A2UIRegistry] getNames() called before seal().');
    }
    return [...this._frozenImpls!.keys()].filter(n => n !== '_ErrorComponent');
  }

  /**
   * Build an A2UI Catalog from the sealed registry.
   * Pass the returned Catalog to MessageProcessor.
   */
  buildCatalog(): Catalog<ReactComponentImplementation> {
    if (!this._sealed) {
      throw new Error('[A2UIRegistry] buildCatalog() called before seal().');
    }
    return new Catalog<ReactComponentImplementation>(
      KICKSTART_CATALOG_ID,
      [...this._frozenImpls!.values()],
      BASIC_FUNCTIONS,
    );
  }
}

// Module-level singleton — populated in main.tsx before React mounts.
export const clientRegistry = new ClientComponentRegistry();

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

interface A2UIRegistryContextValue {
  readonly registry: ClientComponentRegistry;
}

const A2UIRegistryContext = createContext<A2UIRegistryContextValue | null>(null);

export function A2UIRegistryProvider({ children }: { children: ReactNode }) {
  if (!clientRegistry.isSealed) {
    throw new Error(
      '[A2UIRegistry] A2UIRegistryProvider mounted before registry.seal(). ' +
        'Ensure registry.seal() is called in main.tsx before ReactDOM.render().',
    );
  }
  return (
    <A2UIRegistryContext.Provider value={{ registry: clientRegistry }}>
      {children}
    </A2UIRegistryContext.Provider>
  );
}

/**
 * Returns the sealed component registry.
 * Throws if called before seal() — enforces the Phase A bootstrap invariant.
 */
export function useA2UIRegistry(): ClientComponentRegistry {
  const ctx = useContext(A2UIRegistryContext);
  if (!ctx) {
    if (!clientRegistry.isSealed) {
      throw new Error(
        '[A2UIRegistry] useA2UIRegistry() called before seal(). ' +
          'Ensure registry.seal() is called in main.tsx before ReactDOM.render().',
      );
    }
    throw new Error('useA2UIRegistry must be used within an <A2UIRegistryProvider>');
  }
  return ctx.registry;
}

// ---------------------------------------------------------------------------
// Prop sanitization helpers (Zapp B4)
// ---------------------------------------------------------------------------

/** Recursively strip dangerous prototype-polluting keys from a value. */
export function stripDangerousKeys(value: unknown, depth = 0): unknown {
  if (depth > MAX_PROP_DEPTH) return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(item => stripDangerousKeys(item, depth + 1));
  }
  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    result[key] = stripDangerousKeys(obj[key], depth + 1);
  }
  return result;
}

const SAFE_URL_RE = /^https:\/\//i;

function isSameOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

/** Validate a URL-bearing prop value. Returns the value if safe, undefined otherwise. */
export function validateUrlProp(key: string, value: unknown): unknown {
  if (!URL_PROP_KEYS.has(key)) return value;
  if (typeof value !== 'string') return value;
  if (SAFE_URL_RE.test(value) || isSameOrigin(value)) return value;
  console.warn(`[A2UIRegistry] URL prop "${key}" rejected (not https: or same-origin):`, value);
  return undefined;
}

/** Check if the JSON serialized size of props exceeds MAX_PROP_BYTES. */
export function isPropsTooLarge(props: unknown): boolean {
  try {
    return JSON.stringify(props).length > MAX_PROP_BYTES;
  } catch {
    return true;
  }
}

/**
 * Sanitize raw component props:
 * 1. Strip dangerous keys
 * 2. Validate URL-bearing props
 * 3. Check size limit
 */
export function sanitizeComponentProps(
  rawProps: Record<string, unknown>,
): Record<string, unknown> {
  const stripped = stripDangerousKeys(rawProps) as Record<string, unknown>;
  const urlValidated: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(stripped)) {
    urlValidated[k] = validateUrlProp(k, v);
  }
  return urlValidated;
}

/**
 * Validate and sanitize an updateComponents payload.
 * - Unknown component names → replaced with _ErrorComponent type
 * - Props parsed through the registered Zod schema (strips unknown keys)
 * - Dangerous keys stripped, URL props validated
 * - Oversized payloads rejected
 */
export function validateAndSanitizeComponents(
  components: Array<Record<string, unknown>>,
  registry: ClientComponentRegistry,
): Array<Record<string, unknown>> {
  return components.map(comp => {
    const { id, component: componentName, ...rawProps } = comp;

    // Size guard
    if (isPropsTooLarge(rawProps)) {
      console.error(
        `[A2UIRegistry] Component "${componentName}" props exceed ${MAX_PROP_BYTES} bytes — rejected.`,
      );
      return { id, component: '_ErrorComponent' };
    }

    // Dangerous-key strip + URL validation
    const sanitized = sanitizeComponentProps(rawProps as Record<string, unknown>);

    // Unknown component → error renderer (Zapp Phase B, point 5)
    if (typeof componentName !== 'string') {
      return { id, component: '_ErrorComponent' };
    }
    const impl = registry.getImpl(componentName);
    if (!impl) {
      console.error(
        `[A2UIRegistry] Unknown component "${componentName}" — rendering error fallback.`,
      );
      return { id, component: '_ErrorComponent' };
    }

    // Schema parse (Zapp Crit1 / Phase B) — strips unknown keys, validates types
    const schema = impl.schema;
    if (schema && typeof schema.safeParse === 'function') {
      const result = schema.safeParse(sanitized);
      if (!result.success) {
        console.error(
          `[A2UIRegistry] Component "${componentName}" failed prop validation:`,
          result.error,
        );
        return { id, component: '_ErrorComponent' };
      }
      return { id, component: componentName, ...result.data };
    }

    return { id, component: componentName, ...sanitized };
  });
}
