/**
 * Tests for agents-runner.ts
 *
 * Security focus (Zapp conditions):
 * - Principal ownership: runAgentTurn() MUST reject a mismatched principalId
 *   with a 403-equivalent error (cross-user resume/hijack prevention)
 * - isAgentsSdkEnabled() flag gate
 */

import { describe, expect, it } from "vitest";
import { createSession } from "./session-store.js";
import { isAgentsSdkEnabled, runAgentTurn } from "./agents-runner.js";

describe("isAgentsSdkEnabled", () => {
  it("returns false when KICKSTART_AGENTS_SDK is unset", () => {
    // Vitest clears env between tests; default is undefined
    expect(isAgentsSdkEnabled()).toBe(false);
  });

  it("returns true when KICKSTART_AGENTS_SDK=true", () => {
    const original = process.env.KICKSTART_AGENTS_SDK;
    try {
      process.env.KICKSTART_AGENTS_SDK = "true";
      expect(isAgentsSdkEnabled()).toBe(true);
    } finally {
      process.env.KICKSTART_AGENTS_SDK = original;
    }
  });
});

describe("runAgentTurn — principal ownership (Zapp negative test)", () => {
  it("throws 403 when principalId does not match session owner", async () => {
    // Session owned by alice
    const session = createSession("principal-alice");

    // Attempt to run as bob (cross-user hijack)
    const result = runAgentTurn({
      userMessage: "list all files",
      session,
      principalId: "principal-bob",
    });

    await expect(result).rejects.toThrow(
      "Session ownership mismatch",
    );

    // Error must carry status 403
    await expect(result).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when principalId is undefined and session has an owner", async () => {
    // Session owned — anonymous caller must be rejected
    const session = createSession("principal-alice");

    const result = runAgentTurn({
      userMessage: "show my resources",
      session,
      principalId: undefined,
    });

    await expect(result).rejects.toMatchObject({ status: 403 });
  });

  it("does NOT throw for a matching principalId (session proceeds to Azure call)", async () => {
    // Session owned by alice — alice calling is legitimate
    // We can't run the full agent without Azure credentials, so just verify the
    // ownership check passes and the error is NOT a 403.
    const session = createSession("principal-alice");

    const result = runAgentTurn({
      userMessage: "hello",
      session,
      principalId: "principal-alice",
    });

    // Should fail with a configuration/network error (no Azure creds in test),
    // NOT with a 403 ownership error.
    await expect(result).rejects.not.toMatchObject({ status: 403 });
  });

  it("does NOT throw for anonymous sessions (no principalId on session)", async () => {
    // Sessions without a principalId are accessible by anyone — legacy behaviour
    const session = createSession(); // no principalId

    const result = runAgentTurn({
      userMessage: "hello",
      session,
      principalId: "anyone",
    });

    // Should fail with config error, NOT ownership error
    await expect(result).rejects.not.toMatchObject({ status: 403 });
  });
});
