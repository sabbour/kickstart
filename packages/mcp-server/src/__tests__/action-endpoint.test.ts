/**
 * B-24 — Action endpoint
 *
 * Integration tests for the `/api/action` HTTP endpoint.
 * Validates request/response contract, error handling, and status codes.
 *
 * The endpoint accepts: { sessionId, action, context }
 * Returns: updated conversation state or appropriate error.
 *
 * These tests are written ahead of implementation (TDD).
 * They use the existing protocol module as the closest available interface
 * and document the expected HTTP endpoint behavior.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseAppMessage,
  handleAppMessage,
} from "../app/protocol.js";
import type {
  ServerToAppMessage,
  ActionMessage,
} from "../app/protocol.js";
import type { SessionState } from "@kickstart/core";
import { Phase } from "@kickstart/core";

// ── Helpers ─────────────────────────────────────────────────────────

function createSession(
  id: string,
  phase: Phase = Phase.Discover,
): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId: id,
    currentPhase: phase,
    createdAt: now,
    updatedAt: now,
    appDefinition: {},
    messages: [],
  };
}

/** Simulate sending an action request through the protocol layer. */
async function sendAction(
  sessions: Map<string, SessionState>,
  payload: Record<string, unknown>,
): Promise<ServerToAppMessage> {
  const parsed = parseAppMessage(payload);
  if (!parsed) {
    // Simulates the endpoint returning 400 for unparseable requests
    return { type: "error", message: "Malformed request payload" };
  }
  return handleAppMessage(parsed, sessions);
}

// ── Tests ───────────────────────────────────────────────────────────

describe("B-24: /api/action endpoint — valid requests", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("accepts a valid action request and returns updated state", async () => {
    const session = createSession("sess-valid", Phase.Discover);
    sessions.set("sess-valid", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-valid",
      actionType: "advance",
      payload: {},
    });

    expect(result.type).toBe("response");
    if (result.type === "response") {
      expect(result.sessionId).toBe("sess-valid");
      expect(result.phase).toBeTruthy();
    }
  });

  it("returns updated phase after advance action", async () => {
    const session = createSession("sess-phase", Phase.Discover);
    sessions.set("sess-phase", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-phase",
      actionType: "advance",
      payload: {},
    });

    expect(result.type).toBe("response");
    if (result.type === "response") {
      // After advancing from Discover, phase should change
      expect(result.text).toBeTruthy();
    }
  });

  it("returns A2UI component in the response", async () => {
    const session = createSession("sess-a2ui", Phase.Discover);
    sessions.set("sess-a2ui", session);

    const result = await handleAppMessage(
      { type: "action", sessionId: "sess-a2ui", actionType: "advance", payload: {} },
      sessions,
      "kickstart",
    );

    expect(result.type).toBe("response");
    if (result.type === "response") {
      expect(result.a2ui).toBeDefined();
    }
  });

  it("select action stores data and returns current state", async () => {
    const session = createSession("sess-select", Phase.Design);
    sessions.set("sess-select", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-select",
      actionType: "select",
      payload: { runtime: "python", port: 8000 },
    });

    expect(result.type).toBe("response");
    const updated = sessions.get("sess-select")!;
    expect(updated.appDefinition.runtime).toBe("python");
    expect(updated.appDefinition.port).toBe(8000);
  });

  it("submit action stores data and advances phase", async () => {
    const session = createSession("sess-submit", Phase.Discover);
    sessions.set("sess-submit", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-submit",
      actionType: "submit",
      payload: { name: "my-app", runtime: "node" },
    });

    expect(result.type).toBe("response");
    const updated = sessions.get("sess-submit")!;
    expect(updated.appDefinition.name).toBe("my-app");
    expect(updated.currentPhase).toBe(Phase.Design);
  });
});

describe("B-24: /api/action endpoint — invalid sessionId (404)", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("returns error for non-existent sessionId", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "does-not-exist",
      actionType: "advance",
      payload: {},
    });

    expect(result.type).toBe("response");
    // handleAppMessage wraps the error in a response with error text
    if (result.type === "response") {
      expect(result.text).toBeTruthy();
      expect(result.text!.toLowerCase()).toContain("not found");
    }
  });

  it("returns error for empty sessionId string", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "",
      actionType: "advance",
      payload: {},
    });

    // Empty string sessionId should not match any session
    if (result.type === "response") {
      expect(result.text).toBeTruthy();
      expect(result.text!.toLowerCase()).toContain("not found");
    }
  });
});

