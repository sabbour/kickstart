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

import React from 'react';
import type { z } from 'zod';
import type { ComponentContribution } from '@aks-kickstart/harness';
import { registerClient as registerCorePackClient } from '@aks-kickstart/pack-core/client';
import { registerClient as registerAzureClient } from '@aks-kickstart/pack-azure/client';
import { registerClient as registerAksClient } from '@aks-kickstart/pack-aks-automatic/client';
import { registerClient as registerGithubClient } from '@aks-kickstart/pack-github/client';
import type { ClientComponentRegistry } from '../contexts/A2UIRegistryContext';
import { createReactComponent } from '../vendor/a2ui/react/adapter';
import { adaptPackComponent } from './adaptPackComponent';

export function registerPackComponents(registry: ClientComponentRegistry): void {
  // Pack-core's createReactComponent is a simple pass-through that stores the raw
  // render function directly as `impl.render`. Web's A2UI surface calls
  // `render({context, buildChild})` without a `props` argument, so pack-core
  // components receive `props=undefined` and crash. Re-wrap each impl with web's
  // createReactComponent to get GenericBinder prop resolution.
  const coreTarget = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: (impl: any) => {
      const rewrapped = createReactComponent(
        { name: impl.name as string, schema: impl.schema as unknown as z.ZodTypeAny },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        impl.render as React.FC<any>,
      );
      registry.register(rewrapped);
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
