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

import type { ComponentContribution } from '@aks-kickstart/harness';
import { registerClient as registerCorePackClient } from '@aks-kickstart/pack-core/client';
import { registerClient as registerAzureClient } from '@aks-kickstart/pack-azure/client';
import { registerClient as registerAksClient } from '@aks-kickstart/pack-aks-automatic/client';
import { registerClient as registerGithubClient } from '@aks-kickstart/pack-github/client';
import type { ClientComponentRegistry } from '../contexts/A2UIRegistryContext';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { adaptPackComponent } from './adaptPackComponent';

export function registerPackComponents(registry: ClientComponentRegistry): void {
  // Core pack components are already ReactComponentImplementation. The web and
  // pack-core vendor copies of ReactComponentImplementation are structurally
  // identical at runtime but diverge in ComponentContext.dataContext.resolveAction
  // generics — cast to bridge the nominal difference.
  const coreTarget = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: (impl: any) => {
      registry.register(impl as ReactComponentImplementation);
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerCorePackClient(coreTarget as any);

  // Pack components are ComponentContribution — adapt them before registering.
  const packTarget = {
    register: (contribution: ComponentContribution) => {
      registry.register(adaptPackComponent(contribution));
    },
  };
  registerAzureClient(packTarget);
  registerAksClient(packTarget);
  registerGithubClient(packTarget);
}
