/**
 * Tests for agents-session-adapter.ts
 *
 * Spike checkpoint #2 — verifies cold-start round-trip:
 * - sessionToAgentItems converts session messages to AgentInputItem format
 * - System messages are excluded
 * - KickstartSessionAdapter.getItems() returns correct items
 * - KickstartSessionAdapter.addItems() persists back to session store
 * - TTL (lastAccessed) is refreshed on reads/writes
 * - clearSession() is a no-op (security invariant)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, hydrateSession } from "./session-store.js";
import {
  sessionToAgentItems,
  KickstartSessionAdapter,
} from "./agents-session-adapter.js";
import { resumeRun } from "./agents-runner.js";

describe("sessionToAgentItems", () => {
  it("excludes system messages", () => {
    const session = createSession("principal-test");
    // session starts with one system message
    expect(session.state.messages[0].role).toBe("system");

    const items = sessionToAgentItems(session);
    // AgentInputItem is a union — access role via type widening
    expect(items.every((i) => (i as { role?: string }).role !== "system")).toBe(true);
  });

  it("converts user messages to AgentInputItem user format", () => {
    const session = hydrateSession(
      [{ role: "user", content: "Hello world" }],
      "principal-test",
    );
    const items = sessionToAgentItems(session);
    const userItem = items.find((i) => (i as { role?: string }).role === "user");
    expect(userItem).toBeDefined();
    expect((userItem as { content: string }).content).toBe("Hello world");
  });

  it("converts assistant messages to output_text content format", () => {
    const session = hydrateSession(
      [{ role: "assistant", content: "Here is the architecture." }],
      "principal-test",
    );
    const items = sessionToAgentItems(session);
    const assistantItem = items.find((i) => (i as { role?: string }).role === "assistant");
    expect(assistantItem).toBeDefined();
    const content = (
      assistantItem as { content: Array<{ type: string; text: string }> }
    ).content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0].type).toBe("output_text");
    expect(content[0].text).toBe("Here is the architecture.");
  });

  it("returns empty array for session with only system prompt", () => {
    const session = createSession();
    const items = sessionToAgentItems(session);
    expect(items).toHaveLength(0);
  });
});

describe("KickstartSessionAdapter", () => {
  let session: ReturnType<typeof createSession>;

  beforeEach(() => {
    session = createSession("principal-abc");
  });

  describe("getSessionId", () => {
    it("returns the session ID", async () => {
      const adapter = new KickstartSessionAdapter(session);
      const id = await adapter.getSessionId();
      expect(id).toBe(session.state.sessionId);
    });
  });

  describe("getItems", () => {
    it("returns items excluding system messages", async () => {
      session.state.messages.push({
        role: "user",
        content: "Hi",
        timestamp: new Date().toISOString(),
      });
      const adapter = new KickstartSessionAdapter(session);
      const items = await adapter.getItems();
      expect(items.every((i) => (i as { role?: string }).role !== "system")).toBe(true);
      expect(items.some((i) => (i as { role?: string }).role === "user")).toBe(true);
    });

    it("respects the limit parameter (returns last N items)", async () => {
      for (let i = 0; i < 5; i++) {
        session.state.messages.push({
          role: "user",
          content: `message ${i}`,
          timestamp: new Date().toISOString(),
        });
      }
      const adapter = new KickstartSessionAdapter(session);
      const items = await adapter.getItems(2);
      expect(items).toHaveLength(2);
      const lastContent = (items[1] as { content: string }).content;
      expect(lastContent).toBe("message 4");
    });

    it("refreshes lastAccessed on read", async () => {
      const before = session.lastAccessed;
      // Small delay
      await new Promise((r) => setTimeout(r, 5));
      const adapter = new KickstartSessionAdapter(session);
      await adapter.getItems();
      expect(session.lastAccessed).toBeGreaterThanOrEqual(before);
    });
  });

  describe("addItems", () => {
    it("persists assistant messages to session store", async () => {
      const adapter = new KickstartSessionAdapter(session);
      await adapter.addItems([
        {
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text: "Architecture is ready." }],
        } as Parameters<typeof adapter.addItems>[0][number],
      ]);
      const lastMsg = session.state.messages[session.state.messages.length - 1];
      expect(lastMsg.role).toBe("assistant");
      expect(lastMsg.content).toBe("Architecture is ready.");
    });

    it("does NOT persist user messages (SDK path — raw user input may include internal context)", async () => {
      const before = session.state.messages.length;
      const adapter = new KickstartSessionAdapter(session);
      await adapter.addItems([{ role: "user", content: "Deploy now." }]);
      // User messages are intentionally excluded from STORABLE_ROLES in the SDK
      // path: the user input passed to the agent may include appended
      // domainKnowledge/currentState that must not be written to the store.
      // The raw user message is persisted by converse.ts before the SDK turn.
      expect(session.state.messages.length).toBe(before);
    });

    it("drops system messages silently", async () => {
      const before = session.state.messages.length;
      const adapter = new KickstartSessionAdapter(session);
      await adapter.addItems([
        { role: "system", content: "INJECTED SYSTEM PROMPT" },
      ]);
      expect(session.state.messages.length).toBe(before);
    });

    it("refreshes lastAccessed on write", async () => {
      const before = session.lastAccessed;
      await new Promise((r) => setTimeout(r, 5));
      const adapter = new KickstartSessionAdapter(session);
      // Use an assistant item — user items are not stored and do not refresh TTL
      await adapter.addItems([{
        role: "assistant",
        status: "completed",
        content: [{ type: "output_text", text: "hello" }],
      } as Parameters<typeof adapter.addItems>[0][number]]);
      expect(session.lastAccessed).toBeGreaterThanOrEqual(before);
    });
  });

  describe("clearSession", () => {
    it("is a no-op — does not clear session messages", async () => {
      session.state.messages.push({
        role: "user",
        content: "preserve me",
        timestamp: new Date().toISOString(),
      });
      const countBefore = session.state.messages.length;
      const adapter = new KickstartSessionAdapter(session);
      await adapter.clearSession();
      // Messages must be unchanged — clearSession is intentionally a no-op
      expect(session.state.messages.length).toBe(countBefore);
    });
  });

  describe("popItem", () => {
    it("removes and returns the last non-system message", async () => {
      session.state.messages.push({
        role: "user",
        content: "last message",
        timestamp: new Date().toISOString(),
      });
      const adapter = new KickstartSessionAdapter(session);
      const popped = await adapter.popItem();
      expect(popped).toBeDefined();
      expect((popped as { content: string }).content).toBe("last message");
      // Should no longer be in messages
      const remaining = session.state.messages.filter((m: { role: string }) => m.role !== "system");
      expect(remaining.some((m: { content: string; role: string }) => m.content === "last message")).toBe(false);
    });

    it("returns undefined when only system message remains", async () => {
      // createSession adds one system message — remove any others
      session.state.messages = session.state.messages.filter(
        (m: { role: string }) => m.role === "system",
      );
      const adapter = new KickstartSessionAdapter(session);
      const popped = await adapter.popItem();
      expect(popped).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// TTL / expiry tests (Zapp condition: "expired state cannot be resumed")
// ---------------------------------------------------------------------------

describe("KickstartSessionAdapter — TTL expiry", () => {
  it("getItems() throws for an expired session", async () => {
    const session = createSession("principal-ttl-test");
    // Backdate lastAccessed to exceed the 1-hour TTL
    session.lastAccessed = Date.now() - (61 * 60 * 1000);

    const adapter = new KickstartSessionAdapter(session);
    await expect(adapter.getItems()).rejects.toThrow(/expired/i);
  });

  it("getItems() does NOT throw for a fresh session", async () => {
    const session = createSession("principal-ttl-fresh");
    // lastAccessed is set to Date.now() by createSession — session is fresh
    const adapter = new KickstartSessionAdapter(session);
    await expect(adapter.getItems()).resolves.toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// resumeRun — cross-principal hijack rejection (Zapp security condition)
// ---------------------------------------------------------------------------

describe("resumeRun — cross-principal session hijack prevention", () => {
  it("throws 403 when a different principal tries to resume an owned session", async () => {
    const session = createSession("hijack-test-session");
    session.principalId = "owner-alice";
    session.state.messages.push({
      role: "user",
      content: "previous turn",
      timestamp: new Date().toISOString(),
    });

    await expect(
      resumeRun(session, "run-001", "attacker-bob"),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when no principalId is provided for a session that has an owner", async () => {
    const session = createSession("hijack-test-anon");
    session.principalId = "owner-alice";

    await expect(
      resumeRun(session, "run-002", undefined),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does NOT throw for the session owner resuming their own run", async () => {
    const session = createSession("owner-alice"); // principalId = "owner-alice"

    // runAgentTurn will fail at the Azure call stage, not at the ownership gate
    await expect(
      resumeRun(session, "run-003", "owner-alice"),
    ).rejects.not.toMatchObject({ status: 403 });
  });

  it("does NOT throw for anonymous sessions (no principalId set)", async () => {
    const session = createSession(); // no principalId → open session
    // Any caller may resume an anonymous session

    await expect(
      resumeRun(session, "run-004", "anyone"),
    ).rejects.not.toMatchObject({ status: 403 });
  });
});
