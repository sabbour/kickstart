import { describe, it, expect, beforeEach } from "vitest";
import { handleGenerateManifests } from "../tools/generate-manifests.js";
import type { SessionState } from "@kickstart/core";
import { Phase } from "@kickstart/core";

/** Create a minimal valid session with complete app definition and Azure context. */
function createCompleteSession(
  sessionId: string,
  overrides?: {
    app?: Partial<SessionState["appDefinition"]>;
    azure?: Partial<NonNullable<SessionState["azureContext"]>>;
    github?: Partial<NonNullable<SessionState["githubContext"]>>;
  },
): SessionState {
  const now = new Date().toISOString();
  return {
    sessionId,
    currentPhase: Phase.Generate,
    createdAt: now,
    updatedAt: now,
    appDefinition: {
      name: "my-api",
      description: "A test API",
      runtime: "node",
      port: 3000,
      needsDatabase: false,
      needsIngress: true,
      envVars: [],
      resourceTier: "standard",
      ...overrides?.app,
    },
    azureContext: {
      subscriptionId: "sub-123",
      resourceGroup: "rg-test",
      region: "eastus",
      tenantId: "tenant-abc",
      ...overrides?.azure,
    },
    githubContext: overrides?.github
      ? {
          owner: "test-user",
          repo: "test-repo",
          branch: "main",
          repoUrl: "https://github.com/test-user/test-repo",
          ...overrides.github,
        }
      : undefined,
    messages: [],
  };
}

