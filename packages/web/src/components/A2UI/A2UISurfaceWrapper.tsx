import React from 'react';
import { A2uiSurface } from '../../vendor/a2ui/react/index';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';

interface A2UISurfaceWrapperProps {
  surface: SurfaceModel<ReactComponentImplementation>;
  /** When false, the surface is visually dimmed (past-turn). Defaults to true. */
  isActive?: boolean;
}

export function A2UISurfaceWrapper({ surface, isActive = true }: A2UISurfaceWrapperProps) {
  return (
    <div
      className="a2ui-surface-wrapper"
      style={{
        borderRadius: 'var(--radius-large, 8px)',
        overflow: 'hidden',
        ...(isActive ? {} : { opacity: 0.5 }),
      }}
    >
      <A2uiSurface surface={surface} />
    </div>
  );
}
