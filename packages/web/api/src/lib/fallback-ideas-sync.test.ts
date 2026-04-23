/**
 * Fallback ideas sync test (Nibbler/Leela feedback on PR #990).
 *
 * The server owns the canonical `FALLBACK_IDEAS` at
 * `packages/web/api/src/lib/widget-inspirations-data.ts`. The client mirror
 * at `packages/web/src/lib/fallback-ideas.ts` must stay byte-for-byte
 * equal so the offline Playground experience matches what the API would
 * return when Azure OpenAI is unconfigured.
 *
 * This test fails CI if either side drifts — forcing whichever PR
 * introduces the drift to update both files together.
 */

import { describe, expect, it } from "vitest";
import { FALLBACK_IDEAS } from "./widget-inspirations-data.js";
import { FALLBACK_WIDGET_IDEAS } from "../../../src/lib/fallback-ideas.js";

describe("FALLBACK_IDEAS sync (server ↔ client)", () => {
  it("client mirror matches the server canonical list exactly", () => {
    expect(FALLBACK_WIDGET_IDEAS).toEqual(FALLBACK_IDEAS);
  });

  it("both lists contain the same titles in the same order", () => {
    const serverTitles = FALLBACK_IDEAS.map((i) => i.title);
    const clientTitles = FALLBACK_WIDGET_IDEAS.map((i) => i.title);
    expect(clientTitles).toEqual(serverTitles);
  });
});
