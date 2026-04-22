/**
 * Bootstrap entry that wires pack-contributed client renderers into
 * `ClientComponentRegistry`. Called once from `main.tsx`, before
 * `clientRegistry.seal()` and React mount.
 *
 * Each pack's `./client` module exposes `registerClient(target)` — we give it a
 * target that adapts `ComponentContribution` into A2UI-native
 * `ReactComponentImplementation` via `adaptPackComponent`. No import-time side
 * effects; explicit registration matches the security contract for core/*
 * renderers (see A2UIRegistryContext.tsx).
 */

// Side-effect import: ensure Zod v4's `jitless` config is set before ANY v4
// schema constructor runs in this chunk. Pack client renderers statically
// import `zod` (v4) and construct `z.object({...})` at module-top, which
// triggers Zod v4's `allowsEval` probe (a `new Function('')` call) unless
// `jitless` is already true. By putting this import first, we guarantee
// ordering regardless of how rolldown chunks this module — belt-and-braces
// with the same import in `main.tsx`. See issue #1042.
import '../lib/configure-zod';

import type { ComponentContribution } from '@aks-kickstart/harness';
import { registerClient as registerAzureClient } from '@aks-kickstart/pack-azure/client';
import { registerClient as registerAksClient } from '@aks-kickstart/pack-aks-automatic/client';
import { registerClient as registerGithubClient } from '@aks-kickstart/pack-github/client';
import type { ClientComponentRegistry } from '../contexts/A2UIRegistryContext';
import { adaptPackComponent } from './adaptPackComponent';

export function registerPackComponents(registry: ClientComponentRegistry): void {
  const target = {
    register: (contribution: ComponentContribution) => {
      registry.register(adaptPackComponent(contribution));
    },
  };
  registerAzureClient(target);
  registerAksClient(target);
  registerGithubClient(target);
}
