/**
 * Aggregated component preview map consumed by the Playground Components tab
 * and the render-time guard test.
 *
 * Layout:
 *  - `core/*` previews live co-located with the web catalog in `./core-previews`.
 *  - `azure/*`, `aks/*`, and `github/*` previews are **pack-contributed** via
 *    `@aks-kickstart/pack-{azure,aks-automatic,github}/client` — each pack owns
 *    its own sample envelopes so Playground stays in sync with pack-shipped
 *    renderers as they evolve.
 *
 * There is no post-build registry step; this module composes statically so
 * tree-shaking still drops any preview whose key isn't referenced.
 */

import { previews as azurePreviews } from '@aks-kickstart/pack-azure/client';
import { previews as aksPreviews } from '@aks-kickstart/pack-aks-automatic/client';
import { previews as githubPreviews } from '@aks-kickstart/pack-github/client';
import { COMPONENT_PREVIEWS as corePreviews } from './core-previews';
import type { ComponentPreviewEntry } from './core-previews';

export type { ComponentPreviewEntry };

export const COMPONENT_PREVIEWS: Readonly<Record<string, ComponentPreviewEntry>> = Object.freeze({
  ...corePreviews,
  ...(azurePreviews as Record<string, ComponentPreviewEntry>),
  ...(aksPreviews as Record<string, ComponentPreviewEntry>),
  ...(githubPreviews as Record<string, ComponentPreviewEntry>),
});
