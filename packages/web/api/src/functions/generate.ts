/**
 * @module @kickstart/api/functions/generate
 *
 * POST /api/generate — Code generation endpoint powered by the Codex model
 * (Azure OpenAI Responses API).
 *
 * Accepts a prompt + optional type hint, calls gpt-5.3-codex, and returns
 * generated code. Supports SSE streaming via Accept: text/event-stream.
 */

import { app } from "@azure/functions";
import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import {
  codexCompletion,
  codexCompletionStream,
  isConfigured,
} from "../lib/openai-client.js";
import type { ChatMessage } from "../lib/openai-client.js";

type GenerateType =
  | "dockerfile"
  | "kubernetes"
  | "pipeline"
  | "bicep"
  | "generic";

interface GenerateRequest {
  prompt: string;
  type?: GenerateType;
  context?: string;
}

interface GenerateResponse {
  type: GenerateType;
  code: string;
  responseId: string;
}

const SYSTEM_INSTRUCTIONS: Record<GenerateType, string> = {
  dockerfile:
    "You are a code generation assistant specializing in Dockerfiles. Generate production-ready, multi-stage Dockerfiles with security best practices (non-root user, minimal base images, .dockerignore awareness). Output ONLY the Dockerfile content, no markdown fences or explanation.",
  kubernetes:
    "You are a code generation assistant specializing in Kubernetes manifests for AKS Automatic. Generate production-ready YAML (Deployment, Service, Ingress, HPA) following AKS best practices (resource requests/limits, readiness/liveness probes, pod disruption budgets). Output ONLY the YAML content, no markdown fences or explanation.",
  pipeline:
    "You are a code generation assistant specializing in GitHub Actions CI/CD pipelines. Generate workflows that build, test, and deploy to Azure Kubernetes Service using OIDC authentication. Output ONLY the YAML content, no markdown fences or explanation.",
  bicep:
    "You are a code generation assistant specializing in Azure Bicep templates. Generate infrastructure-as-code for AKS Automatic clusters, Azure Container Registry, and related resources following Azure Well-Architected Framework principles. Output ONLY the Bicep content, no markdown fences or explanation.",
  generic:
    "You are a code generation assistant. Generate clean, production-ready code. Output ONLY the code content, no markdown fences or explanation unless explicitly requested.",
};

app.http("generate", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "generate",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      if (!isConfigured()) {
        return {
          status: 503,
          jsonBody: { error: "Azure OpenAI is not configured" },
        };
      }

      const body = (await request.json()) as GenerateRequest;

      if (!body.prompt?.trim()) {
        return { status: 400, jsonBody: { error: "prompt is required" } };
      }

      const type: GenerateType = body.type ?? "generic";
      const instructions = SYSTEM_INSTRUCTIONS[type];

      const input: ChatMessage[] = [
        { role: "user", content: body.prompt },
      ];

      // Append optional context (e.g. existing app description)
      if (body.context) {
        input.unshift({
          role: "user",
          content: `Context about the application:\n${body.context}`,
        });
      }

      const wantsStream = request.headers
        .get("accept")
        ?.includes("text/event-stream");

      if (wantsStream) {
        return handleCodexStreaming(input, instructions, type, context);
      }

      const result = await codexCompletion(input, {
        instructions,
        temperature: 0.2,
        maxOutputTokens: 4096,
      });

      const responseBody: GenerateResponse = {
        type,
        code: result.content,
        responseId: result.responseId,
      };

      return { status: 200, jsonBody: responseBody };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.error(`Generate error: ${message}`);
      return { status: 500, jsonBody: { error: message } };
    }
  },
});

/** Handle SSE streaming for codex generation. */
function handleCodexStreaming(
  input: ChatMessage[],
  instructions: string,
  type: GenerateType,
  context: InvocationContext,
): HttpResponseInit {
  const encoder = new TextEncoder();
  let fullContent = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of codexCompletionStream(input, {
          instructions,
          temperature: 0.2,
          maxOutputTokens: 4096,
        })) {
          fullContent += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`),
          );
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ done: true, type, length: fullContent.length })}\n\n`,
          ),
        );
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        context.error(`Codex stream error: ${msg}`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
        );
        controller.close();
      }
    },
  });

  return {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
    body: stream,
  };
}
