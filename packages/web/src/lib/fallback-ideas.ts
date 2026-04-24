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

export interface WidgetIdea {
  title: string;
  subtitle: string;
  prompt: string;
}

export const FALLBACK_WIDGET_IDEAS: WidgetIdea[] = [
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
