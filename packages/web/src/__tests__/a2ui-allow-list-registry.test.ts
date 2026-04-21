/**
 * Allow-list ↔ client registry guard (Nibbler feedback on PR #990).
 *
 * The Create-tab inspirations endpoint restricts the LLM to an allow-list
 * of A2UI component type names (see
 * `packages/web/api/src/lib/widget-inspirations-data.ts::ALLOWED_A2UI_COMPONENTS`).
 * Every entry on that allow-list MUST correspond to a component
 * registered in `ClientComponentRegistry`; otherwise the LLM will
 * legitimately emit an allow-listed component whose renderer is missing,
 * and the chat will silently render `_ErrorComponent` — the exact failure
 * mode the "clean-break unknown component → error MessageBar" work for
 * #989 was designed to surface.
 *
 * Keep this test in place as a structural guard.
 */

import { describe, expect, it } from "vitest";
import {
  ClientComponentRegistry,
} from "../contexts/A2UIRegistryContext";
import { fluentOverrides } from "../catalog/fluent-components/index";
import {
  AuthCard,
  AzureAction,
  AzureLoginCard,
  AzureResourceForm,
  AzureResourcePicker,
  CodeBlock,
  CostEstimate,
  DecisionCard,
  FileEditor,
  FormGroup,
  GenerationProgress,
  GitHubAction,
  GitHubCommit,
  GitHubLoginCard,
  GitHubRepoPicker,
  Markdown,
  ProgressSteps,
  Questionnaire,
  RadioGroup,
  SteppedCarousel,
  SummaryCard,
} from "../catalog/components/index";
import { ALLOWED_A2UI_COMPONENTS } from "../../api/src/lib/widget-inspirations-data";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Build a sealed registry populated exactly like `main.tsx` does at
 * bootstrap. Keep this list in sync with the registrations in
 * `packages/web/src/main.tsx` so this test reflects real client behaviour.
 */
function buildBootstrapRegistry(): ClientComponentRegistry {
  const registry = new ClientComponentRegistry();
  for (const impl of fluentOverrides) registry.register(impl);
  const richComponents = [
    AuthCard,
    AzureAction,
    AzureLoginCard,
    AzureResourceForm,
    AzureResourcePicker,
    CodeBlock,
    CostEstimate,
    DecisionCard,
    FileEditor,
    FormGroup,
    GenerationProgress,
    GitHubAction,
    GitHubCommit,
    GitHubLoginCard,
    GitHubRepoPicker,
    Markdown,
    ProgressSteps,
    Questionnaire,
    RadioGroup,
    SteppedCarousel,
    SummaryCard,
  ];
  for (const impl of richComponents) registry.register(impl);
  registry.seal();
  return registry;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Create-tab inspirations allow-list ↔ client registry", () => {
  it("every allow-listed component is registered in the client catalog", () => {
    const registry = buildBootstrapRegistry();
    const registered = new Set(registry.getNames());
    const missing = ALLOWED_A2UI_COMPONENTS.filter(
      (name) => !registered.has(name),
    );
    expect(
      missing,
      `Allow-list references components not registered in ClientComponentRegistry — ` +
        `the LLM could propose these and the chat would render _ErrorComponent. ` +
        `Either register the missing renderer in main.tsx or remove the entry from ` +
        `ALLOWED_A2UI_COMPONENTS in packages/web/api/src/lib/widget-inspirations-data.ts.`,
    ).toEqual([]);
  });

  it("the allow-list has no duplicate entries", () => {
    const unique = new Set(ALLOWED_A2UI_COMPONENTS);
    expect(unique.size).toBe(ALLOWED_A2UI_COMPONENTS.length);
  });
});
