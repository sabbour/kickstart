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
import { z } from "zod";
import {
  ClientComponentRegistry,
} from "../contexts/A2UIRegistryContext";
import { fluentOverrides } from "../catalog/fluent-components/index";
import {
  ArchitectureDiagram,
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
  TrackPicker,
} from "../catalog/components/index";
import { azureClientComponents } from "@aks-kickstart/pack-azure/client";
import { aksClientComponents } from "@aks-kickstart/pack-aks-automatic/client";
import { githubClientComponents } from "@aks-kickstart/pack-github/client";
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
    ArchitectureDiagram,
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
    TrackPicker,
  ];
  for (const impl of richComponents) registry.register(impl);
  // Pack components — mirrors registerPackComponents() in main.tsx. Stub
  // renderers since the registry only checks by name; adapter details are
  // covered by the component-previews.test.ts render-time guard.
  for (const contribution of [
    ...azureClientComponents,
    ...aksClientComponents,
    ...githubClientComponents,
  ]) {
    registry.register({
      name: contribution.name,
      schema: z.object({}),
      render: () => null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  }
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