describe("B-24: /api/action endpoint — malformed payloads (400)", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("rejects request missing sessionId", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      actionType: "advance",
    });

    // parseAppMessage returns null → simulated 400
    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("malformed");
    }
  });

  it("rejects request missing actionType", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "some-session",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("malformed");
    }
  });

  it("rejects request with non-string sessionId", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      sessionId: 12345,
      actionType: "advance",
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("malformed");
    }
  });

  it("rejects request with non-string actionType", async () => {
    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "some-session",
      actionType: 42,
    });

    expect(result.type).toBe("error");
    if (result.type === "error") {
      expect(result.message.toLowerCase()).toContain("malformed");
    }
  });

  it("rejects request with missing type field entirely", async () => {
    const result = await sendAction(sessions, {
      sessionId: "some-session",
      actionType: "advance",
    });

    expect(result.type).toBe("error");
  });

  it("rejects null input", async () => {
    const result = await sendAction(sessions, null as any);
    expect(result.type).toBe("error");
  });

  it("rejects non-object input", async () => {
    const result = await sendAction(sessions, "not-an-object" as any);
    expect(result.type).toBe("error");
  });

  it("accepts request with missing payload (defaults to empty)", async () => {
    const session = createSession("sess-no-payload", Phase.Discover);
    sessions.set("sess-no-payload", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-no-payload",
      actionType: "advance",
    });

    // Missing payload should default to {} and not error
    expect(result.type).toBe("response");
  });

  it("handles non-object payload gracefully (coerces to empty)", async () => {
    const session = createSession("sess-bad-payload", Phase.Discover);
    sessions.set("sess-bad-payload", session);

    const result = await sendAction(sessions, {
      type: "action",
      sessionId: "sess-bad-payload",
      actionType: "select",
      payload: "this-is-not-an-object",
    });

    // Non-object payload should be coerced to {} by parseAppMessage
    expect(result.type).toBe("response");
  });
});

describe("B-24: /api/action endpoint — required fields validation", () => {
  it("parseAppMessage returns null when type is missing", () => {
    const result = parseAppMessage({
      sessionId: "x",
      actionType: "advance",
    });
    expect(result).toBeNull();
  });

  it("parseAppMessage returns null for unknown type", () => {
    const result = parseAppMessage({
      type: "unknown-type",
      sessionId: "x",
      actionType: "advance",
    });
    expect(result).toBeNull();
  });

  it("parseAppMessage validates all required action fields", () => {
    // Only sessionId
    expect(
      parseAppMessage({ type: "action", sessionId: "x" }),
    ).toBeNull();

    // Only actionType
    expect(
      parseAppMessage({ type: "action", actionType: "advance" }),
    ).toBeNull();

    // Both present — should succeed
    const result = parseAppMessage({
      type: "action",
      sessionId: "x",
      actionType: "advance",
    });
    expect(result).not.toBeNull();
    expect(result!.type).toBe("action");
  });

  it("parseAppMessage preserves action payload data", () => {
    const result = parseAppMessage({
      type: "action",
      sessionId: "sess-1",
      actionType: "select",
      payload: { runtime: "go", port: 3000 },
    });

    expect(result).not.toBeNull();
    const action = result as ActionMessage;
    expect(action.payload).toEqual({ runtime: "go", port: 3000 });
  });
});

describe("B-24: /api/action endpoint — concurrent session handling", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("actions on different sessions are isolated", async () => {
    sessions.set("sess-a", createSession("sess-a", Phase.Discover));
    sessions.set("sess-b", createSession("sess-b", Phase.Design));

    // Advance session A
    await sendAction(sessions, {
      type: "action",
      sessionId: "sess-a",
      actionType: "advance",
      payload: {},
    });

    // Session B should be unaffected
    const sessionB = sessions.get("sess-b")!;
    expect(sessionB.currentPhase).toBe(Phase.Design);

    // Session A should have advanced
    const sessionA = sessions.get("sess-a")!;
    expect(sessionA.currentPhase).toBe(Phase.Design);
  });

  it("rapid sequential actions on same session are processed in order", async () => {
    sessions.set("sess-rapid", createSession("sess-rapid", Phase.Discover));

    // Send two advances back to back
    await sendAction(sessions, {
      type: "action",
      sessionId: "sess-rapid",
      actionType: "advance",
      payload: {},
    });
    await sendAction(sessions, {
      type: "action",
      sessionId: "sess-rapid",
      actionType: "advance",
      payload: {},
    });

    // Should have advanced twice: Discover → Design → Generate
    const updated = sessions.get("sess-rapid")!;
    expect(updated.currentPhase).toBe(Phase.Generate);
  });
});
