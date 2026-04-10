/**
 * @module @kickstart/api/functions/playground
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
import { checkContentSafety } from "../lib/content-safety.js";
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

const PLAYGROUND_SYSTEM_PROMPT = `You are an A2UI component designer. Your job is to generate interactive UI components for a chat-based experience using the A2UI component model.

## Response format

You MUST always respond with a valid JSON object in this exact shape:

\`\`\`json
{
  "message": "A short natural-language explanation of what you built or changed.",
  "a2ui": [ ...array of A2UI components... ]
}
\`\`\`

- "message" is required — a brief, friendly explanation for the user.
- "a2ui" is an array of component trees. Omit it (or use an empty array) only when the user is asking a question that does not require a visual component.

## A2UI component schema

Each component is a JSON object:

\`\`\`json
{
  "type": "<ComponentType>",
  "id": "<unique-string>",
  "props": { ... },
  "children": [ ...nested components... ]
}
\`\`\`

### Available component types

| Type | Key props |
|------|-----------|
| TextBlock | text, size (small/medium/large/extraLarge), weight (lighter/default/bolder), color (default/accent/good/attention/warning), wrap (bool) |
| Container | style (default/emphasis/good/attention/warning/accent), padding (none/small/default/large), bleed (bool) |
| Column | width (auto/stretch/1/2/3…), padding, verticalContentAlignment (top/center/bottom) |
| ColumnSet | — (children are Column components) |
| ActionSet | — (children are Action.Submit / Action.OpenUrl) |
| Action.Submit | title, data (object) |
| Action.OpenUrl | title, url |
| Input.Text | id, label, placeholder, isMultiline (bool), maxLength |
| Input.Number | id, label, placeholder, min, max |
| Input.Toggle | id, label, value (string: "true"/"false") |
| Input.ChoiceSet | id, label, isMultiSelect (bool), style (compact/expanded), choices: [{title,value}] |
| Image | url, altText, size (auto/small/medium/large/stretch), horizontalAlignment |
| FactSet | facts: [{title, value}] |
| Table | columns: [{key,label,width?}], rows: [{cells:{[key]:string}}] |
| ProgressBar | label, value (0-100), status (info/success/warning/error) |
| Badge | text, appearance (filled/outline/tint/ghost), color (brand/danger/important/informative/severe/subtle/success/warning), size (small/medium/large), shape (rounded/square/circular) |
| Chart | chartType (bar/line/pie/donut/area), title, data: [{label,value,color?}], height?, showLegend? |

### Nesting rules
- Container, Column, ColumnSet, ActionSet can have \`children\`.
- ColumnSet children must be Column components.
- Leaf components (TextBlock, Image, Badge, Chart, Table, etc.) do not have children.

## Guidelines

1. Generate realistic, visually appealing examples that demonstrate A2UI capabilities.
2. Use unique, descriptive \`id\` values (e.g. "welcome-header", "stats-chart").
3. Combine multiple component types to create rich, layered layouts.
4. When the user asks to iterate or modify, return the full updated component tree — not a diff.
5. Keep your "message" concise — the components speak for themselves.
6. This is a professional tool for a technical audience. Stay focused on component design.`;

// ── Handler ──────────────────────────────────────────────────────────────

app.http("playground", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "playground",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
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

      // Call Azure OpenAI with JSON mode
      const result = await chatCompletion(session.messages, {
        responseFormat: { type: "json_object" },
        temperature: 0.7,
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
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Playground error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
