import { app } from "@azure/functions";
app.http("health", {
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async (_req, _ctx) => {
        return {
            status: 200,
            jsonBody: { status: "ok" },
        };
    },
});
//# sourceMappingURL=health.js.map