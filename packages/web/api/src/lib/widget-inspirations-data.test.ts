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
  stripMarkdown,
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

// ---------------------------------------------------------------------------
// stripMarkdown
// ---------------------------------------------------------------------------

describe("stripMarkdown", () => {
  it("returns plain text unchanged", () => {
    const plain = "I want to build a pod dashboard with live metrics.";
    expect(stripMarkdown(plain)).toBe(plain);
  });

  it("strips bold markers (**text** and __text__)", () => {
    expect(stripMarkdown("Use a **Column** as the root")).toBe(
      "Use a Column as the root",
    );
    expect(stripMarkdown("Use a __Column__ as the root")).toBe(
      "Use a Column as the root",
    );
  });

  it("strips italic markers (*text* and _text_)", () => {
    expect(stripMarkdown("Add a *subtle* hint")).toBe("Add a subtle hint");
    expect(stripMarkdown("Add a _subtle_ hint")).toBe("Add a subtle hint");
  });

  it("strips bold-italic markers (***text*** and ___text___)", () => {
    expect(stripMarkdown("A ***critical*** alert")).toBe("A critical alert");
    expect(stripMarkdown("A ___critical___ alert")).toBe("A critical alert");
  });

  it("strips heading prefixes", () => {
    expect(stripMarkdown("# Heading 1\n## Heading 2\n### Heading 3")).toBe(
      "Heading 1\nHeading 2\nHeading 3",
    );
  });

  it("strips horizontal rules", () => {
    expect(stripMarkdown("Above\n---\nBelow")).toBe("Above\n\nBelow");
    expect(stripMarkdown("Above\n***\nBelow")).toBe("Above\n\nBelow");
    expect(stripMarkdown("Above\n___\nBelow")).toBe("Above\n\nBelow");
  });

  it("strips inline code backticks", () => {
    expect(stripMarkdown("Use the `Button` component")).toBe(
      "Use the Button component",
    );
  });

  it("strips fenced code blocks but keeps content", () => {
    const input = "Before\n```json\n{\"key\": \"value\"}\n```\nAfter";
    expect(stripMarkdown(input)).toBe('Before\n{"key": "value"}\nAfter');
  });

  it("strips blockquotes", () => {
    expect(stripMarkdown("> This is a quote")).toBe("This is a quote");
  });

  it("strips unordered list bullets", () => {
    expect(stripMarkdown("- Item one\n- Item two")).toBe(
      "Item one\nItem two",
    );
    expect(stripMarkdown("* Item one\n* Item two")).toBe(
      "Item one\nItem two",
    );
  });

  it("strips ordered list prefixes", () => {
    expect(stripMarkdown("1. First\n2. Second\n3. Third")).toBe(
      "First\nSecond\nThird",
    );
  });

  it("converts links to text", () => {
    expect(stripMarkdown("See [the docs](https://example.com) for more")).toBe(
      "See the docs for more",
    );
  });

  it("converts images to alt text", () => {
    expect(stripMarkdown("![logo](https://example.com/logo.png)")).toBe(
      "logo",
    );
  });

  it("collapses excessive blank lines", () => {
    expect(stripMarkdown("A\n\n\n\n\nB")).toBe("A\n\nB");
  });

  it("handles a realistic LLM response with mixed markdown", () => {
    const llmOutput = `### AKS Node Pool Monitor

**Description:** A real-time node pool health panel.

- Shows node status via a Table
- Uses **Badges** for health indicators
- Includes a *progress bar* for capacity

---

Use a \`Column\` as the root.`;

    const cleaned = stripMarkdown(llmOutput);
    expect(cleaned).not.toContain("###");
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("---");
    expect(cleaned).not.toContain("`");
    expect(cleaned).toContain("AKS Node Pool Monitor");
    expect(cleaned).toContain("Column");
    expect(cleaned).toContain("Badges");
  });
});
