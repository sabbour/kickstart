/**
 * Contract/schema tests for the system prompt and A2UI component catalog.
 *
 * These are static analysis tests — they import real modules and scan actual
 * strings at test time. No network, no mocks, no production code changes.
 *
 * Catches regressions in:
 *   1. Component name validity — every type in BASE_COMPONENT_CATALOG must be
 *      registered in KNOWN_COMPONENT_TYPES from a2ui-schema.ts.
 *   2. Prompt example integrity — every "component":"XYZ" reference found in
 *      the built system prompt must be a known registered type.
 *   3. Phantom reference detection — removed/phantom names must not appear
 *      anywhere in the system prompt string.
 */

import { describe, it, expect } from "vitest";
import { KNOWN_COMPONENT_TYPES } from "../services/a2ui-schema.js";
import {
  BASE_COMPONENT_CATALOG,
  generateComponentCatalogSection,
} from "../prompts/component-catalog.js";
import { KICKSTART_SYSTEM_PROMPT } from "../prompts/system-prompt.js";
import { Phase } from "../engine/types.js";
import { buildSystemPrompt } from "../prompts/system-prompt.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract all "component":"TypeName" values from a JSON-containing string.
 * This handles both pretty-printed and minified JSON embedded in prompt text.
 */
function extractComponentTypes(text: string): Set<string> {
  const found = new Set<string>();
  // Matches: "component":"TypeName" (with optional whitespace around colon)
  const pattern = /"component"\s*:\s*"([A-Za-z][A-Za-z0-9]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    found.add(match[1]);
  }
  return found;
}

// ---------------------------------------------------------------------------
// 1. Catalog completeness: BASE_COMPONENT_CATALOG ⊆ KNOWN_COMPONENT_TYPES
// ---------------------------------------------------------------------------

describe("catalog completeness — BASE_COMPONENT_CATALOG vs KNOWN_COMPONENT_TYPES", () => {
  it("every type in BASE_COMPONENT_CATALOG is registered in KNOWN_COMPONENT_TYPES", () => {
    const unregistered: string[] = [];
    for (const entry of BASE_COMPONENT_CATALOG) {
      if (!KNOWN_COMPONENT_TYPES.has(entry.type as never)) {
        unregistered.push(entry.type);
      }
    }
    expect(unregistered).toEqual([]);
  });

  it("catalog section includes all BASE_COMPONENT_CATALOG types by name", () => {
    const section = generateComponentCatalogSection();
    const missing: string[] = [];
    for (const entry of BASE_COMPONENT_CATALOG) {
      if (!section.includes(`- ${entry.type}:`)) {
        missing.push(entry.type);
      }
    }
    expect(missing).toEqual([]);
  });

  it("all component type references within catalog examples are valid registered types", () => {
    const section = generateComponentCatalogSection();
    const typesInExamples = extractComponentTypes(section);
    const invalid: string[] = [];
    for (const t of typesInExamples) {
      if (!KNOWN_COMPONENT_TYPES.has(t as never)) {
        invalid.push(t);
      }
    }
    expect(invalid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. System prompt example integrity
// ---------------------------------------------------------------------------

describe("system prompt example integrity — component types match schema", () => {
  it("all component type references in KICKSTART_SYSTEM_PROMPT are registered", () => {
    const typesInPrompt = extractComponentTypes(KICKSTART_SYSTEM_PROMPT);
    const invalid: string[] = [];
    for (const t of typesInPrompt) {
      if (!KNOWN_COMPONENT_TYPES.has(t as never)) {
        invalid.push(t);
      }
    }
    expect(invalid).toEqual([]);
  });

  it("all component type references in buildSystemPrompt(Discover) are registered", () => {
    const prompt = buildSystemPrompt({ phase: Phase.Discover });
    const typesInPrompt = extractComponentTypes(prompt);
    const invalid: string[] = [];
    for (const t of typesInPrompt) {
      if (!KNOWN_COMPONENT_TYPES.has(t as never)) {
        invalid.push(t);
      }
    }
    expect(invalid).toEqual([]);
  });

  it("all component type references in buildSystemPrompt(Generate) are registered", () => {
    const prompt = buildSystemPrompt({ phase: Phase.Generate });
    const typesInPrompt = extractComponentTypes(prompt);
    const invalid: string[] = [];
    for (const t of typesInPrompt) {
      if (!KNOWN_COMPONENT_TYPES.has(t as never)) {
        invalid.push(t);
      }
    }
    expect(invalid).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. Phantom reference detection
// ---------------------------------------------------------------------------

describe("phantom reference detection — removed names must not appear in prompt", () => {
  const phantomNames = [
    "DeploymentProgress", // renamed to GenerationProgress in PR #356
    "next-card",          // confirmed phantom in PR #372
    "EndpointSlice",      // never a valid A2UI component type
  ];

  for (const name of phantomNames) {
    it(`"${name}" does not appear in KICKSTART_SYSTEM_PROMPT`, () => {
      expect(KICKSTART_SYSTEM_PROMPT).not.toContain(name);
    });

    it(`"${name}" does not appear in buildSystemPrompt(Discover)`, () => {
      const prompt = buildSystemPrompt({ phase: Phase.Discover });
      expect(prompt).not.toContain(name);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Cross-reference integrity: KNOWN_COMPONENT_TYPES coverage
// ---------------------------------------------------------------------------

describe("KNOWN_COMPONENT_TYPES self-consistency", () => {
  it("KNOWN_COMPONENT_TYPES is a non-empty Set", () => {
    expect(KNOWN_COMPONENT_TYPES.size).toBeGreaterThan(0);
  });

  it("GenerationProgress is registered (post-rename from DeploymentProgress)", () => {
    expect(KNOWN_COMPONENT_TYPES.has("GenerationProgress" as never)).toBe(true);
  });

  it("DeploymentProgress is NOT registered (was renamed to GenerationProgress)", () => {
    expect(KNOWN_COMPONENT_TYPES.has("DeploymentProgress" as never)).toBe(false);
  });
});
