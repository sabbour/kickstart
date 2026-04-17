/**
 * Phase guard tests — advancePhase() and isPhase()
 *
 * Tests for:
 *   • advancePhase — normal progression through all phases
 *   • advancePhase — terminal phase (Deploy) stays at Deploy
 *   • advancePhase — invalid/stale phase string falls back to Discover (no throw)
 *   • advancePhase — empty string falls back to Discover (no throw)
 *   • isPhase — type guard accepts valid Phase enum values
 *   • isPhase — type guard rejects invalid strings
 */

import { describe, it, expect } from "vitest";
import { Phase } from "../engine/types.js";
import { advancePhase, isPhase } from "../engine/phases.js";

describe("advancePhase", () => {
  it("advances Discover → Design", () => {
    expect(advancePhase(Phase.Discover)).toBe(Phase.Design);
  });

  it("advances Design → Generate", () => {
    expect(advancePhase(Phase.Design)).toBe(Phase.Generate);
  });

  it("advances Generate → Review", () => {
    expect(advancePhase(Phase.Generate)).toBe(Phase.Review);
  });

  it("advances Review → Handoff", () => {
    expect(advancePhase(Phase.Review)).toBe(Phase.Handoff);
  });

  it("advances Handoff → Deploy", () => {
    expect(advancePhase(Phase.Handoff)).toBe(Phase.Deploy);
  });

  it("stays at Deploy (terminal phase)", () => {
    expect(advancePhase(Phase.Deploy)).toBe(Phase.Deploy);
  });

  it("falls back to Discover for an unknown string (no throw)", () => {
    expect(advancePhase("stale_phase_from_old_session")).toBe(Phase.Discover);
  });

  it("falls back to Discover for an empty string (no throw)", () => {
    expect(advancePhase("")).toBe(Phase.Discover);
  });

  it("falls back to Discover for a completely random string (no throw)", () => {
    expect(advancePhase("INVALID")).toBe(Phase.Discover);
  });
});

describe("isPhase", () => {
  it("returns true for all valid Phase enum values", () => {
    for (const p of Object.values(Phase)) {
      expect(isPhase(p)).toBe(true);
    }
  });

  it("returns false for an invalid string", () => {
    expect(isPhase("stale_phase")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isPhase("")).toBe(false);
  });

  it("returns false for a near-miss casing variant", () => {
    expect(isPhase("Discover")).toBe(false);
  });
});
