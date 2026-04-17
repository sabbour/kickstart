/**
 * Contract test for the custom Kickstart component count (Issue #433).
 *
 * docs-site/docs/architecture/overview.md and
 * docs-site/docs/components/custom-catalog.md both document "22 custom components".
 * This test enforces that the actual file count stays in sync with the documentation.
 *
 * When adding a new custom component:
 *   1. Bump CUSTOM_COMPONENT_COUNT below
 *   2. Update docs-site/docs/architecture/overview.md
 *   3. Update docs-site/docs/components/custom-catalog.md
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** Canonical count — matches the "22 custom components" stated in docs */
const CUSTOM_COMPONENT_COUNT = 22;

const customComponentsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/web/src/catalog/components",
);

/**
 * The expected set of custom component implementations.
 * Any addition or removal of a component must update this list, the count above,
 * and the two documentation files referenced in the header comment.
 */
const EXPECTED_CUSTOM_COMPONENTS = [
  "ArchitectureDiagram",
  "AuthCard",
  "AzureAction",
  "AzureLoginCard",
  "AzureResourceForm",
  "AzureResourcePicker",
  "CodeBlock",
  "CostEstimate",
  "DecisionCard",
  "FileEditor",
  "FormGroup",
  "GenerationProgress",
  "GitHubAction",
  "GitHubCommit",
  "GitHubLoginCard",
  "GitHubRepoPicker",
  "Markdown",
  "ProgressSteps",
  "Questionnaire",
  "RadioGroup",
  "SteppedCarousel",
  "SummaryCard",
];

describe("custom Kickstart component catalog contract", () => {
  it(`has exactly ${CUSTOM_COMPONENT_COUNT} .tsx component implementations`, () => {
    const componentFiles = readdirSync(customComponentsDir).filter((f) =>
      f.endsWith(".tsx"),
    );
    expect(componentFiles).toHaveLength(CUSTOM_COMPONENT_COUNT);
  });

  it("component list matches expected set", () => {
    const componentFiles = readdirSync(customComponentsDir)
      .filter((f) => f.endsWith(".tsx"))
      .map((f) => f.replace(".tsx", ""))
      .sort();

    expect(componentFiles).toEqual([...EXPECTED_CUSTOM_COMPONENTS].sort());
  });
});
