/**
 * @module @kickstart/api/lib/session-store
 *
 * In-memory session store with TTL cleanup.
 * Stores conversation state for the web surface API.
 */
import type { SessionState, ConversationState, ConversationMessage } from "@kickstart/core";
/** Session wrapper with engine state and TTL tracking. */
export interface ApiSession {
    state: SessionState;
    engineState: ConversationState;
    lastAccessed: number;
}
/** Retrieve an existing session, refreshing its TTL. */
export declare function getSession(sessionId: string): ApiSession | undefined;
/** Create a new session with Discover-phase system prompt. */
export declare function createSession(): ApiSession;
/** Append a message to the session's history. */
export declare function addMessage(sessionId: string, role: ConversationMessage["role"], content: string): void;
//# sourceMappingURL=session-store.d.ts.map