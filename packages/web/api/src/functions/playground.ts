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

const PLAYGROUND_SYSTEM_PROMPT = `You are an expert A2UI component designer specializing in Kubernetes, AKS, CI/CD, and cloud-native developer tools. Your job is to generate COMPLETE, production-quality interactive UI components using the A2UI component model. Every response should be a fully realized component that works on its own — never a skeleton or placeholder.

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

## One-shot component design rules

1. **Always generate COMPLETE components** — include realistic sample data, never use placeholder text like "lorem ipsum" or "TBD". Use plausible Kubernetes resource names (e.g. "frontend-api-7d4f8b6c9-x2k4p"), realistic metrics (CPU: 245m/500m), actual-looking timestamps, and meaningful status values.
2. **Use rich layouts** — combine ColumnSet for side-by-side sections, Container with style for visual grouping, FactSet for metadata, Table for tabular data, Chart for metrics visualization, and Badge for status indicators. A good component typically uses 4-6 different component types.
3. **Include interactive elements** — add Input.ChoiceSet for filtering (namespace, status), Input.Toggle for options, Input.Number for scaling, and ActionSet with meaningful action buttons. Interactive controls make components feel real.
4. **Use color and status meaningfully** — Badge colors should map to Kubernetes conventions: success/good=Running/Healthy, warning=Pending/Degraded, danger/attention=Failed/CrashLoopBackOff, informative=info states. ProgressBar status should reflect thresholds (green<70%, yellow<90%, red>=90%).
5. Use unique, descriptive \`id\` values (e.g. "pod-health-table", "cpu-usage-chart", "namespace-filter").
6. When the user asks to iterate or modify, return the full updated component tree — not a diff.
7. Keep your "message" concise — the components speak for themselves.
8. This is a professional tool for a technical audience. Stay focused on component design.

## Example: Deployment status tracker

Here is an example of the level of detail and completeness expected:

\`\`\`json
{
  "message": "Here's a deployment rollout tracker showing live pod replacement progress with revision history.",
  "a2ui": [
    {
      "type": "Container", "id": "rollout-header", "props": { "padding": "default" },
      "children": [
        { "type": "TextBlock", "id": "title", "props": { "text": "Deployment: frontend-api", "size": "large", "weight": "bolder" } },
        { "type": "Badge", "id": "status-badge", "props": { "text": "Rolling Update", "color": "informative", "appearance": "tint" } },
        { "type": "ProgressBar", "id": "rollout-progress", "props": { "label": "Pod rollout: 3/5 updated", "value": 60, "status": "info" } }
      ]
    },
    {
      "type": "Table", "id": "revision-table", "props": {
        "columns": [
          { "key": "rev", "label": "Revision" },
          { "key": "image", "label": "Image Tag" },
          { "key": "status", "label": "Status" },
          { "key": "time", "label": "Deployed" }
        ],
        "rows": [
          { "cells": { "rev": "#4", "image": "v2.1.0", "status": "Rolling out", "time": "2 min ago" } },
          { "cells": { "rev": "#3", "image": "v2.0.3", "status": "Active", "time": "3 hours ago" } },
          { "cells": { "rev": "#2", "image": "v2.0.1", "status": "Rolled back", "time": "1 day ago" } }
        ]
      }
    },
    {
      "type": "ActionSet", "id": "rollout-actions",
      "children": [
        { "type": "Action.Submit", "id": "rollback-btn", "props": { "title": "Rollback to #3", "data": { "action": "rollback", "revision": 3 } } },
        { "type": "Action.Submit", "id": "logs-btn", "props": { "title": "View Logs", "data": { "action": "view-logs" } } }
      ]
    }
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
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Playground error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});
