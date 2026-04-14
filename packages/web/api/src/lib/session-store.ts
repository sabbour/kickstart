/**
 * @module @kickstart/api/lib/session-store
 *
 * In-memory session store with TTL cleanup.
 * Stores conversation state for the web surface API.
 */

import { randomUUID } from "node:crypto";
import {
  Phase,
  createInitialState,
  buildSystemPrompt,
} from "@kickstart/core";
import type {
  SessionState,
  ConversationState,
  ConversationMessage,
} from "@kickstart/core";

/** Session wrapper with engine state and TTL tracking. */
export interface ApiSession {
  state: SessionState;
  engineState: ConversationState;
  lastAccessed: number;
}

const sessions = new Map<string, ApiSession>();

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
export function getSession(sessionId: string): ApiSession | undefined {
  const session = sessions.get(sessionId);
  if (session) session.lastAccessed = Date.now();
  return session;
}

/** Create a new session with Discover-phase system prompt. */
export function createSession(): ApiSession {
  const sessionId = randomUUID();
  const now = new Date().toISOString();
  const engineState = createInitialState();

  const systemPrompt = buildSystemPrompt({
    phase: Phase.Discover,
    appDefinition: {},
  });

  const session: ApiSession = {
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

/**
 * Client-provided message for session hydration.
 * Only role + content — the server never trusts client timestamps or system prompts.
 */
export interface ClientMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Create a new session and seed it with client-provided conversation history.
 * Used when the in-memory session has been lost (cold start / scale event)
 * but the client still holds the message history in React state.
 *
 * System messages are always rebuilt server-side — client-sent system
 * messages are silently dropped.
 */
export function hydrateSession(clientMessages: ClientMessage[]): ApiSession {
  const session = createSession();
  const now = new Date().toISOString();

  for (const msg of clientMessages) {
    // Only allow user/assistant — never trust client-sent system prompts
    if (msg.role !== "user" && msg.role !== "assistant") continue;
    if (!msg.content) continue;

    session.state.messages.push({
      role: msg.role,
      content: msg.content,
      timestamp: now,
    });
  }

  session.state.updatedAt = now;
  return session;
}

/** Append a message to the session's history. */
export function addMessage(
  sessionId: string,
  role: ConversationMessage["role"],
  content: string,
): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.state.messages.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
  session.state.updatedAt = new Date().toISOString();
  session.lastAccessed = Date.now();
}
