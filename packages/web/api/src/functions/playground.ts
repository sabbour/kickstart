/**
 * @module @aks-kickstart/api/functions/playground
 *
 * POST /api/playground — Dedicated endpoint for the A2UI Playground Create tab.
 *
 * Accepts a user message and returns a JSON response with an AI-generated
 * A2UI component design. Uses a specialised system prompt focused on
 * iterating over A2UI component structures rather than the Kickstart
 * onboarding flow.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { randomUUID } from "node:crypto";
import { chatCompletion, getChatDeploymentName } from "../lib/openai-client.js";
import { chatCompletionWithAutoContinue } from "../lib/auto-continue.js";
import { checkContentSafety } from "../lib/content-safety.js";
import { checkRateLimit, rateLimitResponse } from "../lib/rate-limiter.js";
import { safeErrorResponse } from "../lib/error-response.js";
import type { ChatMessage } from "../lib/openai-client.js";

// ── Types ────────────────────────────────────────────────────────────────

interface PlaygroundRequest {
  sessionId?: string;
  message: string;
}

interface PlaygroundResponse {
  sessionId: string;
  message: string;
  a2ui?: object[];
}

// ── In-memory session store (lightweight, playground-only) ───────────────

interface PlaygroundSession {
  messages: ChatMessage[];
  lastAccessed: number;
}

const sessions = new Map<string, PlaygroundSession>();
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - s.lastAccessed > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);
cleanupInterval.unref();

// ── System prompt ────────────────────────────────────────────────────────

const PLAYGROUND_SYSTEM_PROMPT = `You are an expert A2UI component designer specializing in Kubernetes, AKS, CI/CD, and cloud-native developer tools. Your job is to generate COMPLETE, production-quality interactive UI components using the A2UI flat component model. Every response should be a fully realized component that works on its own — never a skeleton or placeholder.

## Response format

You MUST always respond with a valid JSON object in this exact shape:

\`\`\`json
{
  "message": "A short natural-language explanation of what you built or changed.",
  "a2ui": [
    { "id": "root", "component": "Column", "children": ["child-1", "child-2"] },
    { "id": "child-1", "component": "Text", "text": "Hello", "variant": "h2" },
    { "id": "child-2", "component": "Text", "text": "World", "variant": "body" }
  ]
}
\`\`\`

- "message" is required — a brief, friendly explanation for the user.
- "a2ui" is a **flat array** of components. Omit it (or use an empty array) only when the user asks a question that does not require a visual component.

## CRITICAL: Flat component format

Components are NEVER nested. Every component is a top-level entry in the array. Children are referenced by ID strings, not inline objects.

Each component object has:
- \`id\` (string) — unique identifier. **Exactly one component MUST have \`"id": "root"\`** — this is the entry point.
- \`component\` (string) — the component type name.
- All other properties are the component's props, placed directly on the object (NOT inside a "props" wrapper).

### Available component types and their props

**Layout:**
| Component | Props |
|-----------|-------|
| Column | children (string[]: child IDs), justify?, align? |
| Row | children (string[]: child IDs), justify?, align? |
| Card | child (string: single child ID) OR children (string[]: child IDs), title? (string) |
| Divider | — |

**Content:**
| Component | Props |
|-----------|-------|
| Text | text (string), variant? (h1/h2/h3/subtitle1/subtitle2/caption/body) |
| Markdown | content (string: markdown text) |
| Image | url (string), alt? (string) |
| CodeBlock | code (string), language? (string), filename? (string) |

**Interactive:**
| Component | Props |
|-----------|-------|
| Button | child (string: ID of a Text component for the label), variant? (default/primary/borderless), action? (object) |
| TextField | label? (string), placeholder? (string) |
| CheckBox | label? (string) |
| ChoicePicker | label?, options (array of {id, label, description?}) |
| RadioGroup | label?, options (array of {id, label, description?, recommended?}) |

**Data display:**
| Component | Props |
|-----------|-------|
| ProgressSteps | steps (array of {label, status}) |

### Children rules
- Column and Row use \`children: ["id1", "id2"]\` — an array of child component ID strings.
- Card uses \`child: "id"\` (single child) or \`children: ["id"]\`.
- Button uses \`child: "id"\` pointing to a Text component for its label.
- Text, Markdown, Image, CodeBlock, Divider, ProgressSteps are leaf components — no children.
- Children are ALWAYS ID strings referencing other components in the flat array — NEVER inline objects.

## Design rules

1. **Always generate COMPLETE components** — include realistic sample data, never placeholder text. Use plausible Kubernetes resource names (e.g. "frontend-api-7d4f8b6c9-x2k4p"), realistic metrics (CPU: 245m/500m), actual timestamps, and meaningful statuses.
2. **Use rich layouts** — combine Row for side-by-side sections, Card for visual grouping, Column for vertical stacking, Markdown for rich formatted text with tables and lists. A good component uses 3-5 different types.
3. **Include interactive elements** — add ChoicePicker or RadioGroup for filtering, CheckBox for toggles, Button for actions.
4. Use unique, descriptive \`id\` values (e.g. "pod-health-title", "cpu-metric", "namespace-filter").
5. When iterating or modifying, return the full updated flat component array — not a diff.
6. Keep your "message" concise — the components speak for themselves.
7. **Use Markdown for complex content** — tables, lists, multi-line formatted text. The Markdown component handles this well.

## Example: Deployment status tracker

\`\`\`json
{
  "message": "Here's a deployment rollout tracker showing pod replacement progress with revision history.",
  "a2ui": [
    { "id": "root", "component": "Column", "children": ["header-card", "details-card", "actions-row"] },
    { "id": "header-card", "component": "Card", "child": "header-col" },
    { "id": "header-col", "component": "Column", "children": ["title", "status-text", "steps"] },
    { "id": "title", "component": "Text", "text": "Deployment: frontend-api", "variant": "h2" },
    { "id": "status-text", "component": "Text", "text": "Rolling update in progress — 3 of 5 pods updated", "variant": "body" },
    { "id": "steps", "component": "ProgressSteps", "steps": [
      { "label": "Pull image v2.1.0", "status": "completed" },
      { "label": "Replace pods (3/5)", "status": "active" },
      { "label": "Health checks", "status": "pending" }
    ] },
    { "id": "details-card", "component": "Card", "child": "details-md" },
    { "id": "details-md", "component": "Markdown", "content": "### Revision History\\n\\n| Rev | Image | Status | Deployed |\\n|-----|-------|--------|----------|\\n| #4 | v2.1.0 | Rolling out | 2 min ago |\\n| #3 | v2.0.3 | Active | 3 hours ago |\\n| #2 | v2.0.1 | Rolled back | 1 day ago |" },
    { "id": "actions-row", "component": "Row", "children": ["rollback-btn", "rollback-label", "logs-btn", "logs-label"] },
    { "id": "rollback-btn", "component": "Button", "child": "rollback-label", "variant": "default" },
    { "id": "rollback-label", "component": "Text", "text": "Rollback to #3" },
    { "id": "logs-btn", "component": "Button", "child": "logs-label", "variant": "primary" },
    { "id": "logs-label", "component": "Text", "text": "View Logs" }
  ]
}
\`\`\`

Generate components at this level of completeness and realism. Every component should look like it's showing real Kubernetes/cloud data.`;

// ── Handler ──────────────────────────────────────────────────────────────

app.http("playground", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "playground",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    // Rate limit check
    const rateCheck = checkRateLimit(request);
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck.retryAfterMs!);
    }

    try {
      const body = (await request.json()) as PlaygroundRequest;

      if (!body.message?.trim()) {
        return { status: 400, jsonBody: { error: "message is required" } };
      }

      // Content safety pre-flight
      const safetyResult = await checkContentSafety(body.message);
      if (!safetyResult.safe) {
        return { status: 400, jsonBody: { error: safetyResult.error } };
      }

      // Resolve or create session
      let sessionId = body.sessionId;
      let session: PlaygroundSession | undefined;

      if (sessionId) {
        session = sessions.get(sessionId);
      }

      if (!session) {
        sessionId = randomUUID();
        session = {
          messages: [{ role: "system", content: PLAYGROUND_SYSTEM_PROMPT }],
          lastAccessed: Date.now(),
        };
        sessions.set(sessionId, session);
      }

      session.lastAccessed = Date.now();

      // Append user message
      session.messages.push({ role: "user", content: body.message });

      // Call Azure OpenAI with JSON mode + auto-continue for truncation handling
      const result = await chatCompletionWithAutoContinue(session.messages, {
        responseFormat: { type: "json_object" },
        temperature: 1,
        maxTokens: 4096,
      });

      // Parse the LLM's JSON envelope
      let message = result.content;
      let a2ui: object[] | undefined;

      try {
        const parsed = JSON.parse(result.content) as {
          message?: string;
          a2ui?: object[];
        };
        message = parsed.message ?? result.content;
        a2ui = parsed.a2ui && parsed.a2ui.length > 0 ? parsed.a2ui : undefined;
      } catch {
        // LLM returned non-JSON — use raw content as message
      }

      // Store assistant reply in session history
      session.messages.push({ role: "assistant", content: result.content });

      const responseBody: PlaygroundResponse = {
        sessionId: sessionId!,
        message,
        ...(a2ui ? { a2ui } : {}),
      };

      return { status: 200, jsonBody: responseBody };
    } catch (err) {
      return safeErrorResponse(err, context, "Playground error");
    }
  },
});
