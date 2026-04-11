/**
 * useMockStreaming — drop-in replacement for useStreaming that returns
 * canned demo data instead of calling the real API.
 *
 * Same public interface: { send, isStreaming, streamText, abort }
 */
import type { A2uiMsg } from '../types';
interface MockStreamCallbacks {
    onDelta: (text: string) => void;
    onA2UI: (messages: A2uiMsg[]) => void;
    onPhase: (phase: string) => void;
    onComplete: (fullText: string, model?: string, sessionId?: string) => void;
    onError: (error: string) => void;
}
export declare function useMockStreaming(): {
    send: (message: string, sessionId: string | undefined, callbacks: MockStreamCallbacks) => void;
    isStreaming: boolean;
    streamText: string;
    abort: () => void;
    reset: () => void;
};
export {};
//# sourceMappingURL=useMockStreaming.d.ts.map