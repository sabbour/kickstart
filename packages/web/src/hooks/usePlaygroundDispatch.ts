import React, { useCallback, useState } from 'react';
import { MessageBar, MessageBarBody } from '@fluentui/react-components';
import type { PlaygroundStub } from '@aks-kickstart/harness';
import type { PlaygroundScenario, ComponentContribution } from '@aks-kickstart/harness';

/**
 * Browser-readable surface of PackRegistry.
 * Satisfied structurally by PackRegistry once Step 5 wires it in.
 *
 * TODO(Step 5): replace with server-provided registry
 */
export interface PlaygroundRegistryView {
  readonly playgroundScenarios: PlaygroundScenario[];
  readonly components: ComponentContribution[];
  readonly playgroundStubs: Readonly<Record<string, PlaygroundStub>>;
}

export interface UsePlaygroundDispatchResult {
  /**
   * Dispatch a playground action by name. If no stub is registered the hook
   * surfaces a visible MessageBar — never console.warn.
   */
  dispatch: (actionName: string, payload: unknown) => void;
  /** Render this beside the playground canvas when non-null. */
  errorBar: React.ReactNode;
}

const IS_PROD = import.meta.env.PROD;

export function usePlaygroundDispatch(
  registry: PlaygroundRegistryView,
): UsePlaygroundDispatchResult {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dispatch = useCallback(
    (actionName: string, payload: unknown): void => {
      const stubs = registry.playgroundStubs;
      const stub = stubs[actionName];

      // Leela C2: this guard is REQUIRED — the DP pseudocode was missing it
      if (!stub) {
        const detail = IS_PROD
          ? 'Action not found'
          : `No playground stub registered for action: ${actionName}. Registered: ${Object.keys(stubs).join(', ')}`;
        setErrorMessage(detail);
        return;
      }

      setErrorMessage(null);
      stub(payload).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(IS_PROD ? 'Action failed' : msg);
      });
    },
    [registry],
  );

  const errorBar: React.ReactNode = errorMessage
    ? React.createElement(
        MessageBar,
        { intent: 'error' },
        React.createElement(MessageBarBody, null, errorMessage),
      )
    : null;

  return { dispatch, errorBar };
}