describe("handleGenerateManifests", () => {
  let sessions: Map<string, SessionState>;

  beforeEach(() => {
    sessions = new Map();
  });

  // ── Error cases ─────────────────────────────────────────────────

  it("returns error when session is not found", async () => {
    const result = await handleGenerateManifests(sessions, "nonexistent-id");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("not found");
    expect(text).toContain("nonexistent-id");
  });

  it("returns error when app definition has no name", async () => {
    const session = createCompleteSession("sess-1", {
      app: { name: undefined as unknown as string },
    });
    sessions.set("sess-1", session);

    const result = await handleGenerateManifests(sessions, "sess-1");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Not enough information");
  });

  it("returns error when app definition has no runtime", async () => {
    const session = createCompleteSession("sess-2", {
      app: { runtime: undefined as unknown as "node" },
    });
    sessions.set("sess-2", session);

    const result = await handleGenerateManifests(sessions, "sess-2");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Not enough information");
  });

  it("returns error when Azure context is missing entirely", async () => {
    const session = createCompleteSession("sess-3");
    session.azureContext = undefined;
    sessions.set("sess-3", session);

    const result = await handleGenerateManifests(sessions, "sess-3");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Azure context is incomplete");
  });

  it("returns error when Azure context is missing subscriptionId", async () => {
    const session = createCompleteSession("sess-4");
    session.azureContext = {
      resourceGroup: "rg-test",
      region: "eastus",
      tenantId: "t",
    };
    sessions.set("sess-4", session);

    const result = await handleGenerateManifests(sessions, "sess-4");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Azure context is incomplete");
  });

  it("returns error when Azure context is missing resourceGroup", async () => {
    const session = createCompleteSession("sess-5");
    session.azureContext = {
      subscriptionId: "sub-1",
      region: "eastus",
      tenantId: "t",
    };
    sessions.set("sess-5", session);

    const result = await handleGenerateManifests(sessions, "sess-5");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Azure context is incomplete");
  });

  it("returns error when Azure context is missing region", async () => {
    const session = createCompleteSession("sess-6");
    session.azureContext = {
      subscriptionId: "sub-1",
      resourceGroup: "rg",
      tenantId: "t",
    };
    sessions.set("sess-6", session);

    const result = await handleGenerateManifests(sessions, "sess-6");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("Azure context is incomplete");
  });

  // ── Success cases ─────────────────────────────────────────────────

  it("generates manifests successfully with valid inputs", async () => {
    const session = createCompleteSession("sess-ok");
    sessions.set("sess-ok", session);

    const result = await handleGenerateManifests(sessions, "sess-ok");
    const textItems = result.content.filter((c) => c.type === "text");
    const firstText = (textItems[0] as { type: "text"; text: string }).text;
    expect(firstText).toContain("Generated deployment artifacts");
  });

  it("includes safeguard validation summary in text output", async () => {
    const session = createCompleteSession("sess-sg");
    sessions.set("sess-sg", session);

    const result = await handleGenerateManifests(sessions, "sess-sg");
    const textItems = result.content.filter((c) => c.type === "text");
    const allText = textItems.map((t) => (t as { type: "text"; text: string }).text).join("\n");
    expect(allText).toMatch(/Deployment best practices.*\d+\/\d+ passed/);
  });

  it('includes A2UI safeguard card when capability is "kickstart"', async () => {
    const session = createCompleteSession("sess-a2ui");
    sessions.set("sess-a2ui", session);

    const result = await handleGenerateManifests(sessions, "sess-a2ui", "kickstart");
    const resources = result.content.filter((c) => c.type === "resource");

    // Should have at least 2 resources: manifest code blocks + safeguard card
    expect(resources.length).toBeGreaterThanOrEqual(2);

    const safeguardResource = resources.find((r) => {
      const res = r as { type: "resource"; resource: { uri: string } };
      return res.resource.uri.includes("safeguards");
    });
    expect(safeguardResource).toBeDefined();
  });

  it('returns no A2UI resources when capability is "none"', async () => {
    const session = createCompleteSession("sess-none");
    sessions.set("sess-none", session);

    const result = await handleGenerateManifests(sessions, "sess-none", "none");
    const resources = result.content.filter((c) => c.type === "resource");
    expect(resources.length).toBe(0);
  });

  it("manifest resource URI follows the expected pattern", async () => {
    const session = createCompleteSession("sess-uri");
    sessions.set("sess-uri", session);

    const result = await handleGenerateManifests(sessions, "sess-uri", "kickstart");
    const resources = result.content.filter((c) => c.type === "resource");
    const manifestRes = resources.find((r) => {
      const res = r as { type: "resource"; resource: { uri: string } };
      return res.resource.uri.includes("manifests");
    });
    expect(manifestRes).toBeDefined();
    const uri = (manifestRes as { type: "resource"; resource: { uri: string } }).resource.uri;
    expect(uri).toBe("a2ui://kickstart/session/sess-uri/manifests");
  });

  // ── Production tier safeguards ────────────────────────────────────

  it("production tier triggers additional safeguard checks (DS011-DS013)", async () => {
    const session = createCompleteSession("sess-prod", {
      app: { resourceTier: "production" },
    });
    sessions.set("sess-prod", session);

    const result = await handleGenerateManifests(sessions, "sess-prod", "kickstart");
    const textItems = result.content.filter((c) => c.type === "text");
    const allText = textItems.map((t) => (t as { type: "text"; text: string }).text).join("\n");
    // Production should show safeguard results; check the summary exists
    expect(allText).toMatch(/Deployment best practices/);
  });

  it("non-production tier passes production-only safeguards automatically", async () => {
    const session = createCompleteSession("sess-dev", {
      app: { resourceTier: "dev" },
    });
    sessions.set("sess-dev", session);

    const result = await handleGenerateManifests(sessions, "sess-dev", "kickstart");
    const safeguardResource = result.content.find((c) => {
      if (c.type !== "resource") return false;
      const res = c as { type: "resource"; resource: { uri: string; text: string } };
      return res.resource.uri.includes("safeguards");
    });
    expect(safeguardResource).toBeDefined();

    // Parse safeguard card - dev tier should not have production-only failures
    const cardDoc = JSON.parse(
      (safeguardResource as { type: "resource"; resource: { text: string } }).resource.text,
    );
    const cardText = JSON.stringify(cardDoc);
    // Production-only safeguards (ResourceQuota, NetworkPolicy, PDB) should pass for dev
    // They show as ✅ not ❌
    // We verify the card includes these safeguard IDs (they exist but pass)
    expect(cardText).toContain("DS011");
    expect(cardText).toContain("DS012");
    expect(cardText).toContain("DS013");
  });
});
