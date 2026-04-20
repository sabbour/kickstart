/**
 * GET /api/packs — returns a safe client DTO with component catalog and UserAction manifests.
 *
 * Never exposes: agent instructions, skill bodies, tool implementations, file paths, or credentials.
 *
 * Leela C5: playgroundScenarios are included in the response so Playground.tsx can list them
 * without a direct registry import.
 */

import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getRegistry } from "../startup/packs.js";
import type { ComponentContribution, PlaygroundScenario } from "@aks-kickstart/harness";

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
}

async function packs(
  _request: HttpRequest,
  _ctx: InvocationContext,
): Promise<HttpResponseInit> {
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
    return {
      status: 500,
      jsonBody: { error: err instanceof Error ? err.message : String(err) },
    };
  }
}

app.http("packs", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "packs",
  handler: packs,
});
