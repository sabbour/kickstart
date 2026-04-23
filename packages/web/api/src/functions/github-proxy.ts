import { app } from "@azure/functions";
import type { HttpRequest, HttpResponseInit } from "@azure/functions";

const GONE_RESPONSE: HttpResponseInit = {
  status: 410,
  jsonBody: {
    error: "The legacy GitHub pass-through proxy has been removed. Use the server-owned GitHub handoff endpoints.",
  },
  headers: {
    "Cache-Control": "no-store",
  },
};

app.http("github-proxy-legacy", {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
  authLevel: "anonymous",
  route: "github-proxy/{*path}",
  handler: async (_request: HttpRequest): Promise<HttpResponseInit> => GONE_RESPONSE,
});
