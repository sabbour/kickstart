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
