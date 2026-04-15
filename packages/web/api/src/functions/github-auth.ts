import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import {
  GitHubAuthError,
  completeGitHubAuth,
  destroyGitHubAuthCookies,
  getGitHubAuthLogin,
  getGitHubPrincipalId,
  getGitHubSessionState,
  isGitHubConfigured,
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

function popupHtmlResponse(
  request: HttpRequest,
  messageType: "kickstart:github-auth:complete" | "kickstart:github-auth:error",
  message: string,
  returnTo = "/",
  cookies = [] as HttpResponseInit["cookies"],
): HttpResponseInit {
  const payload = JSON.stringify({
    type: messageType,
    error: messageType === "kickstart:github-auth:error" ? message : undefined,
  });
  const encodedPayload = Buffer.from(payload, "utf8").toString("base64url");
  const safePayload = encodedPayload
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeReturnTo = returnTo
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return {
    status: messageType === "kickstart:github-auth:complete" ? 200 : 400,
    cookies,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GitHub sign-in</title>
  </head>
  <body
    data-auth-payload="${safePayload}"
    data-return-to="${safeReturnTo}"
    data-message="${safeMessage}"
  >
    <p id="status">${messageType === "kickstart:github-auth:complete" ? "Finishing GitHub sign-in…" : safeMessage}</p>
    <script src="/github-auth-callback.js" defer></script>
  </body>
</html>`,
  };
}

app.http("github-auth", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "github-auth/{action}",
  handler: async (
    request: HttpRequest,
    context: InvocationContext,
  ): Promise<HttpResponseInit> => {
    const action = request.params["action"] ?? "";

    try {
      if (request.method === "GET" && action === "login") {
        const principalId = getGitHubPrincipalId(request);
        if (!principalId) {
          return popupHtmlResponse(
            request,
            "kickstart:github-auth:error",
            "Sign in to Kickstart before connecting GitHub.",
          );
        }

        if (!isGitHubConfigured()) {
          return popupHtmlResponse(
            request,
            "kickstart:github-auth:error",
            "GitHub OAuth is not configured on the server.",
          );
        }

        const { location, cookies } = getGitHubAuthLogin(
          request,
          principalId,
          request.query.get("returnTo"),
        );

        return {
          status: 302,
          cookies,
          headers: {
            Location: location,
            "Cache-Control": "no-store",
          },
        };
      }

      if (request.method === "GET" && action === "callback") {
        const error = request.query.get("error");
        if (error) {
          return popupHtmlResponse(
            request,
            "kickstart:github-auth:error",
            "GitHub sign-in was cancelled or denied.",
            "/",
            destroyGitHubAuthCookies(request),
          );
        }

        const { cookies, returnTo } = await completeGitHubAuth(
          request,
          request.query.get("code"),
          request.query.get("state"),
        );

        return popupHtmlResponse(
          request,
          "kickstart:github-auth:complete",
          "GitHub sign-in complete.",
          returnTo,
          cookies,
        );
      }

      if (request.method === "GET" && action === "session") {
        const { state, cookies } = await getGitHubSessionState(request);
        return jsonResponse(200, state, cookies);
      }

      if (request.method === "POST" && action === "logout") {
        return {
          status: 204,
          cookies: destroyGitHubAuthCookies(request),
          headers: {
            "Cache-Control": "no-store",
          },
        };
      }

      return jsonResponse(404, { error: "Not found" });
    } catch (error) {
      if (error instanceof GitHubAuthError) {
        if (action === "login" || action === "callback") {
          return popupHtmlResponse(
            request,
            "kickstart:github-auth:error",
            error.message,
            "/",
            error.cookies,
          );
        }

        return jsonResponse(error.status, { error: error.message }, error.cookies);
      }

      context.error(`[github-auth] ${action || "unknown"} failed`);
      if (error instanceof Error && error.stack) {
        context.error(error.stack);
      }

      if (action === "login" || action === "callback") {
        return popupHtmlResponse(
          request,
          "kickstart:github-auth:error",
          "GitHub sign-in failed.",
          "/",
          destroyGitHubAuthCookies(request),
        );
      }

      return jsonResponse(500, { error: "GitHub request failed." });
    }
  },
});
