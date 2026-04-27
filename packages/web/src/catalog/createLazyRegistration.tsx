/**
 * createLazyRegistration — wraps a component module factory in React.lazy so
 * the component bundle chunk is only downloaded when the first instance of
 * that component type is rendered in the UI.
 *
 * ## Why this is safe
 *
 * Registration still happens synchronously during the Phase-A bootstrap
 * (main.tsx Step 1b), so `clientRegistry.getImpl(name)` always returns an
 * entry for known components. Because the lazy registration omits a Zod
 * schema, `validateAndSanitizeComponents` falls back to the pass-through
 * sanitization path (dangerous keys stripped, URL props validated — see
 * A2UIRegistryContext.tsx). The real per-component Zod validation still runs
 * inside each component's `GenericBinder` at render time.
 *
 * ## Bundle impact
 *
 * Vite / Rollup treats each unique dynamic import path as a separate chunk.
 * Every `createLazyRegistration` call in main.tsx produces its own chunk that
 * is only fetched when a surface first emits that component type.
 *
 * @module
 */

import React from 'react';
import { Skeleton, SkeletonItem } from '@fluentui/react-components';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';

// ---------------------------------------------------------------------------
// Skeleton fallback — shown while the component chunk is downloading
// ---------------------------------------------------------------------------

const ComponentSkeleton: React.FC = () => (
  <Skeleton>
    <SkeletonItem shape="rectangle" style={{ height: '80px', width: '100%' }} />
  </Skeleton>
);
ComponentSkeleton.displayName = 'ComponentSkeleton';

// ---------------------------------------------------------------------------
// Helper type — what the dynamic import factory must resolve to
// ---------------------------------------------------------------------------

/** A dynamic import module. We look up the implementation by name at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ComponentModule = Record<string, any>;

// ---------------------------------------------------------------------------
// createLazyRegistration
// ---------------------------------------------------------------------------

/**
 * Creates a lazily-loaded `ReactComponentImplementation`.
 *
 * @param name       The A2UI component name (e.g. `"AuthCard"`). Must match
 *                   the `name` field of the implementation exported by the
 *                   factory module.
 * @param importFn   A zero-argument function that returns a dynamic import
 *                   promise. Vite uses this to create a separate chunk.
 *
 * @example
 * ```ts
 * clientRegistry.register(
 *   createLazyRegistration('AuthCard', () => import('./catalog/components/AuthCard'))
 * );
 * ```
 */
export function createLazyRegistration(
  name: string,
  importFn: () => Promise<ComponentModule>,
): ReactComponentImplementation {
  // Resolve the render function lazily. React.lazy requires a factory that
  // returns { default: ComponentType } — we extract the `.render` field from
  // the named export that matches `name`.
  const LazyRender = React.lazy(async () => {
    const mod = await importFn();
    const impl = mod[name] as ReactComponentImplementation | undefined;
    if (!impl?.render) {
      throw new Error(
        `[createLazyRegistration] Module for "${name}" did not export a ReactComponentImplementation named "${name}".`,
      );
    }
    return { default: impl.render };
  });

  const LazyWrapper: ReactComponentImplementation['render'] = (props) => (
    <React.Suspense fallback={<ComponentSkeleton />}>
      <LazyRender {...props} />
    </React.Suspense>
  );
  LazyWrapper.displayName = `Lazy(${name})`;

  return {
    name,
    // Schema is intentionally omitted here — validation falls back to the
    // sanitize-only path in validateAndSanitizeComponents. The real schema
    // validation runs inside each component's GenericBinder at render time.
    schema: undefined as unknown as ReactComponentImplementation['schema'],
    render: LazyWrapper,
  };
}
