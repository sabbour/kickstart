/**
 * GET /api/packs — returns a safe client DTO with component catalog and UserAction manifests.
 *
 * Never exposes: agent instructions, skill bodies, tool implementations, file paths, or credentials.
 * Error bodies are always opaque — full error detail goes to server-side telemetry only.
 *
 * Leela C5: playgroundScenarios are included in the response so Playground.tsx can list them
 * without a direct registry import.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getRegistry, getLoadErrors } from "../startup/packs.js";
import type { PackLoadError } from "../startup/packs.js";
import type { ComponentContribution, PlaygroundScenario } from "@aks-kickstart/harness";
import { Logger, extractTraceId } from "../lib/logger.js";
import { randomUUID } from "node:crypto";

interface ComponentDTO {
  name: string;
  propertySchema: unknown;
}

interface UserActionDTO {
  name: string;
  wireName: string;
  description: string;
  confirmComponent?: { component: string; props?: Record<string, unknown> };
  scopes: string[];
}

interface PlaygroundScenarioDTO {
  id: string;
  title: string;
  description?: string;
  group?: string;
}

interface PacksResponse {
  components: ComponentDTO[];
  userActions: UserActionDTO[];
  playgroundScenarios: PlaygroundScenarioDTO[];
  loadErrors: PackLoadError[];
}

async function packs(
  request: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  const requestId = randomUUID();
  const traceId = extractTraceId(request.headers);
  const logger = new Logger(ctx, "packs", traceId).withContext({ request_id: requestId });

  try {
    const registry = getRegistry();

    const components: ComponentDTO[] = registry.components.map((c: ComponentContribution) => ({
      name: c.name,
      propertySchema: zodToJsonSchema(c.propertySchema),
    }));

    // Collect UserActions via registry catalog
    const catalog = registry.catalog;
    const userActionDTOs: UserActionDTO[] = [];
    for (const uaName of catalog.userActions ?? []) {
      try {
        const ua = registry.getUserAction(uaName);
        userActionDTOs.push({
          name: ua.name,
          wireName: ua.wireName,
          description: ua.description,
          confirmComponent: ua.confirmComponent,
          scopes: ua.scopes ?? [],
        });
      } catch {
        // Skip unknown user actions
      }
    }

    const scenarioDTOs: PlaygroundScenarioDTO[] = registry.playgroundScenarios.map((s: PlaygroundScenario) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      group: s.group,
    }));

    const body: PacksResponse = {
      components,
      userActions: userActionDTOs,
      playgroundScenarios: scenarioDTOs,
      loadErrors: getLoadErrors(),
    };

    return {
      status: 200,
      jsonBody: body,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    };
  } catch (err) {
    // Log full error server-side (telemetry only — never in the response body).
    logger.error('Registry initialization failed', err instanceof Error ? err : new Error(String(err)), {
      error_code: 'REGISTRY_INIT_FAILED',
    });
    return {
      status: 500,
      jsonBody: { error: 'Registry initialization failed. See server logs.' },
    };
  }
}

app.http("packs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "packs",
  handler: packs,
});

