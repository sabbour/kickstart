import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  GitHubAuthError,
  commitGitHubFilesAndCreatePullRequestForRequest,
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

app.http("github-pulls", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "github/pulls",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    try {
      const body = await request.json() as {
        owner?: unknown;
        repo?: unknown;
        head?: unknown;
        base?: unknown;
        title?: unknown;
        body?: unknown;
        commitMessage?: unknown;
        files?: unknown;
      };

      const result = await commitGitHubFilesAndCreatePullRequestForRequest(request, {
        owner: typeof body.owner === "string" ? body.owner : "",
        repo: typeof body.repo === "string" ? body.repo : "",
        head: typeof body.head === "string" ? body.head : "",
        base: typeof body.base === "string" ? body.base : undefined,
        title: typeof body.title === "string" ? body.title : "",
        body: typeof body.body === "string" ? body.body : undefined,
        commitMessage: typeof body.commitMessage === "string" ? body.commitMessage : undefined,
        files: Array.isArray(body.files)
          ? body.files as { path: string; content: string }[]
          : [],
      });

      return jsonResponse(201, result);
    } catch (error) {
      if (error instanceof GitHubAuthError) {
        return jsonResponse(error.status, { error: error.message }, error.cookies);
      }

      context.error("[github-pulls] request failed");
      if (error instanceof Error && error.stack) {
        context.error(error.stack);
      }

      return jsonResponse(500, { error: "GitHub request failed." });
    }
  },
});
