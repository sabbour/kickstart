/**
 * Fallback widget inspiration ideas for Playground
 * 
 * These are client-side fallback ideas used when the API is unavailable.
 * The same ideas are also hardcoded in the backend as a fallback.
 */

export interface WidgetIdea {
  title: string;
  subtitle: string;
  prompt: string;
}

export const FALLBACK_WIDGET_IDEAS: WidgetIdea[] = [
  {
    title: "Deployment Rollout Tracker",
    subtitle: "Live pod rollout progress with revision history",
    prompt: 'I want to build a component that tracks a Kubernetes deployment rollout in real time. Show a progress bar for pod replacement (e.g. "3/5 pods updated"), a table of recent revisions with timestamp, image tag, and status (Active/Rolled Back), color-coded Badge components for each pod state (Running=green, Pending=yellow, CrashLoopBackOff=red), and an ActionSet with "Rollback to Previous" and "View Logs" buttons.',
  },
  {
    title: "Namespace Resource Dashboard",
    subtitle: "CPU, memory, and pod counts across namespaces",
    prompt: 'I want to build a component that visualizes Kubernetes resource usage across namespaces. Show a Table with columns for namespace, CPU requests vs limits, memory requests vs limits, and pod count. Include a donut Chart showing total cluster CPU allocation by namespace, ProgressBar components for the top 3 namespaces by memory pressure, and Badge components for namespace health status (healthy/warning/critical). Add a ColumnSet layout with the chart on the left and table on the right.',
  },
  {
    title: "Container Image Scanner",
    subtitle: "Registry browser with vulnerability severity counts",
    prompt: 'I want to build a component that browses a container registry and shows vulnerability scan results. Display a Table of container images with columns: repository name, latest tag, image size, last pushed date, and vulnerability summary. Show Badge components for severity levels (Critical=red, High=orange, Medium=yellow, Low=green) with counts. Include a FactSet with scan metadata (scanner version, last scan time, base OS). Add an ActionSet with "Rescan Image" and "View Full Report" buttons.',
  },
  {
    title: "CI/CD Pipeline Monitor",
    subtitle: "GitHub Actions workflow runs with build log previews",
    prompt: 'I want to build a component that shows CI/CD pipeline status for a GitHub Actions workflow. Display a vertical pipeline of stages (Checkout, Build, Test, Push Image, Deploy to AKS) using a Container with colored left borders — green for passed, red for failed, gray for pending. Show duration and timestamp for each stage. Include a ProgressBar for the overall pipeline (e.g. 80% = 4/5 stages complete), a FactSet with commit SHA, branch, and author, and an ActionSet with "Rerun Failed Jobs" and "View Full Logs" buttons.',
  },
  {
    title: "Interactive Scaling Panel",
    subtitle: "Replica count and resource limit controls",
    prompt: 'I want to build a component that lets you configure scaling for a Kubernetes deployment. Show the current state with a FactSet (current replicas: 3, min: 1, max: 10, CPU target: 70%). Include Input.Number fields for "Desired Replicas", "Min Replicas", and "Max Replicas". Add Input.ChoiceSet for scaling strategy (RollingUpdate/Recreate). Show a ProgressBar for current CPU utilization at 65% and memory at 48%. Include two Charts side by side: a line chart of replica count over the last hour and a bar chart of CPU usage per pod. Add an ActionSet with "Apply Scaling" and "Enable HPA" buttons.',
  },
  {
    title: "Kubernetes Event Stream",
    subtitle: "Cluster events filtered by type and severity",
    prompt: 'I want to build a component that displays a live Kubernetes event stream. Show a Table with columns: timestamp, type (Normal/Warning), reason, object (e.g. pod/my-app-xyz), and message. Use Badge components for event type — blue for Normal, orange for Warning. Include an Input.ChoiceSet filter for namespace and an Input.Toggle to show only warnings. Display a bar Chart showing event counts by reason (Pulled, Scheduled, Unhealthy, FailedMount) over the last hour. Show a FactSet summary: total events, warning count, most active namespace.',
  },
  {
    title: "Helm Release Manager",
    subtitle: "Installed charts with upgrade and rollback controls",
    prompt: 'I want to build a component that manages Helm releases in a cluster. Show a Table with columns: release name, chart, chart version, app version, namespace, status (Deployed/Failed/Pending), and last updated timestamp. Use Badge components for status (Deployed=green, Failed=red, Pending=yellow). Include a FactSet for the selected release showing values summary and revision number. Add an ActionSet with "Upgrade", "Rollback", "Uninstall", and "View Values" buttons. Show a line Chart of revision history with deployment timestamps.',
  },
  {
    title: "Service Endpoint Health",
    subtitle: "Ingress routes with TLS status and latency metrics",
    prompt: 'I want to build a component that monitors service endpoints and ingress health. Show a Table with columns: hostname, path, backend service, port, TLS status, and p99 latency. Use Badge components for TLS (Valid=green, Expiring Soon=orange, Expired=red) and for health (Healthy=green, Degraded=yellow, Down=red). Include a line Chart showing request latency (p50, p95, p99) over the last 30 minutes. Add a FactSet with cert issuer, expiry date, and ingress controller version. Include an ActionSet with "Test Endpoint" and "Renew Certificate" buttons.',
  },
  {
    title: "GitOps Sync Status",
    subtitle: "Flux/Argo CD reconciliation state with drift detection",
    prompt: 'I want to build a component that shows GitOps sync status for Flux or Argo CD. Display a ColumnSet: left column has a FactSet with repo URL, branch, last commit SHA, and sync interval. Right column has Badge components for sync state (Synced=green, OutOfSync=red, Progressing=yellow) and health (Healthy/Degraded/Missing). Show a Table of managed resources with columns: kind, name, namespace, sync status, and health. Include a ProgressBar for reconciliation progress and an ActionSet with "Force Sync", "Suspend", and "View Diff" buttons.',
  },
  {
    title: "Pod Log Viewer",
    subtitle: "Container logs with error highlighting and filtering",
    prompt: 'I want to build a component that displays container logs from a Kubernetes pod. Show an Input.ChoiceSet for namespace, pod, and container selection. Include an Input.Toggle for "Follow Logs" and an Input.Text for search/filter. Display the log output in a Container with emphasis styling, using TextBlock components — errors in red (attention color), warnings in yellow (warning color), info in default. Show a FactSet with pod name, container, start time, and restart count. Add an ActionSet with "Download Logs", "Previous Container", and "Clear" buttons.',
  },
  {
    title: "AKS Cluster Overview",
    subtitle: "Cluster health summary with node and workload stats",
    prompt: 'I want to build a component that gives an at-a-glance overview of an AKS cluster. Show a ColumnSet with three columns: node stats (a FactSet with total nodes, ready count, and not-ready count plus a donut Chart of node pool distribution), workload stats (a FactSet with deployments, statefulsets, daemonsets, and jobs plus a ProgressBar for overall pod capacity utilization), and cluster info (a FactSet with Kubernetes version, region, tier, and network plugin). Use Badge components for cluster health (Healthy=green, Warning=yellow, Critical=red). Add an ActionSet with "Upgrade Cluster", "Scale Node Pool", and "View Events" buttons.',
  },
  {
    title: "Secret and ConfigMap Browser",
    subtitle: "Namespace-scoped config management with edit controls",
    prompt: 'I want to build a component that browses Kubernetes Secrets and ConfigMaps. Show an Input.ChoiceSet to filter by namespace and resource type (Secret/ConfigMap/Both). Display a Table with columns: name, type, namespace, data keys count, and last modified. Use Badge components for type (Secret=orange with "tint" appearance, ConfigMap=blue). Include a FactSet showing the selected item\'s metadata (annotations, labels, creation timestamp). Add an ActionSet with "View Data", "Edit", "Copy to Namespace", and "Delete" buttons. Show an Input.Toggle for "Show system resources".',
  },
];
