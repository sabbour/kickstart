/**
 * @module @kickstart/api/functions/inspirations
 *
 * GET /api/inspirations — Returns carousel inspiration ideas for the landing page.
 * GET /api/inspirations?stream=true — Streams a single inspiration idea token-by-token.
 *
 * If Azure OpenAI is configured, generates creative app ideas via LLM.
 * Otherwise, returns a shuffled subset of hardcoded fallback ideas.
 *
 * Environment variables:
 *   AZURE_OPENAI_INSPIRE_DEPLOYMENT — Optional. Dedicated deployment for inspiration
 *     generation (e.g., gpt-5.4-nano for fast/cheap calls). Falls back to
 *     AZURE_OPENAI_CHAT_DEPLOYMENT → AZURE_OPENAI_DEPLOYMENT if not set.
 */

import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

interface InspirationIdea {
  title: string;
  subtitle: string;
  prompt: string;
}

// ---------------------------------------------------------------------------
// Hardcoded fallback ideas (mirrored from packages/web/js/app.js)
// ---------------------------------------------------------------------------

const FALLBACK_IDEAS: InspirationIdea[] = [
  {
    title: "Movie night pick that settles disputes",
    subtitle: "Your group votes, and the app chooses confidently.",
    prompt:
      "I want to build a movie night pick app that settles disputes — your group votes, and the app chooses confidently.",
  },
  {
    title: "AI recipe finder from fridge photos",
    subtitle: "Snap a photo of your fridge, get dinner ideas instantly.",
    prompt:
      "I want to build an AI recipe finder from fridge photos — snap a photo of your fridge, get dinner ideas instantly.",
  },
  {
    title: "Team standup bot that respects time zones",
    subtitle: "Async standups that actually work for global teams.",
    prompt:
      "I want to build a team standup bot that respects time zones — async standups that actually work for global teams.",
  },
  {
    title: "Pet adoption matcher powered by AI",
    subtitle: "Swipe-style matching between shelters and families.",
    prompt:
      "I want to build a pet adoption matcher powered by AI — swipe-style matching between shelters and families.",
  },
  {
    title: "Real-time air quality dashboard",
    subtitle: "Hyperlocal pollution data with health recommendations.",
    prompt:
      "I want to build a real-time air quality dashboard — hyperlocal pollution data with health recommendations.",
  },
  {
    title: "Neighborhood tool lending library",
    subtitle:
      "Borrow a drill from your neighbor — no awkward texts required.",
    prompt:
      "I want to build a neighborhood tool lending library — borrow a drill from your neighbor, no awkward texts required.",
  },
  {
    title: "Personal finance coach that speaks plain English",
    subtitle: "Budget tracking without the spreadsheet headaches.",
    prompt:
      "I want to build a personal finance coach that speaks plain English — budget tracking without the spreadsheet headaches.",
  },
  {
    title: "Workout generator for hotel rooms",
    subtitle: "No equipment? No problem. AI builds a routine in seconds.",
    prompt:
      "I want to build a workout generator for hotel rooms — no equipment needed, AI builds a routine in seconds.",
  },
  {
    title: "Live event parking optimizer",
    subtitle: "Find the fastest lot and walking route to the venue.",
    prompt:
      "I want to build a live event parking optimizer — find the fastest lot and walking route to the venue.",
  },
  {
    title: "Study group matchmaker for college",
    subtitle:
      "Match with classmates by course, schedule, and study style.",
    prompt:
      "I want to build a study group matchmaker for college — match with classmates by course, schedule, and study style.",
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

// Domain categories used to steer each inspiration call toward a different
// industry/theme, preventing consecutive calls from producing similar ideas.
const INSPIRATION_DOMAINS = [
  "healthcare & biotech",
  "education & e-learning",
  "finance & fintech",
  "gaming & entertainment",
  "travel & hospitality",
  "agriculture & food tech",
  "sustainability & green energy",
  "music & audio",
  "fitness & wellness",
  "logistics & supply chain",
  "real estate & proptech",
  "social impact & nonprofits",
  "retail & e-commerce",
  "sports & analytics",
  "IoT & smart home",
  "creative arts & design",
  "legal & compliance",
  "HR & recruitment",
  "space & astronomy",
  "pets & animal care",
] as const;

/** Pick a random domain hint to inject variety into each call. */
function randomDomainHint(): string {
  return INSPIRATION_DOMAINS[
    Math.floor(Math.random() * INSPIRATION_DOMAINS.length)
  ];
}

/** Check whether Azure OpenAI env vars are configured. */
function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT) &&
    process.env.AZURE_OPENAI_API_KEY
  );
}

