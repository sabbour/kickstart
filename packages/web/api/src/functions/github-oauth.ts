import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";

const GONE_RESPONSE: HttpResponseInit = {
  status: 410,
  jsonBody: {
    error: "The legacy GitHub device-flow proxy has been removed. Use /api/github-auth/login.",
  },
  headers: {
    "Cache-Control": "no-store",
  },
};

app.http("github-oauth-legacy", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  route: "github-oauth/{*path}",
  handler: async (_request: HttpRequest): Promise<HttpResponseInit> => GONE_RESPONSE,
});
