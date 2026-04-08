/**
 * @module @kickstart/api/functions/inspirations
 *
 * GET /api/inspirations — Returns carousel inspiration ideas for the landing page.
 *
 * If Azure OpenAI is configured, generates creative app ideas via LLM.
 * Otherwise, returns a shuffled subset of hardcoded fallback ideas.
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

/** Check whether Azure OpenAI env vars are configured. */
function isOpenAIConfigured(): boolean {
  return !!(
    process.env.AZURE_OPENAI_ENDPOINT &&
    (process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || process.env.AZURE_OPENAI_DEPLOYMENT) &&
    process.env.AZURE_OPENAI_API_KEY
  );
}

/** Generate ideas via Azure OpenAI. */
async function generateIdeas(): Promise<InspirationIdea[]> {
  const { chatCompletion } = await import("../lib/openai-client.js");

  const result = await chatCompletion(
    [
      {
        role: "system",
        content: `You generate creative app ideas for developers who want to deploy to Azure. Each idea should be a real-world useful application that a developer would be excited to build. Return ONLY a JSON array of exactly 10 objects, each with "title" (short catchy name, max 8 words), "subtitle" (one-line description, max 12 words), and "prompt" (a first-person sentence starting with "I want to build"). No emoji. No markdown. Raw JSON only.`,
      },
      {
        role: "user",
        content:
          "Generate 10 creative and diverse app ideas spanning web apps, APIs, AI agents, data dashboards, and developer tools.",
      },
    ],
    { temperature: 0.9, maxTokens: 1500 },
  );

  const parsed = JSON.parse(result.content) as InspirationIdea[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Invalid response format from OpenAI");
  }
  return parsed;
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
    try {
      let ideas: InspirationIdea[];

      if (isOpenAIConfigured()) {
        try {
          ideas = await generateIdeas();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          context.warn(`OpenAI generation failed, using fallback: ${msg}`);
          ideas = shuffle(FALLBACK_IDEAS);
        }
      } else {
        ideas = shuffle(FALLBACK_IDEAS);
      }

      return {
        status: 200,
        headers: { "Content-Type": "application/json" },
        jsonBody: ideas,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Inspirations error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
