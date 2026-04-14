import React, { useEffect, useRef, useCallback } from 'react';
import { A2uiSurface } from '../../vendor/a2ui/react/index';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { A2uiClientAction } from '../../vendor/a2ui/web_core/schema/client-to-server';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface A2UISurfaceWrapperProps {
  surface: SurfaceModel<ReactComponentImplementation>;
  /** When false, the surface is visually dimmed (past-turn). Defaults to true. */
  isActive?: boolean;
  /** Optional callback invoked when any component in this surface dispatches an action. */
  onAction?: (action: A2uiClientAction) => void | Promise<void>;
}

export function A2UISurfaceWrapper({ surface, isActive = true, onAction }: A2UISurfaceWrapperProps) {
  // Guard against double-firing: once an action dispatches, block further actions from this surface
  const hasFiredRef = useRef(false);

  const guardedOnAction = useCallback((action: A2uiClientAction) => {
    if (hasFiredRef.current || !onAction) return;
    hasFiredRef.current = true;
    // Fire-and-forget — don't let errors or async streaming block the UI
    try { void onAction(action); } catch { /* swallow */ }
  }, [onAction]);

  useEffect(() => {
    if (!onAction) return;
    const sub = surface.onAction.subscribe(guardedOnAction);
    return () => sub.unsubscribe();
  }, [surface, guardedOnAction, onAction]);

  return (
    <div
      className="a2ui-surface-wrapper"
      style={{
        borderRadius: 'var(--radius-large, 8px)',
        overflow: 'hidden',
        // Past-turn surfaces are visually dimmed but remain scrollable and selectable
        ...(isActive ? {} : { opacity: 0.5 }),
      }}
    >
      <A2uiSurface surface={surface} />
    </div>
  );
}
