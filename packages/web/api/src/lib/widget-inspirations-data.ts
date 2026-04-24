/**
 * @module @aks-kickstart/api/lib/widget-inspirations-data
 *
 * Canonical, server-owned data and helpers for Create-tab inspirations.
 *
 * - `ALLOWED_A2UI_COMPONENTS` — allow-list of component type names the LLM
 *   may propose. Every entry MUST correspond to a component registered in
 *   the client `ClientComponentRegistry` (see
 *   `packages/web/src/contexts/A2UIRegistryContext.tsx`). Drift causes the
 *   chat to render `_ErrorComponent` for any LLM-proposed component that
 *   lacks a renderer. A vitest guard in
 *   `packages/web/src/__tests__/a2ui-allow-list-registry.test.ts`
 *   enforces this invariant at CI time.
 *
 * - `FALLBACK_IDEAS` — canonical client-agnostic fallback list used when
 *   Azure OpenAI is unavailable. The client mirror at
 *   `packages/web/src/lib/fallback-ideas.ts` is pinned to this array via
 *   the sync test in `fallback-ideas-sync.test.ts`. Server owns.
 *
 * - `pickFallbackIdea()` / `nextFocusDomain()` — process-local rotation
 *   helpers; exported for unit testing.
 */

export interface WidgetIdea {
  title: string;
  subtitle: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Allow-list of A2UI component type names the LLM may reference.
//
// Any entry here MUST be registered in the client registry. See module
// header. If you add or remove an entry, update the registry (and its
// registrations in `packages/web/src/main.tsx`) to match.
// ---------------------------------------------------------------------------

export const ALLOWED_A2UI_COMPONENTS: readonly string[] = [
  "Column",
  "Row",
  "Text",
  "TextField",
  "CheckBox",
  "Toggle",
  "ChoicePicker",
  "Button",
  "Image",
  "Icon",
  "Badge",
  "Card",
  "Divider",
  "Link",
  "List",
  "Table",
  "Tabs",
  "Markdown",
  "ProgressSteps",
  "DecisionCard",
  "TrackPicker",
  "SummaryCard",
  "AuthCard",
  "CodeBlock",
  "FormGroup",
  "Questionnaire",
  "RadioGroup",
] as const;

// ---------------------------------------------------------------------------
// Fallback ideas (DevOps-focused app deployment and operations)
// ---------------------------------------------------------------------------

export const FALLBACK_IDEAS: WidgetIdea[] = [
  {
    title: "Deploy a Container App",
    subtitle: "Step-by-step container deployment to AKS",
    prompt:
      'Build a container deployment card. Use a Column with a Text heading "Deploy to AKS". Add a ProgressSteps with 4 steps (Select image, Configure, Deploy, Verify). Add a TextField for "Container image" and a ChoicePicker for cluster region (East US, West Europe, Southeast Asia). End with a Row of two Buttons: "Deploy" and "Cancel". Only use core A2UI components.',
  },
  {
    title: "Monitor App Health",
    subtitle: "Health checks and alert status at a glance",
    prompt:
      'Build an app health monitor. Use a Column with a Text heading "App Health". Add a Row of 3 Badges (Healthy, Degraded, Down) showing current status. Add a Table with columns Service, Status, Latency, Uptime and 4 rows (api, web, worker, database). End with a Button "Configure Alerts". Only use core A2UI components.',
  },
  {
    title: "Set Up a CI/CD Pipeline",
    subtitle: "Build, test, and deploy pipeline stages",
    prompt:
      'Build a CI/CD pipeline setup card. Use a Column with a Text heading "CI/CD Pipeline". Add a ProgressSteps with 5 stages (Source, Build, Test, Stage, Production). Add a ChoicePicker for trigger (Push to main, Pull request, Manual). Add a Toggle for "Auto-deploy on success". End with a Row of two Buttons: "Save Pipeline" and "Run Now". Only use core A2UI components.',
  },
  {
    title: "Connect to Key Vault",
    subtitle: "Link secrets and certificates to your app",
    prompt:
      'Build a Key Vault connection card. Use a Column with a Text heading "Connect to Azure Key Vault". Add a TextField for "Vault name" and a ChoicePicker for access method (Managed Identity, Service Principal). Add a Table with columns Secret, Type, Expires and 3 rows. End with a Row of two Buttons: "Connect" and "Test Connection". Only use core A2UI components.',
  },
  {
    title: "Review Deployment Cost",
    subtitle: "Monthly spend summary by resource type",
    prompt:
      'Build a cost review card. Use a Column with a Text heading "Monthly Cost Summary". Add a Table with columns Resource, Type, Monthly Cost and 4 rows (Cluster, Storage, Networking, Monitoring). Add a Row of 2 Badges (Under Budget, Over Budget). End with a Button "View Full Breakdown". Only use core A2UI components.',
  },
  {
    title: "Scale a Cluster",
    subtitle: "Adjust node count and resource limits",
    prompt:
      'Build a cluster scaling card. Use a Column with a Text heading "Scale Cluster". Add a Row of two TextField inputs for "Min nodes" (value 2) and "Max nodes" (value 10). Add a Toggle for "Enable autoscaler". Add a ProgressSteps showing current utilization (CPU 65%, Memory 48%). End with a Row of two Buttons: "Apply" and "Preview Changes". Only use core A2UI components.',
  },
  {
    title: "Create a New App",
    subtitle: "Scaffold a new application from a template",
    prompt:
      'Build an app creation card. Use a Column with a Text heading "Create New App". Add a TextField for "App name". Add a ChoicePicker for runtime (Node.js, Python, .NET, Java, Go). Add a ChoicePicker for template (Web API, Web App, Worker, Microservice). Add a Toggle for "Add Dockerfile". End with a Row of two Buttons: "Create" and "Preview". Only use core A2UI components.',
  },
  {
    title: "View Container Logs",
    subtitle: "Recent logs with severity filtering",
    prompt:
      'Build a log viewer card. Use a Column with a Text heading "Container Logs". Add a ChoicePicker for severity (All, Error, Warning, Info). Add a Markdown block with 6 sample log lines including one ERROR and one WARN entry. End with a Row of two Buttons: "Refresh" and "Download Logs". Only use core A2UI components.',
  },
  {
    title: "Manage Environment Variables",
    subtitle: "Configure app settings and secrets",
    prompt:
      'Build an environment variable manager. Use a Column with a Text heading "Environment Variables". Add a Table with columns Name, Value, Source and 4 rows (DATABASE_URL, API_KEY, LOG_LEVEL, REGION). Add a Row of a TextField for "Key" and a TextField for "Value". End with a Row of two Buttons: "Add Variable" and "Save Changes". Only use core A2UI components.',
  },
  {
    title: "Set Up Monitoring",
    subtitle: "Configure metrics, alerts, and dashboards",
    prompt:
      'Build a monitoring setup card. Use a Column with a Text heading "Set Up Monitoring". Add a ProgressSteps with 3 steps (Enable metrics, Configure alerts, Create dashboard). Add a Toggle for "Enable Container Insights" and a Toggle for "Enable Prometheus metrics". End with a Row of two Buttons: "Apply" and "Skip for Now". Only use core A2UI components.',
  },
];

// ---------------------------------------------------------------------------
// Focus-domain rotation
//
// Each invocation advances a process-local cursor so successive LLM calls
// emphasise a different area, avoiding convergence on the same
// "namespace operations" text. Process-local — persistence across
// restarts is unnecessary for a best-effort variety hint.
// ---------------------------------------------------------------------------

export const FOCUS_DOMAINS: readonly string[] = [
  "Kubernetes deployment and rollout (revisions, pods, safeguards)",
  "CI/CD and GitHub Actions (workflow runs, image builds, scans)",
  "Azure cost and capacity (spend breakdown, quota, forecasts)",
  "AKS cluster health (nodes, upgrades, networking)",
  "GitOps and configuration drift (Flux/Argo, Helm releases)",
  "Observability and events (pod logs, metrics, alerts, SLOs)",
  "Secrets and identity (rotation, managed identity, RBAC)",
  "Developer self-service (scaling panels, namespace quotas)",
];

let focusCursor = Math.floor(Math.random() * FOCUS_DOMAINS.length);

export function nextFocusDomain(): string {
  const domain = FOCUS_DOMAINS[focusCursor % FOCUS_DOMAINS.length];
  focusCursor = (focusCursor + 1) % FOCUS_DOMAINS.length;
  return domain;
}

/** Test-only: deterministically reset the focus cursor. */
export function _resetFocusCursorForTests(value = 0): void {
  focusCursor = value;
}

// ---------------------------------------------------------------------------
// Fallback rotation
//
// Tracks the last fallback index served so consecutive requests that miss
// OpenAI get a different idea. Process-local; see FOCUS_DOMAINS note above.
// ---------------------------------------------------------------------------

let lastFallbackIdx = -1;

export function pickFallbackIdea(): WidgetIdea {
  if (FALLBACK_IDEAS.length <= 1) return FALLBACK_IDEAS[0];
  let idx = Math.floor(Math.random() * FALLBACK_IDEAS.length);
  if (idx === lastFallbackIdx) {
    idx = (idx + 1) % FALLBACK_IDEAS.length;
  }
  lastFallbackIdx = idx;
  return FALLBACK_IDEAS[idx];
}

/** Test-only: deterministically reset the last-served index. */
export function _resetLastFallbackIdxForTests(value = -1): void {
  lastFallbackIdx = value;
}

// ---------------------------------------------------------------------------
// Markdown stripping (safety net for LLM output rendered in plain-text areas)
//
// The system prompt asks for plain prose, but LLMs occasionally slip in
// markdown syntax anyway.  This function removes common markdown artifacts
// so the textarea never shows raw `**bold**`, `### headings`, or `---`.
// ---------------------------------------------------------------------------

/**
 * Strip common markdown syntax from a string, returning plain text.
 *
 * Handles: bold/italic (`**`, `__`, `*`, `_`), headings (`#`…`######`),
 * horizontal rules (`---`, `***`, `___`), inline code (`` ` ``),
 * fenced code blocks (`` ``` ``), bullet/numbered list prefixes,
 * blockquotes (`>`), links (`[text](url)`), and images (`![alt](url)`).
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Fenced code blocks (``` … ```) — remove fences, keep content
      .replace(/```[\s\S]*?```/g, (m) =>
        m.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, ""),
      )
      // Images ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Links [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      // Headings: strip leading #…#
      .replace(/^#{1,6}\s+/gm, "")
      // Horizontal rules (standalone ---, ***, ___)
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // Bold/italic (order matters: longest delimiter first)
      .replace(/\*{3}(.+?)\*{3}/g, "$1")
      .replace(/_{3}(.+?)_{3}/g, "$1")
      .replace(/\*{2}(.+?)\*{2}/g, "$1")
      .replace(/_{2}(.+?)_{2}/g, "$1")
      .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "$1")
      .replace(/(?<!\w)_(.+?)_(?!\w)/g, "$1")
      // Inline code
      .replace(/`([^`]+)`/g, "$1")
      // Blockquotes
      .replace(/^>\s?/gm, "")
      // Unordered list bullets (-, *, +)
      .replace(/^[\t ]*[-*+]\s+/gm, "")
      // Ordered list prefixes (1., 2., …)
      .replace(/^[\t ]*\d+\.\s+/gm, "")
      // Collapse multiple blank lines into one
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
