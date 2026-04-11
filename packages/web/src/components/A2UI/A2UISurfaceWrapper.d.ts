import React from 'react';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
interface A2UISurfaceWrapperProps {
    surface: SurfaceModel<ReactComponentImplementation>;
    /** When false, the surface is dimmed and non-interactive (past-turn isolation). Defaults to true. */
    isActive?: boolean;
}
export declare function A2UISurfaceWrapper({ surface, isActive }: A2UISurfaceWrapperProps): React.JSX.Element;
export {};
//# sourceMappingURL=A2UISurfaceWrapper.d.ts.map