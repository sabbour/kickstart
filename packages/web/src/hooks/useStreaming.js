import { useState, useCallback, useRef } from 'react';
export function useStreaming() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamText, setStreamText] = useState('');
    const abortRef = useRef(null);
    const send = useCallback(async (message, sessionId, callbacks) => {
        setIsStreaming(true);
        setStreamText('');
        const controller = new AbortController();
        abortRef.current = controller;
        let accumulated = '';
        let lastModel;
        let lastSessionId;
        try {
            const res = await fetch('/api/converse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                },
                body: JSON.stringify({ sessionId, message, stream: true }),
                signal: controller.signal,
            });
            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }
            const reader = res.body?.getReader();
            if (!reader)
                throw new Error('No response body');
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: '))
                        continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]')
                        continue;
                    try {
                        const event = JSON.parse(data);
                        if (event.delta) {
                            accumulated += event.delta;
                            setStreamText(accumulated);
                            callbacks.onDelta(accumulated);
                        }
                        if (event.content) {
                            accumulated = event.content;
                            setStreamText(accumulated);
                            callbacks.onDelta(accumulated);
                        }
                        if (event.a2ui && event.a2ui.length > 0) {
                            callbacks.onA2UI(event.a2ui);
                        }
                        if (event.phase) {
                            callbacks.onPhase(event.phase);
                        }
                        if (event.model) {
                            lastModel = event.model;
                        }
                        if (event.sessionId) {
                            lastSessionId = event.sessionId;
                        }
                    }
                    catch { /* skip malformed JSON */ }
                }
            }
            callbacks.onComplete(accumulated, lastModel, lastSessionId);
        }
        catch (err) {
            if (err.name !== 'AbortError') {
                callbacks.onError(err.message || 'Connection failed');
            }
        }
        finally {
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, []);
    const abort = useCallback(() => {
        abortRef.current?.abort();
        setIsStreaming(false);
    }, []);
    return { send, isStreaming, streamText, abort };
}
//# sourceMappingURL=useStreaming.js.map