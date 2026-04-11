import type { A2uiMsg } from '../types';
interface StreamCallbacks {
    onDelta: (text: string) => void;
    onA2UI: (messages: A2uiMsg[]) => void;
    onPhase: (phase: string) => void;
    onComplete: (fullText: string, model?: string, sessionId?: string) => void;
    onError: (error: string) => void;
}
export declare function useStreaming(): {
    send: (message: string, sessionId: string | undefined, callbacks: StreamCallbacks) => Promise<void>;
    isStreaming: boolean;
    streamText: string;
    abort: () => void;
};
export {};
//# sourceMappingURL=useStreaming.d.ts.map