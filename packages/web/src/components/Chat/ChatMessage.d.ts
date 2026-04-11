import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
interface ChatMessageProps {
    message: ChatMessageType;
    getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
    /** When false, A2UI surfaces in this message are dimmed and non-interactive. Defaults to true. */
    isActive?: boolean;
}
export declare function ChatMessage({ message, getSurface, isActive }: ChatMessageProps): React.JSX.Element;
export {};
//# sourceMappingURL=ChatMessage.d.ts.map