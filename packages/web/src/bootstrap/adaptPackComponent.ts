/**
 * Adapter: wrap a server-authored `ComponentContribution` from a pack into the
 * A2UI-native `ReactComponentImplementation` expected by `ClientComponentRegistry`.
 *
 * Pack renderers are plain `React.FC<{ props: TProps }>` with a Zod
 * `propertySchema`. The A2UI binder needs a `ComponentApi<Schema>` and an inner
 * render function that receives already-resolved props — which the adapter's
 * inner component forwards straight through.
 *
 * The adapter is deliberately thin: it never reads or mutates `props` beyond
 * passing them to the underlying renderer, matching the XSS/prop-safety rails
 * enforced by `validateAndSanitizeComponents` on the caller side.
 */

import React from 'react';
import type { z } from 'zod';
import type { ComponentContribution } from '@aks-kickstart/harness';
import { createReactComponent } from '../vendor/a2ui/react/adapter';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';

type PackRenderer = React.ComponentType<{ props: Record<string, unknown> }>;

export function adaptPackComponent(
  contribution: ComponentContribution,
): ReactComponentImplementation {
  const Renderer = contribution.renderer as PackRenderer;
  const api = {
    name: contribution.name,
    // Packs bundle zod@4 while web still depends on zod@3; the runtime
    // contract (`.safeParse(...)` for prop validation) is identical across
    // versions, so a widening cast through `unknown` is the correct bridge
    // until the monorepo unifies on a single zod major. See decision note
    // bender-1000-revise-2026-04-21.
    schema: contribution.propertySchema as unknown as z.ZodTypeAny,
  };
  return createReactComponent(api, ({ props }) =>
    React.createElement(Renderer, { props: props as Record<string, unknown> }),
  );
}
