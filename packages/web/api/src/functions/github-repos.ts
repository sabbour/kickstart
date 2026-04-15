import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  GitHubAuthError,
  createGitHubRepoForRequest,
  listGitHubReposForRequest,
} from "../lib/github-auth.js";

function jsonResponse(
  status: number,
  jsonBody: unknown,
  cookies = [] as HttpResponseInit["cookies"],
): HttpResponseInit {
  return {
    status,
    jsonBody,
    cookies,
    headers: {
      "Cache-Control": "no-store",
    },
  };
}

app.http("github-repos", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "github/repos",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      if (request.method === "GET") {
        const page = Number.parseInt(request.query.get("page") || "1", 10);
        const perPage = Number.parseInt(request.query.get("perPage") || "20", 10);
        const owner = request.query.get("owner");
        const { repos, cookies } = await listGitHubReposForRequest(
          request,
          owner,
          page,
          perPage,
        );

        return jsonResponse(200, { repos }, cookies);
      }

      if (request.method === "POST") {
        const body = await request.json() as {
          owner?: unknown;
          name?: unknown;
          description?: unknown;
          private?: unknown;
        };

        const { repo, cookies } = await createGitHubRepoForRequest(request, {
          owner: typeof body.owner === "string" ? body.owner : "",
          name: typeof body.name === "string" ? body.name : "",
          description: typeof body.description === "string" ? body.description : undefined,
          private: Boolean(body.private),
        });

        return jsonResponse(201, { repo }, cookies);
      }

      return jsonResponse(405, { error: "Method not allowed" });
    } catch (error) {
      if (error instanceof GitHubAuthError) {
        return jsonResponse(error.status, { error: error.message }, error.cookies);
      }

      context.error("[github-repos] request failed");
      if (error instanceof Error && error.stack) {
        context.error(error.stack);
      }

      return jsonResponse(500, { error: "GitHub request failed." });
    }
  },
});
