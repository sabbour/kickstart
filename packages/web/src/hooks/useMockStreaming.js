/**
 * useMockStreaming — drop-in replacement for useStreaming that returns
 * canned demo data instead of calling the real API.
 *
 * Same public interface: { send, isStreaming, streamText, abort }
 */
import { useState, useCallback, useRef } from 'react';
import { sendMock, resetMockState } from '../services/mock-streaming';
export function useMockStreaming() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamText, setStreamText] = useState('');
    const abortRef = useRef(null);
    const send = useCallback((message, sessionId, callbacks) => {
        setIsStreaming(true);
        setStreamText('');
        const controller = sendMock(message, sessionId, {
            onDelta: (text) => {
                setStreamText(text);
                callbacks.onDelta(text);
            },
            onA2UI: callbacks.onA2UI,
            onPhase: callbacks.onPhase,
            onComplete: (fullText, model) => {
                setIsStreaming(false);
                abortRef.current = null;
                callbacks.onComplete(fullText, model, undefined);
            },
            onError: (error) => {
                setIsStreaming(false);
                abortRef.current = null;
                callbacks.onError(error);
            },
        });
        abortRef.current = controller;
    }, []);
    const abort = useCallback(() => {
        abortRef.current?.abort();
        setIsStreaming(false);
    }, []);
    const reset = useCallback(() => {
        resetMockState();
    }, []);
    return { send, isStreaming, streamText, abort, reset };
}
//# sourceMappingURL=useMockStreaming.js.map