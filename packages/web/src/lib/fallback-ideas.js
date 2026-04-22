/**
 * Fallback widget inspiration ideas for Playground
 *
 * These are client-side fallback ideas used when the API is unavailable.
 * Prompts intentionally instruct the LLM to use only core A2UI components
 * (Column, Row, Text, Table, Badge, Button, ProgressSteps, DecisionCard,
 * ChoicePicker, TextField, Toggle, Markdown, …) so responses can render
 * without pack-specific client renderers.
 *
 * The server owns the canonical list at
 * `packages/web/api/src/lib/widget-inspirations-data.ts` (exported as
 * `FALLBACK_IDEAS`). This client mirror MUST stay byte-for-byte equal —
 * the sync test at
 * `packages/web/api/src/lib/fallback-ideas-sync.test.ts`
 * enforces equality in CI.
 */
export const FALLBACK_WIDGET_IDEAS = [
    {
        title: "Deployment Rollout Tracker",
        subtitle: "Live pod rollout progress with revision history",
        prompt: 'I want to build a Kubernetes deployment rollout tracker. Use a Column as the root. Include a Text heading "Rollout: api-gateway", a ProgressSteps component for the 5 rollout stages (Queued, Pulling image, Creating pods, Ready, Rolled out), a Table with columns Revision, Image, Timestamp, Status and 4 sample rows (e.g. revision 42, api:v2.3.1, 10:14 UTC, Active). Add a Row of 3 Badges for pod states (Running, Pending, CrashLoopBackOff) with counts, and a Row of two Buttons: "Rollback to Previous" and "View Logs". Only use core A2UI components.',
    },
    {
        title: "Namespace Resource Dashboard",
        subtitle: "CPU, memory, and pod counts across namespaces",
        prompt: 'I want to build a namespace resource dashboard. Use a Column as the root with a Text heading "Namespace usage (cluster: prod-eu)". Include a Table with columns Namespace, CPU req/lim, Mem req/lim, Pods, Status and 5 sample rows (ingress-nginx, kube-system, checkout, payments, analytics). Add 3 ProgressSteps rows for the top 3 namespaces by memory pressure (show name and percentage). End with a Row of Badges for namespace health (Healthy, Warning, Critical). Use only core A2UI components (Column, Row, Text, Table, Badge, ProgressSteps).',
    },
    {
        title: "Container Image Scanner",
        subtitle: "Registry browser with vulnerability severity counts",
        prompt: 'I want to build a container image vulnerability scanner. Use a Column with a Text heading, then a Table listing 5 images with columns Repository, Tag, Size, Last pushed, Criticals, Highs, Mediums, Lows (e.g. acr.azurecr.io/api, v2.3.1, 142 MB, 2 days ago, 0, 2, 8, 14). Add a Row of 4 colored Badges for severity counts (Critical, High, Medium, Low). Add a Column with a DecisionCard summarising scan metadata (scanner, last scan, base OS). Finish with a Row with two Buttons: "Rescan Image" and "View Full Report". Use only core A2UI components.',
    },
    {
        title: "GitHub Actions Pipeline Monitor",
        subtitle: "Workflow runs with per-stage status",
        prompt: 'I want to build a GitHub Actions pipeline monitor. Use a Column with a Text heading "Pipeline: deploy.yml (main)", a ProgressSteps showing 5 stages (Checkout, Build, Test, Push Image, Deploy to AKS) with the 4th failed. Add a Table of the last 6 runs with columns Run #, Trigger, Author, Duration, Status, Branch (e.g. #248, push, @asabbour, 4m 12s, success, main). Include a Row of Badges for overall health (Passing, Flaky, Failing). End with a Row of two Buttons: "Rerun Failed Jobs" and "Open in GitHub". Only use core A2UI components.',
    },
    {
        title: "Interactive Scaling Panel",
        subtitle: "Replica count and resource limit controls",
        prompt: 'I want to build an interactive scaling panel for a Kubernetes deployment. Use a Column with a Text heading "Scale: checkout-api". Add a Row with 3 TextField inputs labelled "Desired replicas" (value 3), "Min replicas" (1), "Max replicas" (10). Add a ChoicePicker for scaling strategy with options RollingUpdate and Recreate. Add 2 ProgressSteps for current CPU (65%) and memory (48%) utilization. Add a Toggle labelled "Enable HPA". End with a Row with two Buttons: "Apply" (primary) and "Dry Run". Use only core A2UI components.',
    },
    {
        title: "Azure Cost Explorer",
        subtitle: "AKS cluster spend broken down by workload",
        prompt: 'I want to build an Azure cost explorer for an AKS cluster. Use a Column root with a Text heading "Cost breakdown — prod-eu — last 30 days ($1,842)". Add a Table with columns Workload, Namespace, Compute, Storage, Egress, Total and 6 sample rows (api-gateway, checkout, payments-db, analytics, ingress-nginx, kube-system). Add 3 ProgressSteps for top 3 spenders as percent of total. Add a Row of Badges for budget status (Under, Near limit, Over). End with a Row of two Buttons: "Export CSV" and "Open in Azure Portal". Only use core A2UI components.',
    },
    {
        title: "Pod Log Viewer",
        subtitle: "Container logs with error highlighting and filtering",
        prompt: 'I want to build a Kubernetes pod log viewer. Use a Column root with a ChoicePicker for namespace (default, kube-system, checkout), a ChoicePicker for pod, and a ChoicePicker for container. Add a Row with a TextField labelled "Filter" and a Toggle labelled "Follow logs". Add a Markdown block containing 10 sample log lines, with one error line prefixed "ERROR" and one warning prefixed "WARN". Include a DecisionCard showing pod name, container, start time, and restart count. End with a Row of Buttons: "Download Logs", "Previous Container", "Clear". Use only core A2UI components.',
    },
    {
        title: "AKS Cluster Overview",
        subtitle: "Health summary with node and workload stats",
        prompt: 'I want to build an AKS cluster overview card. Use a Column root with a Text heading "prod-eu — West Europe — Kubernetes 1.30". Add a Row containing three DecisionCards: (1) Nodes (total 12, ready 12, not-ready 0); (2) Workloads (deployments 34, statefulsets 6, daemonsets 4, jobs 2); (3) Cluster info (tier Standard, network Azure CNI Overlay, identity Managed). Add a ProgressSteps for overall pod-capacity utilization (78%). Add a Row of Badges for cluster health (Healthy, Warning, Critical). End with a Row of Buttons: "Upgrade Cluster", "Scale Node Pool", "View Events". Only use core A2UI components.',
    },
    {
        title: "GitOps Sync Status",
        subtitle: "Flux/Argo CD reconciliation with drift detection",
        prompt: 'I want to build a GitOps sync status card. Use a Column root with a Text heading "Flux — infra/k8s@main". Add a Row with two DecisionCards: (1) Source (repo URL, branch, last commit SHA, sync interval 5m); (2) Sync state with Badges for state (Synced / OutOfSync / Progressing) and health (Healthy / Degraded). Add a Table of 6 managed resources with columns Kind, Name, Namespace, Sync, Health. Add a ProgressSteps for current reconciliation progress. End with a Row of three Buttons: "Force Sync", "Suspend", "View Diff". Use only core A2UI components.',
    },
    {
        title: "Secret Rotation Planner",
        subtitle: "Inventory secrets with age and rotation SLAs",
        prompt: 'I want to build a secret rotation planner. Use a Column root with a Text heading "Secrets nearing rotation SLA". Add a Row with a ChoicePicker for namespace and a Toggle labelled "Show system secrets". Add a Table with columns Name, Namespace, Type, Age (days), SLA, Status and 6 rows covering mixed states. Add a Row of Badges for overall status (On-track, At-risk, Overdue) with counts. End with a Row of Buttons: "Rotate Selected", "Export Inventory", "Open Runbook". Only use core A2UI components.',
    },
];
//# sourceMappingURL=fallback-ideas.js.map