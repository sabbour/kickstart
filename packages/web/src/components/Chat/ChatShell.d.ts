import React from 'react';
import type { ChatMessage } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
interface ChatShellProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    streamingText: string;
    streamingSurfaceIds?: string[];
    onSend: (text: string) => void;
    getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
}
export declare function ChatShell({ messages, isStreaming, streamingText, streamingSurfaceIds, onSend, getSurface }: ChatShellProps): React.JSX.Element;
export {};
//# sourceMappingURL=ChatShell.d.ts.map