/** Generate ideas via Azure OpenAI (non-streaming). */
async function generateIdeas(): Promise<InspirationIdea[]> {
  const { chatCompletion, getInspireDeploymentName } = await import("../lib/openai-client.js");
  const domain = randomDomainHint();
  const inspireDeployment = getInspireDeploymentName();

  const result = await chatCompletion(
    [
      {
        role: "system",
        content: `You generate a single creative app idea for a developer to build and deploy to Azure Kubernetes Service in a couple of hours. Be wildly creative and original. Never repeat common themes like todo apps, weather dashboards, or chat bots. Pick an unexpected angle from the domain hinted below. The idea should be small enough to implement in one focused coding session but impressive enough to demo. It MUST require a server-side component — a backend API, a database, or an AI/ML service. Return ONLY a JSON array with exactly 1 object containing "title" (short catchy name, max 8 words), "subtitle" (one-line description, max 12 words), and "prompt" (a first-person sentence starting with "I want to build"). No emoji. No markdown. Raw JSON only. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
      },
      {
        role: "user",
        content: `Generate 1 creative app idea in the "${domain}" space that requires server-side deployment. Think web apps with APIs, AI agents, real-time services, data pipelines, or multi-tier architectures. Surprise me with something novel.`,
      },
    ],
    {
      temperature: 1,
      maxTokens: 300,
      ...(inspireDeployment ? { deployment: inspireDeployment } : {}),
    },
  );

  const parsed = JSON.parse(result.content) as InspirationIdea[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format from OpenAI");
  }
  return parsed;
}

/** Stream a text character-by-character with small delays (simulated streaming). */
async function* simulateStream(text: string): AsyncGenerator<string> {
  for (const char of text) {
    yield char;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Format SSE data line. */
function sseData(content: string): string {
  return `data: ${content}\n\n`;
}

// ---------------------------------------------------------------------------
// Endpoint
// ---------------------------------------------------------------------------

app.http("inspirations", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "inspirations",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const url = new URL(request.url);
    const isStreaming = url.searchParams.get("stream") === "true";

    try {
      // STREAMING PATH
      if (isStreaming) {
        if (!isOpenAIConfigured()) {
          return {
            status: 503,
            headers: { "Content-Type": "application/json" },
            jsonBody: { error: "Azure OpenAI not configured." },
          };
        }

        const { chatCompletionStream, getInspireDeploymentName } = await import("../lib/openai-client.js");
        const domain = randomDomainHint();
        const inspireDeployment = getInspireDeploymentName();
        
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              const gen = chatCompletionStream(
                [
                  {
                    role: "system",
                    content: `You generate a single creative app idea for a developer to build and deploy to Azure Kubernetes Service in a couple of hours. Be wildly creative and original. Never repeat common themes like todo apps, weather dashboards, or chat bots. Pick an unexpected angle from the domain hinted below. The idea should be small enough to implement in one focused coding session but impressive enough to demo. It MUST require a server-side component — a backend API, a database, or an AI/ML service. Return ONLY the idea as a single first-person sentence starting with "I want to build" (no JSON, no markdown, no title, just the sentence). Keep it under 25 words. No emoji. All generated ideas must be appropriate for a professional tech audience. Never generate ideas related to weapons, violence, illegal activities, adult content, gambling, or anything harmful or offensive. Keep ideas constructive, inclusive, and suitable for a workplace demo.`,
                  },
                  {
                    role: "user",
                    content: `Generate 1 creative app idea in the "${domain}" space that requires server-side deployment. Surprise me with something novel.`,
                  },
                ],
                {
                  temperature: 1,
                  maxTokens: 400,
                  ...(inspireDeployment ? { deployment: inspireDeployment } : {}),
                },
              );

              for await (const chunk of gen) {
                controller.enqueue(encoder.encode(sseData(chunk)));
              }
              controller.enqueue(encoder.encode(sseData("[DONE]")));
              controller.close();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              context.log(`Streaming error: ${msg}`);
              controller.enqueue(encoder.encode(sseData(`[ERROR] ${msg}`)));
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
      }

      // NON-STREAMING PATH (original behavior)
      if (!isOpenAIConfigured()) {
        return {
          status: 503,
          headers: { "Content-Type": "application/json" },
          jsonBody: { error: "Azure OpenAI not configured. Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and a deployment name." },
        };
      }

      let ideas: InspirationIdea[];
      try {
        ideas = await generateIdeas();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.log(`OpenAI generation failed: ${msg}`);
        return {
          status: 502,
          headers: { "Content-Type": "application/json" },
          jsonBody: { error: `Inspiration generation failed: ${msg}` },
        };
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        jsonBody: ideas,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.log(`Inspirations error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
