/**
 * @module @kickstart/api/lib/agents-session-adapter
 *
 * Spike checkpoint #2 — session store adapter for the @openai/agents SDK.
 *
 * Wraps `ApiSession` from session-store.ts behind the SDK `Session` interface
 * so the Runner can use our existing TTL-aware, principal-owning store as its
 * persistence layer.
 *
 * Semantics preserved:
 * - TTL / expiry — session.lastAccessed is refreshed on every read/write
 * - Principal ownership — session.principalId is unchanged
 * - Artifact hydration — handled by session-store.ts; this adapter does not
 *   re-derive artifacts (they are already in session.generatedArtifacts)
 * - Cold-start round-trip — hydrateSession() already recreates the message
 *   list; this adapter translates them to AgentInputItem format on demand
 *
 * AgentInputItem → ConversationMessage mapping:
 *   SDK `user` message   ↔ session role "user"
 *   SDK `assistant` message ↔ session role "assistant"
 *   SDK `system` message → dropped (system prompt is rebuilt each turn)
 *   Tool call / result items → not persisted in our store; they are transient
 */

import type { AgentInputItem } from "@openai/agents";
import type { ApiSession } from "./session-store.js";
import { addMessage, isSessionExpired } from "./session-store.js";

/** Roles we accept from AgentInputItem when persisting back to session store. */
const STORABLE_ROLES = new Set(["user", "assistant"]);

/**
 * Build the full history `AgentInputItem[]` from the session messages.
 * System messages are excluded — the Agent's `instructions` field owns the
 * system prompt, rebuilt fresh every turn.
 */
export function sessionToAgentItems(session: ApiSession): AgentInputItem[] {
  const items: AgentInputItem[] = [];
  for (const m of session.state.messages) {
    if (m.role === "system") continue;
    if (m.role === "user") {
      items.push({ role: "user", content: m.content ?? "" } as AgentInputItem);
    } else if (m.role === "assistant") {
      items.push({
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: m.content ?? "" }],
      } as AgentInputItem);
    }
  }
  return items;
}

/**
 * SDK `Session` adapter backed by `ApiSession`.
 *
 * The SDK calls `getItems()` before each model invocation and `addItems()`
 * after the run completes. We hook into `addItems()` to persist assistant
 * messages back to the session store.
 *
 * NOTE: We do NOT implement `clearSession()` for security — clearing would
 * erase principal-owned conversation state without user intent.
 */
export class KickstartSessionAdapter {
  private readonly session: ApiSession;

  constructor(session: ApiSession) {
    this.session = session;
  }

  async getSessionId(): Promise<string> {
    return this.session.state.sessionId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    // Fail-closed on expired sessions — do not refresh TTL on an expired session
    // (Zapp condition: "expired state cannot be resumed").
    if (isSessionExpired(this.session)) {
      throw new Error(
        `Session ${this.session.state.sessionId} has expired and cannot be resumed.`,
      );
    }
    // Refresh TTL on read
    this.session.lastAccessed = Date.now();
    const items = sessionToAgentItems(this.session);
    if (limit !== undefined && limit > 0) {
      return items.slice(-limit);
    }
    return items;
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    this.session.lastAccessed = Date.now();

    for (const item of items) {
      const role = (item as { role?: string }).role;
      if (!role || !STORABLE_ROLES.has(role)) continue;

      const text = extractTextFromItem(item);
      if (!text) continue;

      addMessage(
        this.session.state.sessionId,
        role as "user" | "assistant",
        text,
      );
    }
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    const msgs = this.session.state.messages;
    const lastNonSystemIdx = [...msgs]
      .reverse()
      .findIndex((m) => m.role !== "system");
    if (lastNonSystemIdx < 0) return undefined;
    const idx = msgs.length - 1 - lastNonSystemIdx;
    const [popped] = msgs.splice(idx, 1);
    if (!popped) return undefined;

    if (popped.role === "user") {
      return { role: "user", content: popped.content ?? "" } as AgentInputItem;
    }
    return {
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: popped.content ?? "" }],
    } as AgentInputItem;
  }

  async clearSession(): Promise<void> {
    // No-op: we deliberately do not allow session clearing through the SDK
    // adapter — clearing must go through the explicit session-store API where
    // principal ownership can be verified.
  }
}

/** Extract plain text from an AgentInputItem regardless of content shape. */
function extractTextFromItem(item: AgentInputItem): string | undefined {
  const anyItem = item as Record<string, unknown>;
  if (typeof anyItem.content === "string") {
    return anyItem.content || undefined;
  }
  const contentArr = anyItem.content;
  if (Array.isArray(contentArr)) {
    const texts = contentArr
      .filter(
        (c): c is { text: string } =>
          typeof c === "object" &&
          c !== null &&
          typeof (c as { text?: unknown }).text === "string",
      )
      .map((c) => c.text);
    return texts.join("") || undefined;
  }
  return undefined;
}
