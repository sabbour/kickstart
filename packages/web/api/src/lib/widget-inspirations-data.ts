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
  "SummaryCard",
  "AuthCard",
  "CodeBlock",
  "FormGroup",
  "Questionnaire",
  "RadioGroup",
] as const;

// ---------------------------------------------------------------------------
// Fallback ideas (AKS/Kubernetes operational widgets)
// ---------------------------------------------------------------------------

export const FALLBACK_IDEAS: WidgetIdea[] = [
  {
    title: "Deployment Rollout Tracker",
    subtitle: "Live pod rollout progress with revision history",
    prompt:
      'I want to build a Kubernetes deployment rollout tracker. Use a Column as the root. Include a Text heading "Rollout: api-gateway", a ProgressSteps component for the 5 rollout stages (Queued, Pulling image, Creating pods, Ready, Rolled out), a Table with columns Revision, Image, Timestamp, Status and 4 sample rows (e.g. revision 42, api:v2.3.1, 10:14 UTC, Active). Add a Row of 3 Badges for pod states (Running, Pending, CrashLoopBackOff) with counts, and a Row of two Buttons: "Rollback to Previous" and "View Logs". Only use core A2UI components.',
  },
  {
    title: "Namespace Resource Dashboard",
    subtitle: "CPU, memory, and pod counts across namespaces",
    prompt:
      'I want to build a namespace resource dashboard. Use a Column as the root with a Text heading "Namespace usage (cluster: prod-eu)". Include a Table with columns Namespace, CPU req/lim, Mem req/lim, Pods, Status and 5 sample rows (ingress-nginx, kube-system, checkout, payments, analytics). Add 3 ProgressSteps rows for the top 3 namespaces by memory pressure (show name and percentage). End with a Row of Badges for namespace health (Healthy, Warning, Critical). Use only core A2UI components (Column, Row, Text, Table, Badge, ProgressSteps).',
  },
  {
    title: "Container Image Scanner",
    subtitle: "Registry browser with vulnerability severity counts",
    prompt:
      'I want to build a container image vulnerability scanner. Use a Column with a Text heading, then a Table listing 5 images with columns Repository, Tag, Size, Last pushed, Criticals, Highs, Mediums, Lows (e.g. acr.azurecr.io/api, v2.3.1, 142 MB, 2 days ago, 0, 2, 8, 14). Add a Row of 4 colored Badges for severity counts (Critical, High, Medium, Low). Add a Column with a DecisionCard summarising scan metadata (scanner, last scan, base OS). Finish with a Row with two Buttons: "Rescan Image" and "View Full Report". Use only core A2UI components.',
  },
  {
    title: "GitHub Actions Pipeline Monitor",
    subtitle: "Workflow runs with per-stage status",
    prompt:
      'I want to build a GitHub Actions pipeline monitor. Use a Column with a Text heading "Pipeline: deploy.yml (main)", a ProgressSteps showing 5 stages (Checkout, Build, Test, Push Image, Deploy to AKS) with the 4th failed. Add a Table of the last 6 runs with columns Run #, Trigger, Author, Duration, Status, Branch (e.g. #248, push, @asabbour, 4m 12s, success, main). Include a Row of Badges for overall health (Passing, Flaky, Failing). End with a Row of two Buttons: "Rerun Failed Jobs" and "Open in GitHub". Only use core A2UI components.',
  },
  {
    title: "Interactive Scaling Panel",
    subtitle: "Replica count and resource limit controls",
    prompt:
      'I want to build an interactive scaling panel for a Kubernetes deployment. Use a Column with a Text heading "Scale: checkout-api". Add a Row with 3 TextField inputs labelled "Desired replicas" (value 3), "Min replicas" (1), "Max replicas" (10). Add a ChoicePicker for scaling strategy with options RollingUpdate and Recreate. Add 2 ProgressSteps for current CPU (65%) and memory (48%) utilization. Add a Toggle labelled "Enable HPA". End with a Row with two Buttons: "Apply" (primary) and "Dry Run". Use only core A2UI components.',
  },
  {
    title: "Azure Cost Explorer",
    subtitle: "AKS cluster spend broken down by workload",
    prompt:
      'I want to build an Azure cost explorer for an AKS cluster. Use a Column root with a Text heading "Cost breakdown — prod-eu — last 30 days ($1,842)". Add a Table with columns Workload, Namespace, Compute, Storage, Egress, Total and 6 sample rows (api-gateway, checkout, payments-db, analytics, ingress-nginx, kube-system). Add 3 ProgressSteps for top 3 spenders as percent of total. Add a Row of Badges for budget status (Under, Near limit, Over). End with a Row of two Buttons: "Export CSV" and "Open in Azure Portal". Only use core A2UI components.',
  },
  {
    title: "Pod Log Viewer",
    subtitle: "Container logs with error highlighting and filtering",
    prompt:
      'I want to build a Kubernetes pod log viewer. Use a Column root with a ChoicePicker for namespace (default, kube-system, checkout), a ChoicePicker for pod, and a ChoicePicker for container. Add a Row with a TextField labelled "Filter" and a Toggle labelled "Follow logs". Add a Markdown block containing 10 sample log lines, with one error line prefixed "ERROR" and one warning prefixed "WARN". Include a DecisionCard showing pod name, container, start time, and restart count. End with a Row of Buttons: "Download Logs", "Previous Container", "Clear". Use only core A2UI components.',
  },
  {
    title: "AKS Cluster Overview",
    subtitle: "Health summary with node and workload stats",
    prompt:
      'I want to build an AKS cluster overview card. Use a Column root with a Text heading "prod-eu — West Europe — Kubernetes 1.30". Add a Row containing three DecisionCards: (1) Nodes (total 12, ready 12, not-ready 0); (2) Workloads (deployments 34, statefulsets 6, daemonsets 4, jobs 2); (3) Cluster info (tier Standard, network Azure CNI Overlay, identity Managed). Add a ProgressSteps for overall pod-capacity utilization (78%). Add a Row of Badges for cluster health (Healthy, Warning, Critical). End with a Row of Buttons: "Upgrade Cluster", "Scale Node Pool", "View Events". Only use core A2UI components.',
  },
  {
    title: "GitOps Sync Status",
    subtitle: "Flux/Argo CD reconciliation with drift detection",
    prompt:
      'I want to build a GitOps sync status card. Use a Column root with a Text heading "Flux — infra/k8s@main". Add a Row with two DecisionCards: (1) Source (repo URL, branch, last commit SHA, sync interval 5m); (2) Sync state with Badges for state (Synced / OutOfSync / Progressing) and health (Healthy / Degraded). Add a Table of 6 managed resources with columns Kind, Name, Namespace, Sync, Health. Add a ProgressSteps for current reconciliation progress. End with a Row of three Buttons: "Force Sync", "Suspend", "View Diff". Use only core A2UI components.',
  },
  {
    title: "Secret Rotation Planner",
    subtitle: "Inventory secrets with age and rotation SLAs",
    prompt:
      'I want to build a secret rotation planner. Use a Column root with a Text heading "Secrets nearing rotation SLA". Add a Row with a ChoicePicker for namespace and a Toggle labelled "Show system secrets". Add a Table with columns Name, Namespace, Type, Age (days), SLA, Status and 6 rows covering mixed states. Add a Row of Badges for overall status (On-track, At-risk, Overdue) with counts. End with a Row of Buttons: "Rotate Selected", "Export Inventory", "Open Runbook". Only use core A2UI components.',
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
