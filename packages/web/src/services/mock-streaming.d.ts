/**
 * Mock streaming provider — simulates the SSE streaming pipeline
 * using canned responses from demo-scenarios.ts.
 *
 * Activated via ?mock URL parameter. Each user message advances
 * through the scenario sequence: WELCOME → ARCHITECTURE →
 * DESIGN_DETAIL → CONFIGURE_FORM → CODE_PREVIEW → FILE_GENERATION
 * → REVIEW → DEPLOY_SUCCESS.
 */
import type { A2uiMsg } from '../types';
interface MockStreamCallbacks {
    onDelta: (text: string) => void;
    onA2UI: (messages: A2uiMsg[]) => void;
    onPhase: (phase: string) => void;
    onComplete: (fullText: string, model: string) => void;
    onError: (error: string) => void;
}
/** Reset mock state so the next send() starts from WELCOME. */
export declare function resetMockState(): void;
/**
 * Simulate streaming a canned demo response word-by-word.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export declare function sendMock(message: string, _sessionId: string | undefined, callbacks: MockStreamCallbacks): AbortController;
/** Whether ?mock is present in the current URL. */
export declare function isMockMode(): boolean;
/** Whether ?playground is present in the current URL. */
export declare function isPlaygroundMode(): boolean;
export {};
//# sourceMappingURL=mock-streaming.d.ts.map