/**
 * @module @aks-kickstart/api/functions/widget-inspirations
 *
 * GET /api/inspirations/widgets — Returns widget inspiration ideas for the Playground.
 *
 * If Azure OpenAI is configured, generates AKS operational widget ideas via LLM.
 * Otherwise, returns a rotated fallback idea (avoiding immediate repeats).
 * Supports streaming mode via ?stream=true query parameter.
 */

import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

interface WidgetIdea {
  title: string;
  subtitle: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback ideas (AKS/Kubernetes operational widgets)
// ---------------------------------------------------------------------------

const FALLBACK_IDEAS: WidgetIdea[] = [
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

// Focus-domain rotation: each request advances this cursor so successive
// LLM calls emphasise a different area and avoid converging on the same
// "namespace operations" text. Process-local — acceptable for a best-effort
// variety hint; we do not need persistence across restarts.
const FOCUS_DOMAINS: string[] = [
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
function nextFocusDomain(): string {
  const domain = FOCUS_DOMAINS[focusCursor % FOCUS_DOMAINS.length];
  focusCursor = (focusCursor + 1) % FOCUS_DOMAINS.length;
  return domain;
}

// Tracks the last fallback index served so consecutive requests that miss
// OpenAI get a different idea. Process-local; see note on focusCursor above.
let lastFallbackIdx = -1;
function pickFallbackIdea(): WidgetIdea {
  if (FALLBACK_IDEAS.length <= 1) return FALLBACK_IDEAS[0];
  let idx = Math.floor(Math.random() * FALLBACK_IDEAS.length);
  if (idx === lastFallbackIdx) {
    idx = (idx + 1) % FALLBACK_IDEAS.length;
  }
  lastFallbackIdx = idx;
  return FALLBACK_IDEAS[idx];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether Azure OpenAI env vars are configured. */
function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.KICKSTART_CHAT_MODEL ?? process.env.KICKSTART_CODEX_MODEL) &&
    process.env.AZURE_OPENAI_API_KEY
  );
}

/** Generate widget ideas via Azure OpenAI (JSON mode). */
async function generateWidgetIdeas(): Promise<WidgetIdea[]> {
  const { chatCompletion } = await import("../lib/openai-client.js");

  const focus = nextFocusDomain();

  const result = await chatCompletion(
    [
      {
        role: "system",
        content: `You generate a single creative component idea for a developer tool that helps deploy and operate apps on Azure Kubernetes Service (AKS). The component is rendered with the **A2UI core catalog** and you MUST restrict yourself to its components. Valid component type names (exact spelling): Column, Row, Text, TextField, CheckBox, Toggle, ChoicePicker, Button, Image, Icon, Badge, Card, Divider, Link, List, Table, Tabs, Markdown, ProgressSteps, DecisionCard, SummaryCard, AuthCard, CodeBlock, FormGroup, Questionnaire, RadioGroup.

DO NOT invent or reference namespaced component types (e.g. "aks/PodTable", "azure/CostEstimate", "github/RepoPicker", "FactSet", "Chart", "ColumnSet", "Container", "ActionSet", "TextBlock", "ProgressBar", "Input.*"). If you need a chart, describe a Table or Markdown summary instead. If you need a key-value panel, use a DecisionCard or a Column of Row + Text pairs.

Your idea MUST focus on the following area this round: ${focus}.

The prompt you generate should be detailed enough to produce a COMPLETE working component in a single AI response. Specify:
- Which A2UI component types to use (from the allowed list above only)
- What realistic sample data to show (pod names, namespaces, metrics, timestamps, repo names)
- What interactions to include (Buttons, Toggles, ChoicePickers, TextFields)
- How to lay out the component (Row for side-by-side, Column for stacking)

Return ONLY a JSON array with exactly 1 object containing "title" (short catchy name, max 8 words), "subtitle" (one-line description, max 15 words), and "prompt" (a detailed first-person description starting with "I want to build a component that..." specifying the component types, sample data, layout, and interactions). End the prompt with the literal sentence "Use only core A2UI components." No emoji. No markdown. Raw JSON only. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
      },
      {
        role: "user",
        content: `Generate 1 creative component idea focused on: ${focus}. It must one-shot into a complete A2UI component using only the allowed core component types.`,
      },
    ],
    { temperature: 1.0, maxTokens: 300 },
  );

  const parsed = JSON.parse(result.content) as WidgetIdea[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format from OpenAI");
  }
  return parsed;
}

/** Generate widget idea prompt via Azure OpenAI (streaming mode — returns raw prompt text). */
async function* generateWidgetPromptStream(): AsyncGenerator<string> {
  const { chatCompletionStream } = await import("../lib/openai-client.js");

  const focus = nextFocusDomain();

  const stream = chatCompletionStream(
    [
      {
        role: "system",
        content: `You generate a single detailed component idea for a developer tool that helps deploy and operate apps on Azure Kubernetes Service (AKS). The component is rendered with the **A2UI core catalog** and you MUST restrict yourself to its components. Valid component type names (exact spelling): Column, Row, Text, TextField, CheckBox, Toggle, ChoicePicker, Button, Image, Icon, Badge, Card, Divider, Link, List, Table, Tabs, Markdown, ProgressSteps, DecisionCard, SummaryCard, AuthCard, CodeBlock, FormGroup, Questionnaire, RadioGroup.

DO NOT invent or reference namespaced component types (e.g. "aks/PodTable", "azure/CostEstimate", "github/RepoPicker", "FactSet", "Chart", "ColumnSet", "Container", "ActionSet", "TextBlock", "ProgressBar", "Input.*"). If you need a chart, describe a Table or Markdown summary instead. If you need a key-value panel, use a DecisionCard or a Column of Row + Text pairs.

Your idea MUST focus on the following area this round: ${focus}.

Return ONLY a single first-person prompt starting with "I want to build a component that..." which is detailed enough to produce a complete working A2UI component in one shot. Specify which component types to use (from the allowed list above only), what sample data to show, what interactions to include, and how to lay things out. End the prompt with the literal sentence "Use only core A2UI components." Aim for 60-120 words. No JSON. No markdown. No title. Just the prompt sentence(s). All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
      },
      {
        role: "user",
        content: `Generate 1 detailed component idea focused on: ${focus}. It must one-shot into a complete A2UI component using only the allowed core component types.`,
      },
    ],
    { temperature: 1.0, maxTokens: 400 },
  );

  for await (const chunk of stream) {
    yield chunk;
  }
}

/** Simulate streaming by returning a fallback prompt character by character. */
async function* simulateStreaming(text: string): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i++) {
    yield text[i];
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

app.http("widget-inspirations", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "inspirations/widgets",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      const isStreaming = request.query.get("stream") === "true";

      // Streaming mode
      if (isStreaming) {
        if (isOpenAIConfigured()) {
          try {
            // Stream from OpenAI
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                try {
                  for await (const chunk of generateWidgetPromptStream()) {
                    controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                } catch (err) {
                  const msg = err instanceof Error ? err.message : String(err);
                  context.log(`Streaming error, falling back: ${msg}`);
                  // Fallback to simulated streaming
                  const fallbackPrompt = pickFallbackIdea().prompt;
                  for await (const char of simulateStreaming(fallbackPrompt)) {
                    controller.enqueue(encoder.encode(`data: ${char}\n\n`));
                  }
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  controller.close();
                }
              },
            });

            return {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
              },
              body: stream,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            context.log(`OpenAI streaming failed, using fallback: ${msg}`);
            // Fallback to simulated streaming
            const fallbackPrompt = pickFallbackIdea().prompt;
            const encoder = new TextEncoder();
            const stream = new ReadableStream({
              async start(controller) {
                for await (const char of simulateStreaming(fallbackPrompt)) {
                  controller.enqueue(encoder.encode(`data: ${char}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              },
            });

            return {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
              },
              body: stream,
            };
          }
        } else {
          // No OpenAI — simulate streaming with fallback
          const fallbackPrompt = pickFallbackIdea().prompt;
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            async start(controller) {
              for await (const char of simulateStreaming(fallbackPrompt)) {
                controller.enqueue(encoder.encode(`data: ${char}\n\n`));
              }
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            },
          });

          return {
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              "Connection": "keep-alive",
            },
            body: stream,
          };
        }
      }

      // Non-streaming mode (JSON response)
      let ideas: WidgetIdea[];

      if (isOpenAIConfigured()) {
        try {
          ideas = await generateWidgetIdeas();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          context.log(`OpenAI generation failed, using fallback: ${msg}`);
          ideas = [pickFallbackIdea()];
        }
      } else {
        ideas = [pickFallbackIdea()];
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        jsonBody: ideas,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.log(`Widget inspirations error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
