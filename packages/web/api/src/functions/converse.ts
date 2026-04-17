// TODO(Step 5): converse.ts will be rewritten as the v2 harness converse handler.
// This stub satisfies the Azure Functions registration until Step 5.
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

async function converse(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log("converse handler: stub — Step 5 will implement v2 runner");
  return {
    status: 503,
    body: JSON.stringify({ error: "v2 converse handler not yet implemented (Step 5)" }),
    headers: { "Content-Type": "application/json" },
  };
}

app.http("converse", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "converse",
  handler: converse,
});
