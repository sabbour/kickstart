/**
 * Unit tests for widget-inspirations data helpers.
 *
 * Covers:
 * - `pickFallbackIdea()` — returns a valid idea and avoids immediate repeats
 * - `nextFocusDomain()` — advances deterministically and wraps around the
 *   FOCUS_DOMAINS list
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_IDEAS,
  FOCUS_DOMAINS,
  _resetFocusCursorForTests,
  _resetLastFallbackIdxForTests,
  nextFocusDomain,
  pickFallbackIdea,
} from "./widget-inspirations-data.js";

// ---------------------------------------------------------------------------
// pickFallbackIdea
// ---------------------------------------------------------------------------

describe("pickFallbackIdea", () => {
  beforeEach(() => {
    _resetLastFallbackIdxForTests(-1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a valid WidgetIdea drawn from FALLBACK_IDEAS", () => {
    const idea = pickFallbackIdea();
    expect(FALLBACK_IDEAS).toContain(idea);
    expect(idea.title).toBeTypeOf("string");
    expect(idea.subtitle).toBeTypeOf("string");
    expect(idea.prompt).toBeTypeOf("string");
    expect(idea.prompt.length).toBeGreaterThan(0);
  });

  it("never returns the same idea on two consecutive calls", () => {
    // Pin Math.random so the naive index == lastFallbackIdx; the helper
    // must bump to the next index rather than repeat.
    _resetLastFallbackIdxForTests(3);
    vi.spyOn(Math, "random").mockReturnValue(3 / FALLBACK_IDEAS.length);

    const idea = pickFallbackIdea();
    const expectedIdx = (3 + 1) % FALLBACK_IDEAS.length;
    expect(idea).toBe(FALLBACK_IDEAS[expectedIdx]);
  });

  it("does not repeat across many sequential calls", () => {
    let last: string | null = null;
    for (let i = 0; i < 40; i++) {
      const next = pickFallbackIdea().title;
      if (last !== null) {
        expect(next).not.toBe(last);
      }
      last = next;
    }
  });

  it("handles the Math.random() === 0 edge case without repeating", () => {
    _resetLastFallbackIdxForTests(0);
    vi.spyOn(Math, "random").mockReturnValue(0);

    const idea = pickFallbackIdea();
    expect(idea).toBe(FALLBACK_IDEAS[1]);
  });
});

// ---------------------------------------------------------------------------
// nextFocusDomain
// ---------------------------------------------------------------------------

describe("nextFocusDomain", () => {
  beforeEach(() => {
    _resetFocusCursorForTests(0);
  });

  it("returns the FOCUS_DOMAINS entry at the current cursor", () => {
    expect(nextFocusDomain()).toBe(FOCUS_DOMAINS[0]);
    expect(nextFocusDomain()).toBe(FOCUS_DOMAINS[1]);
  });

  it("cycles through every focus domain over N calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < FOCUS_DOMAINS.length; i++) {
      seen.add(nextFocusDomain());
    }
    expect(seen.size).toBe(FOCUS_DOMAINS.length);
    for (const domain of FOCUS_DOMAINS) {
      expect(seen.has(domain)).toBe(true);
    }
  });

  it("wraps around after reaching the end of FOCUS_DOMAINS", () => {
    _resetFocusCursorForTests(FOCUS_DOMAINS.length - 1);
    expect(nextFocusDomain()).toBe(FOCUS_DOMAINS[FOCUS_DOMAINS.length - 1]);
    expect(nextFocusDomain()).toBe(FOCUS_DOMAINS[0]);
  });
});
