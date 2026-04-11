/**
 * @module @kickstart/api/lib/session-store
 *
 * In-memory session store with TTL cleanup.
 * Stores conversation state for the web surface API.
 */
import { randomUUID } from "node:crypto";
import { Phase, createInitialState, buildSystemPrompt, } from "@kickstart/core";
const sessions = new Map();
/** Session TTL: 1 hour. */
const SESSION_TTL_MS = 60 * 60 * 1000;
/** Purge stale sessions every 10 minutes. */
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
        if (now - session.lastAccessed > SESSION_TTL_MS) {
            sessions.delete(id);
        }
    }
}, 10 * 60 * 1000);
cleanupInterval.unref();
/** Retrieve an existing session, refreshing its TTL. */
export function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session)
        session.lastAccessed = Date.now();
    return session;
}
/** Create a new session with Discover-phase system prompt. */
export function createSession() {
    const sessionId = randomUUID();
    const now = new Date().toISOString();
    const engineState = createInitialState();
    const systemPrompt = buildSystemPrompt({
        phase: Phase.Discover,
        appDefinition: {},
    });
    const session = {
        state: {
            sessionId,
            currentPhase: Phase.Discover,
            createdAt: now,
            updatedAt: now,
            appDefinition: {},
            messages: [
                { role: "system", content: systemPrompt, timestamp: now },
            ],
        },
        engineState,
        lastAccessed: Date.now(),
    };
    sessions.set(sessionId, session);
    return session;
}
/** Append a message to the session's history. */
export function addMessage(sessionId, role, content) {
    const session = sessions.get(sessionId);
    if (!session)
        return;
    session.state.messages.push({
        role,
        content,
        timestamp: new Date().toISOString(),
    });
    session.state.updatedAt = new Date().toISOString();
    session.lastAccessed = Date.now();
}
//# sourceMappingURL=session-store.js.map