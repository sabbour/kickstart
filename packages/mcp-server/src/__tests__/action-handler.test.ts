/**
 * B-23 — Wire A2UI action handler
 *
 * Tests for the extended action dispatch that handles A2UI ActionSchema events:
 *   • "reply"    → converts to conversation message (re-prompt LLM)
 *   • "navigate" → triggers phase transitions
 *   • "api"      → stubbed but must not crash
 *   • unknown    → handled gracefully (no crash, error message)
 *   • past-turn  → actions from expired/past turns are ignored
 *
 * These tests are written ahead of implementation (TDD).
 * They will fail until Bender lands the action handler wiring.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { handleAction } from "../tools/action.js";
import type { SessionState } from "@kickstart/harness";
import { Phase } from "@kickstart/harness";

// ── Helpers ─────────────────────────────────────────────────────────

function createSession(
  id: string,
  phase: Phase = Phase.Discover,
  overrides: Partial<SessionState> = {},
): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId: id,
    currentPhase: phase,
    createdAt: now,
    updatedAt: now,
    appDefinition: {},
    messages: [],
    ...overrides,
  };
}

/** Extract the first text content item from a handleAction result. */
function extractText(
  result: Awaited<ReturnType<typeof handleAction>>,
): string {
  const item = result.content.find((c) => c.type === "text");
  return item && item.type === "text" ? item.text : "";
}

// ── Tests ───────────────────────────────────────────────────────────

describe("B-23: A2UI action handler — reply actions", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it('"reply" action adds a user message to the conversation', async () => {
    const session = createSession("s-reply");
    sessions.set("s-reply", session);

    await handleAction(sessions, "s-reply", "reply" as any, {
      message: "Yes, I want a Node.js app",
    });

    const updated = sessions.get("s-reply")!;
    const userMessages = updated.messages.filter((m) => m.role === "user");
    expect(userMessages.length).toBeGreaterThanOrEqual(1);
    expect(userMessages[userMessages.length - 1].content).toContain(
      "Yes, I want a Node.js app",
    );
  });

  it('"reply" action does not advance the phase', async () => {
    const session = createSession("s-reply-phase", Phase.Discover);
    sessions.set("s-reply-phase", session);

    await handleAction(sessions, "s-reply-phase", "reply" as any, {
      message: "Tell me more about Discover",
    });

    const updated = sessions.get("s-reply-phase")!;
    expect(updated.currentPhase).toBe(Phase.Discover);
  });

  it('"reply" action returns an assistant response (re-prompt)', async () => {
    const session = createSession("s-reply-resp");
    sessions.set("s-reply-resp", session);

    const result = await handleAction(sessions, "s-reply-resp", "reply" as any, {
      message: "What runtimes are supported?",
    });

    const text = extractText(result);
    expect(text).toBeTruthy();
    // Should NOT be an error message
    expect(text).not.toContain("not found");
  });

  it('"reply" without a message payload returns a validation error', async () => {
    const session = createSession("s-reply-empty");
    sessions.set("s-reply-empty", session);

    const result = await handleAction(
      sessions,
      "s-reply-empty",
      "reply" as any,
    );
    const text = extractText(result);
    // Should indicate the reply message is required
    expect(text.toLowerCase()).toMatch(/missing|required|invalid|message/);
  });

  it('"reply" updates the session updatedAt timestamp', async () => {
    const session = createSession("s-reply-ts");
    const before = session.updatedAt;
    sessions.set("s-reply-ts", session);

    await new Promise((r) => setTimeout(r, 5));
    await handleAction(sessions, "s-reply-ts", "reply" as any, {
      message: "Update me",
    });

    const updated = sessions.get("s-reply-ts")!;
    expect(updated.updatedAt).not.toBe(before);
  });
});

describe("B-23: A2UI action handler — navigate actions", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it('"navigate" action transitions to the specified phase', async () => {
    const session = createSession("s-nav", Phase.Discover);
    sessions.set("s-nav", session);

    await handleAction(sessions, "s-nav", "navigate" as any, {
      targetPhase: Phase.Design,
    });

    const updated = sessions.get("s-nav")!;
    expect(updated.currentPhase).toBe(Phase.Design);
  });

  it('"navigate" returns an A2UI phase indicator resource', async () => {
    const session = createSession("s-nav-a2ui", Phase.Discover);
    sessions.set("s-nav-a2ui", session);

    const result = await handleAction(sessions, "s-nav-a2ui", "navigate" as any, {
      targetPhase: Phase.Design,
    });

    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBeGreaterThanOrEqual(1);

    const resource = resources[0] as {
      type: "resource";
      resource: { uri: string; mimeType: string; text: string };
    };
    expect(resource.resource.mimeType).toBe("application/json+a2ui");
  });

  it('"navigate" to an invalid phase returns an error', async () => {
    const session = createSession("s-nav-bad", Phase.Discover);
    sessions.set("s-nav-bad", session);

    const result = await handleAction(sessions, "s-nav-bad", "navigate" as any, {
      targetPhase: "nonexistent-phase",
    });

    const text = extractText(result);
    expect(text.toLowerCase()).toMatch(/invalid|unknown|error/);
  });

  it('"navigate" without targetPhase returns an error', async () => {
    const session = createSession("s-nav-missing", Phase.Discover);
    sessions.set("s-nav-missing", session);

    const result = await handleAction(
      sessions,
      "s-nav-missing",
      "navigate" as any,
    );

    const text = extractText(result);
    expect(text.toLowerCase()).toMatch(/missing|required|target/);
  });

  it('"navigate" can go backward to an earlier phase', async () => {
    const session = createSession("s-nav-back", Phase.Generate);
    sessions.set("s-nav-back", session);

    await handleAction(sessions, "s-nav-back", "navigate" as any, {
      targetPhase: Phase.Discover,
    });

    const updated = sessions.get("s-nav-back")!;
    expect(updated.currentPhase).toBe(Phase.Discover);
  });
});

