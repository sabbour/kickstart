import { MessageProcessor } from '../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { A2uiMsg } from '../types';
import type { ActionHandler } from './useActionDispatch';
export interface A2UIOptions {
    /** Handler invoked when any A2UI component fires an action event. */
    actionHandler?: ActionHandler;
}
export interface A2UIHandle {
    processor: MessageProcessor<ReactComponentImplementation>;
    surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>;
    processMessages: (msgs: A2uiMsg[]) => string[];
    getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
    reset: () => void;
}
export declare function useA2UI(options?: A2UIOptions): A2UIHandle;
//# sourceMappingURL=useA2UI.d.ts.map