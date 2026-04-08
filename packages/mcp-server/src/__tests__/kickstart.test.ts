import { describe, it, expect, beforeEach } from "vitest";
import { handleKickstart, getEngineState } from "../tools/kickstart.js";
import type { SessionState } from "@kickstart/core";
import { Phase } from "@kickstart/core";

describe("handleKickstart", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  it("creates a new session and stores it in the sessions Map", async () => {
    expect(sessions.size).toBe(0);
    await handleKickstart(sessions);
    expect(sessions.size).toBe(1);
  });

  it("returns welcome text containing the session ID", async () => {
    const result = await handleKickstart(sessions);
    const [sessionId] = [...sessions.keys()];
    const textItems = result.content.filter((c) => c.type === "text");

    expect(textItems.length).toBeGreaterThanOrEqual(1);
    const welcomeText = (textItems[0] as { type: "text"; text: string }).text;
    expect(welcomeText).toContain(sessionId);
    expect(welcomeText).toContain("Kickstart");
  });

  it("initialises the session at the Discover phase", async () => {
    await handleKickstart(sessions);
    const [, session] = [...sessions.entries()][0];
    expect(session.currentPhase).toBe(Phase.Discover);
  });

  it("initialises engine state at Discover phase", async () => {
    await handleKickstart(sessions);
    const [sessionId] = [...sessions.keys()];
    const engineState = getEngineState(sessionId);
    expect(engineState).toBeDefined();
    expect(engineState!.currentPhase).toBe(Phase.Discover);
    expect(engineState!.isComplete).toBe(false);
  });

  it("stores the system prompt as a system message in the session", async () => {
    await handleKickstart(sessions);
    const [, session] = [...sessions.entries()][0];
    const systemMessages = session.messages.filter((m) => m.role === "system");
    expect(systemMessages.length).toBe(1);
    expect(systemMessages[0].content.length).toBeGreaterThan(0);
  });

  it("echoes the initial message in welcome text when provided", async () => {
    const result = await handleKickstart(sessions, "I want to deploy a Node.js app");
    const welcomeText = (result.content[0] as { type: "text"; text: string }).text;
    expect(welcomeText).toContain("I want to deploy a Node.js app");
  });

  it("stores the initial message as a user message in the session", async () => {
    await handleKickstart(sessions, "Deploy my Go API");
    const [, session] = [...sessions.entries()][0];
    const userMessages = session.messages.filter((m) => m.role === "user");
    expect(userMessages.length).toBe(1);
    expect(userMessages[0].content).toBe("Deploy my Go API");
  });

  it("shows fallback text when no initial message is provided", async () => {
    const result = await handleKickstart(sessions);
    const welcomeText = (result.content[0] as { type: "text"; text: string }).text;
    expect(welcomeText).toContain("Just describe your app");
  });

  it("does not store a user message when no initial message is provided", async () => {
    await handleKickstart(sessions);
    const [, session] = [...sessions.entries()][0];
    const userMessages = session.messages.filter((m) => m.role === "user");
    expect(userMessages.length).toBe(0);
  });

  // A2UI capability tests

  it('returns A2UI ConversationPhase resource when capability is "kickstart"', async () => {
    const result = await handleKickstart(sessions, undefined, "kickstart");
    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBe(1);

    const resource = resources[0] as {
      type: "resource";
      resource: { uri: string; mimeType: string; text: string };
    };
    expect(resource.resource.mimeType).toBe("application/json+a2ui");
    expect(resource.resource.uri).toContain("a2ui://kickstart/session/");
    expect(resource.resource.uri).toContain("/phase");

    const doc = JSON.parse(resource.resource.text);
    expect(doc.root.type).toBe("ConversationPhase");
    expect(doc.root.currentPhase).toBe(Phase.Discover);
  });

  it('returns degraded Card resource when capability is "basic"', async () => {
    const result = await handleKickstart(sessions, undefined, "basic");
    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBe(1);

    const doc = JSON.parse(
      (resources[0] as { type: "resource"; resource: { text: string } }).resource.text,
    );
    expect(doc.root.type).toBe("Card");
  });

  it('returns no A2UI resource when capability is "none"', async () => {
    const result = await handleKickstart(sessions, undefined, "none");
    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBe(0);
  });

  it("mentions safeguard count in the welcome text", async () => {
    const result = await handleKickstart(sessions);
    const welcomeText = (result.content[0] as { type: "text"; text: string }).text;
    expect(welcomeText).toMatch(/Safeguards.*\d+ deployment best practices/);
  });

  it("sets createdAt and updatedAt timestamps on the session", async () => {
    await handleKickstart(sessions);
    const [, session] = [...sessions.entries()][0];
    expect(session.createdAt).toBeTruthy();
    expect(session.updatedAt).toBeTruthy();
    // Both should be equal at creation time
    expect(session.createdAt).toBe(session.updatedAt);
  });

  it("generates unique session IDs for consecutive calls", async () => {
    await handleKickstart(sessions);
    await handleKickstart(sessions);
    const ids = [...sessions.keys()];
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
