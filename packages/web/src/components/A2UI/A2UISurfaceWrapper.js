import React from 'react';
import { A2uiSurface } from '../../vendor/a2ui/react/index';
export function A2UISurfaceWrapper({ surface, isActive = true }) {
    return (<div className="a2ui-surface-wrapper" style={{
            borderRadius: 'var(--radius-large, 8px)',
            overflow: 'hidden',
            ...(isActive ? {} : {
                opacity: 0.5,
                pointerEvents: 'none',
                userSelect: 'none',
            }),
        }}>
      <A2uiSurface surface={surface}/>
    </div>);
}
//# sourceMappingURL=A2UISurfaceWrapper.js.map