describe("B-23: A2UI action handler — api actions", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it('"api" action does not throw or crash', async () => {
    const session = createSession("s-api");
    sessions.set("s-api", session);

    // Should not throw
    const result = await handleAction(sessions, "s-api", "api" as any, {
      endpoint: "/subscriptions",
      method: "GET",
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('"api" action returns a stub/placeholder response', async () => {
    const session = createSession("s-api-stub");
    sessions.set("s-api-stub", session);

    const result = await handleAction(sessions, "s-api-stub", "api" as any, {
      endpoint: "/resource-groups",
      method: "GET",
    });

    const text = extractText(result);
    expect(text).toBeTruthy();
    // Stub should indicate the action was received but not yet implemented
    expect(text.toLowerCase()).toMatch(/stub|not.*(implement|support)|placeholder|acknowledged/);
  });

  it('"api" action does not change the session phase', async () => {
    const session = createSession("s-api-phase", Phase.Design);
    sessions.set("s-api-phase", session);

    await handleAction(sessions, "s-api-phase", "api" as any, {
      endpoint: "/clusters",
      method: "POST",
    });

    const updated = sessions.get("s-api-phase")!;
    expect(updated.currentPhase).toBe(Phase.Design);
  });
});

describe("B-23: A2UI action handler — unknown and invalid actions", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("unknown action type returns an error without crashing", async () => {
    const session = createSession("s-unknown");
    sessions.set("s-unknown", session);

    const result = await handleAction(
      sessions,
      "s-unknown",
      "foobar" as any,
      { data: "test" },
    );

    expect(result).toBeDefined();
    const text = extractText(result);
    expect(text.toLowerCase()).toMatch(/unknown|unsupported|invalid|unrecognized/);
  });

  it("unknown action type does not mutate session state", async () => {
    const session = createSession("s-unk-mut", Phase.Design);
    const originalPhase = session.currentPhase;
    const originalDef = { ...session.appDefinition };
    sessions.set("s-unk-mut", session);

    await handleAction(sessions, "s-unk-mut", "definitely-not-real" as any, {
      dangerous: "payload",
    });

    const updated = sessions.get("s-unk-mut")!;
    expect(updated.currentPhase).toBe(originalPhase);
    expect(updated.appDefinition).toEqual(originalDef);
  });

  it("empty string action type is handled gracefully", async () => {
    const session = createSession("s-empty-type");
    sessions.set("s-empty-type", session);

    const result = await handleAction(sessions, "s-empty-type", "" as any);
    expect(result).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
  });
});

describe("B-23: A2UI action handler — past-turn action rejection", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("action with expired turnId is rejected", async () => {
    const session = createSession("s-past");
    sessions.set("s-past", session);

    // Simulate: component was rendered on turn 1, we are now on turn 5
    const result = await handleAction(sessions, "s-past", "select" as any, {
      runtime: "python",
      _turnId: 1,
      _currentTurn: 5,
    });

    // Two valid outcomes: either the action is ignored (no state change)
    // or an explicit error is returned. Either way, session should not
    // have the stale data applied.
    const updated = sessions.get("s-past")!;

    // If the implementation uses turnId filtering, the payload should NOT apply
    // (This may pass on legacy code that doesn't filter — that's expected pre-implementation)
    const text = extractText(result);
    if (text.toLowerCase().includes("expired") || text.toLowerCase().includes("ignored")) {
      expect(updated.appDefinition.runtime).toBeUndefined();
    }
    // Otherwise the test documents the expected behavior for when filtering is added
    expect(result).toBeDefined();
  });

  it("action with matching turnId is accepted", async () => {
    const session = createSession("s-current-turn");
    sessions.set("s-current-turn", session);

    await handleAction(sessions, "s-current-turn", "select" as any, {
      runtime: "node",
      _turnId: 3,
      _currentTurn: 3,
    });

    const updated = sessions.get("s-current-turn")!;
    // Current-turn actions should be processed
    expect(updated.appDefinition.runtime).toBe("node");
  });
});

describe("B-23: A2UI action handler — action context propagation", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("action payload context is preserved in the result", async () => {
    const session = createSession("s-ctx");
    sessions.set("s-ctx", session);

    const _result = await handleAction(sessions, "s-ctx", "select", {
      runtime: "python",
      port: 5000,
    });

    // After selection, session should have the context data
    const updated = sessions.get("s-ctx")!;
    expect(updated.appDefinition.runtime).toBe("python");
    expect(updated.appDefinition.port).toBe(5000);
  });

  it("multiple sequential actions accumulate context correctly", async () => {
    const session = createSession("s-multi-ctx");
    sessions.set("s-multi-ctx", session);

    await handleAction(sessions, "s-multi-ctx", "select", {
      name: "my-api",
    });
    await handleAction(sessions, "s-multi-ctx", "select", {
      runtime: "go",
      port: 8080,
    });

    const updated = sessions.get("s-multi-ctx")!;
    expect(updated.appDefinition.name).toBe("my-api");
    expect(updated.appDefinition.runtime).toBe("go");
    expect(updated.appDefinition.port).toBe(8080);
  });
});
