import React, { useEffect } from 'react';
import { A2uiSurface } from '../../vendor/a2ui/react/index';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../../vendor/a2ui/web_core/schema/client-to-server';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface A2UISurfaceWrapperProps {
  surface: SurfaceModel<ReactComponentImplementation>;
  /** When false, the surface is dimmed and non-interactive (past-turn isolation). Defaults to true. */
  isActive?: boolean;
  /** Optional callback invoked when any component in this surface dispatches an action. */
  onAction?: (action: A2uiClientAction) => void | Promise<void>;
}

export function A2UISurfaceWrapper({ surface, isActive = true, onAction }: A2UISurfaceWrapperProps) {
  useEffect(() => {
    if (!onAction) return;
    const sub = surface.onAction.subscribe(onAction);
    return () => sub.unsubscribe();
  }, [surface, onAction]);

  return (
    <div
      className="a2ui-surface-wrapper"
      style={{
        borderRadius: 'var(--radius-large, 8px)',
        overflow: 'hidden',
        ...(isActive ? {} : {
          opacity: 0.5,
          pointerEvents: 'none',
          userSelect: 'none',
        }),
      }}
    >
      <A2uiSurface surface={surface} />
    </div>
  );
}
