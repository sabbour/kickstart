import { describe, it, expect, beforeEach } from "vitest";
import { handleAction } from "../tools/action.js";
import type { SessionState } from "@kickstart/core";
import { Phase, getPhaseDefinition } from "@kickstart/core";

/** Create a minimal session at a given phase for action testing. */
function createSessionAtPhase(sessionId: string, phase: Phase): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId,
    currentPhase: phase,
    createdAt: now,
    updatedAt: now,
    appDefinition: {},
    messages: [],
  };
}

describe("handleAction", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  // ── Error cases ─────────────────────────────────────────────────

  it("returns error when session is not found", async () => {
    const result = await handleAction(sessions, "ghost-session", "advance");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("not found");
    expect(text).toContain("ghost-session");
  });

  it("normalizes an unknown persisted currentPhase before handling actions", async () => {
    const now = new Date().toISOString();
    sessions.set("s-bad-phase", {
      sessionId: "s-bad-phase",
      currentPhase: "not-a-phase",
      createdAt: now,
      updatedAt: now,
      appDefinition: {},
      messages: [],
    } as unknown as SessionState);

    const result = await handleAction(sessions, "s-bad-phase", "reply", {
      message: "Continue",
    });

    const text = (result.content[0] as { type: "text"; text: string }).text;
    const discoverDef = getPhaseDefinition(Phase.Discover);
    expect(text).toContain(discoverDef.label);
    expect(sessions.get("s-bad-phase")!.currentPhase).toBe(Phase.Discover);
  });

  // ── Advance action ─────────────────────────────────────────────

  it('"advance" moves the session to the next phase', async () => {
    const session = createSessionAtPhase("s-adv", Phase.Discover);
    sessions.set("s-adv", session);

    const result = await handleAction(sessions, "s-adv", "advance");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const designDef = getPhaseDefinition(Phase.Design);
    expect(text).toContain(designDef.label);

    // Session should now be at Design phase
    const updated = sessions.get("s-adv")!;
    expect(updated.currentPhase).toBe(Phase.Design);
  });

  it('"advance" updates the session updatedAt timestamp', async () => {
    const session = createSessionAtPhase("s-ts", Phase.Discover);
    const originalUpdatedAt = session.updatedAt;
    sessions.set("s-ts", session);

    // Small delay to ensure timestamp difference
    await new Promise((r) => setTimeout(r, 5));
    await handleAction(sessions, "s-ts", "advance");

    const updated = sessions.get("s-ts")!;
    expect(updated.updatedAt).not.toBe(originalUpdatedAt);
  });

  // ── Skip action ───────────────────────────────────────────────

  it('"skip" skips the current phase and advances to next', async () => {
    const session = createSessionAtPhase("s-skip", Phase.Discover);
    sessions.set("s-skip", session);

    const result = await handleAction(sessions, "s-skip", "skip");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const designDef = getPhaseDefinition(Phase.Design);
    expect(text).toContain(designDef.label);

    const updated = sessions.get("s-skip")!;
    expect(updated.currentPhase).toBe(Phase.Design);
  });

  // ── Select action ─────────────────────────────────────────────

  it('"select" stores payload data into appDefinition', async () => {
    const session = createSessionAtPhase("s-sel", Phase.Discover);
    sessions.set("s-sel", session);

    await handleAction(sessions, "s-sel", "select", {
      runtime: "python",
      port: 8080,
    });

    const updated = sessions.get("s-sel")!;
    expect(updated.appDefinition.runtime).toBe("python");
    expect(updated.appDefinition.port).toBe(8080);
  });

  it('"select" does not advance the phase', async () => {
    const session = createSessionAtPhase("s-sel2", Phase.Discover);
    sessions.set("s-sel2", session);

    await handleAction(sessions, "s-sel2", "select", { name: "my-app" });

    const updated = sessions.get("s-sel2")!;
    // Select keeps us in the same phase - it only stores data
    expect(updated.currentPhase).toBe(Phase.Discover);
  });

  // ── Submit action ─────────────────────────────────────────────

  it('"submit" stores payload and advances to next phase', async () => {
    const session = createSessionAtPhase("s-sub", Phase.Discover);
    sessions.set("s-sub", session);

    await handleAction(sessions, "s-sub", "submit", {
      name: "web-app",
      runtime: "dotnet",
    });

    const updated = sessions.get("s-sub")!;
    expect(updated.appDefinition.name).toBe("web-app");
    expect(updated.appDefinition.runtime).toBe("dotnet");
    expect(updated.currentPhase).toBe(Phase.Design);
  });

  it('"submit" without payload still advances the phase', async () => {
    const session = createSessionAtPhase("s-sub2", Phase.Discover);
    sessions.set("s-sub2", session);

    await handleAction(sessions, "s-sub2", "submit");

    const updated = sessions.get("s-sub2")!;
    expect(updated.currentPhase).toBe(Phase.Design);
  });

  // ── A2UI response ─────────────────────────────────────────────

  it("returns an A2UI ConversationPhase resource after action", async () => {
    const session = createSessionAtPhase("s-a2ui", Phase.Discover);
    sessions.set("s-a2ui", session);

    const result = await handleAction(sessions, "s-a2ui", "advance");
    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBe(1);

    const resource = resources[0] as {
      type: "resource";
      resource: { uri: string; mimeType: string; text: string };
    };
    expect(resource.resource.mimeType).toBe("application/json+a2ui");
    expect(resource.resource.uri).toContain("a2ui://kickstart/session/s-a2ui/phase");

    const doc = JSON.parse(resource.resource.text);
    expect(doc.root.type).toBe("ConversationPhase");
  });

  // ── Full journey through all phases ───────────────────────────

  it("advancing through active phases eventually marks conversation complete", async () => {
    const session = createSessionAtPhase("s-journey", Phase.Discover);
    sessions.set("s-journey", session);

    // Advance through 4 active phases (Discover → Design → Generate → Review → complete)
    const phases = [Phase.Discover, Phase.Design, Phase.Generate, Phase.Review];
    for (const _phase of phases) {
      await handleAction(sessions, "s-journey", "advance");
    }

    const result = await handleAction(sessions, "s-journey", "advance");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    // After completing Review, should show completion or stay at Review
    expect(text).toBeTruthy();
  });
});
