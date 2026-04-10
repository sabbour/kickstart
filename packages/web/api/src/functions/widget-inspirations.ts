/**
 * @module @kickstart/api/functions/widget-inspirations
 *
 * GET /api/inspirations/widgets — Returns widget inspiration ideas for the Playground.
 *
 * If Azure OpenAI is configured, generates AKS operational widget ideas via LLM.
 * Otherwise, returns a shuffled subset of hardcoded fallback ideas.
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
    title: "Deployment Pipeline Status",
    subtitle: "Real-time visualization of deployment stages and health",
    prompt:
      "I want to build a widget that shows a deployment pipeline with stages (build, test, deploy) with real-time status indicators, duration metrics, and quick rollback controls for AKS deployments.",
  },
  {
    title: "Pod Health Monitor",
    subtitle: "Live pod status across all namespaces with resource usage",
    prompt:
      "I want to build a widget that displays pod health across all namespaces with color-coded status indicators, CPU and memory utilization sparklines, and crash loop detection alerts.",
  },
  {
    title: "Container Cost Tracker",
    subtitle: "Real-time cost breakdown by namespace and workload",
    prompt:
      "I want to build a widget that shows AKS cost breakdown by namespace and deployment with trend charts, cost optimization recommendations, and budget alerts for resource spending.",
  },
  {
    title: "Service Mesh Traffic Flow",
    subtitle: "Interactive topology view of service communication patterns",
    prompt:
      "I want to build a widget that visualizes service mesh traffic flow with an interactive graph showing request rates, latency heat maps, and error rates between microservices.",
  },
  {
    title: "Log Aggregation Viewer",
    subtitle: "Live log streaming with error highlighting and filtering",
    prompt:
      "I want to build a widget that streams container logs in real-time with error pattern highlighting, regex filtering, and quick links to correlated events across pods.",
  },
  {
    title: "CI/CD Pipeline Dashboard",
    subtitle: "GitOps sync status and deployment frequency metrics",
    prompt:
      "I want to build a widget that shows CI/CD pipeline status with GitOps sync state, deployment frequency charts, mean time to recovery metrics, and failed build diagnostics.",
  },
  {
    title: "Cluster Scaling Dashboard",
    subtitle: "Node pool autoscaling metrics and capacity planning",
    prompt:
      "I want to build a widget that displays node pool scaling activity with CPU and memory pressure metrics, autoscaling event logs, and predictive capacity recommendations.",
  },
  {
    title: "Alert Management Console",
    subtitle: "Active incidents with severity grouping and acknowledgment",
    prompt:
      "I want to build a widget that shows active Prometheus alerts grouped by severity with quick acknowledgment actions, silence controls, and incident timeline tracking.",
  },
  {
    title: "Ingress Configuration View",
    subtitle: "Live ingress rules and traffic routing status",
    prompt:
      "I want to build a widget that displays active ingress routes with traffic routing rules, TLS certificate status, and backend health checks for external access management.",
  },
  {
    title: "Certificate Expiry Tracker",
    subtitle: "TLS certificate monitoring with renewal reminders",
    prompt:
      "I want to build a widget that tracks TLS certificates and secrets across all namespaces with expiration countdown, auto-renewal status, and rotation workflow triggers.",
  },
  {
    title: "Canary Deployment Control",
    subtitle: "Progressive rollout controls with traffic shifting",
    prompt:
      "I want to build a widget that manages canary deployments with progressive traffic shifting controls, error rate comparison charts, and automated rollback triggers.",
  },
  {
    title: "Performance SLO Dashboard",
    subtitle: "Real-time SLO compliance with error budget tracking",
    prompt:
      "I want to build a widget that displays SLO compliance metrics with error budget burndown charts, latency percentile histograms, and availability trends for service reliability.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Check whether Azure OpenAI env vars are configured. */
function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT) &&
    process.env.AZURE_OPENAI_API_KEY
  );
}

/** Generate widget ideas via Azure OpenAI (JSON mode). */
async function generateWidgetIdeas(): Promise<WidgetIdea[]> {
  const { chatCompletion } = await import("../lib/openai-client.js");

  const result = await chatCompletion(
    [
      {
        role: "system",
        content: `You generate a single creative AKS operational widget idea for platform engineers and DevOps teams. The widget should be something that would appear on a Kubernetes operations dashboard — deployment status, pod health monitoring, cost tracking, service mesh topology, log viewers, alert management, cluster scaling, ingress configuration, certificate management, canary deployment controls, performance metrics, or GitOps sync status. Return ONLY a JSON array with exactly 1 object containing "title" (short catchy name, max 8 words), "subtitle" (one-line description, max 15 words), and "prompt" (a first-person sentence starting with "I want to build a widget that..." describing what the widget shows or does). No emoji. No markdown. Raw JSON only. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
      },
      {
        role: "user",
        content:
          "Generate 1 creative AKS operational widget idea for a Kubernetes dashboard.",
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

  const stream = chatCompletionStream(
    [
      {
        role: "system",
        content: `You generate a single creative AKS operational widget idea for platform engineers and DevOps teams. The widget should be something that would appear on a Kubernetes operations dashboard — deployment status, pod health monitoring, cost tracking, service mesh topology, log viewers, alert management, cluster scaling, ingress configuration, certificate management, canary deployment controls, performance metrics, or GitOps sync status. Return ONLY a first-person sentence starting with "I want to build a widget that..." describing what the widget shows or does. Max 2 sentences. No JSON. No markdown. No title. Just the prompt text. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
      },
      {
        role: "user",
        content:
          "Generate 1 creative AKS operational widget idea prompt for a Kubernetes dashboard.",
      },
    ],
    { temperature: 1.0, maxTokens: 200 },
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
                  const fallbackPrompt = shuffle(FALLBACK_IDEAS)[0].prompt;
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
            const fallbackPrompt = shuffle(FALLBACK_IDEAS)[0].prompt;
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
          const fallbackPrompt = shuffle(FALLBACK_IDEAS)[0].prompt;
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
          ideas = [shuffle(FALLBACK_IDEAS)[0]];
        }
      } else {
        ideas = [shuffle(FALLBACK_IDEAS)[0]];
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
