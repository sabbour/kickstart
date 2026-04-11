import React from 'react';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { SurfaceModel } from '../../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../../vendor/a2ui/react/adapter';
interface MessageListProps {
    messages: ChatMessageType[];
    isStreaming: boolean;
    streamingText: string;
    streamingSurfaceIds?: string[];
    getSurface: (id: string) => SurfaceModel<ReactComponentImplementation> | undefined;
}
export declare function MessageList({ messages, isStreaming, streamingText, streamingSurfaceIds, getSurface }: MessageListProps): React.JSX.Element;
export {};
//# sourceMappingURL=MessageList.d.ts.map