import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeRunId } from "./azure-deployments.js";
import { AzureApiError } from "./azure-errors.js";

function createRunId(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

describe("decodeRunId", () => {
  const originalSecret = process.env.DEPLOY_RUN_SECRET;

  beforeEach(() => {
    process.env.DEPLOY_RUN_SECRET = "test-run-secret";
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.DEPLOY_RUN_SECRET;
    } else {
      process.env.DEPLOY_RUN_SECRET = originalSecret;
    }
  });

  it("accepts a valid signed run ID", () => {
    const payload = {
      principalId: "principal-123",
      sessionId: "session-123",
      subscriptionId: "sub-123",
      resourceGroup: "kickstart-rg",
      deploymentName: "kickstart-main",
      healthCheckPath: "/",
      startedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };

    const decoded = decodeRunId(createRunId(payload, process.env.DEPLOY_RUN_SECRET!));

    expect(decoded).toMatchObject(payload);
  });

  it("rejects expired run IDs", () => {
    const payload = {
      principalId: "principal-123",
      sessionId: "session-123",
      subscriptionId: "sub-123",
      resourceGroup: "kickstart-rg",
      deploymentName: "kickstart-main",
      healthCheckPath: "/",
      startedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: "2020-01-01T00:00:00.000Z",
    };

    expect(() => decodeRunId(createRunId(payload, process.env.DEPLOY_RUN_SECRET!)))
      .toThrowError(AzureApiError);

    try {
      decodeRunId(createRunId(payload, process.env.DEPLOY_RUN_SECRET!));
    } catch (error) {
      expect(error).toMatchObject({
        status: 410,
        code: "run_id_expired",
      });
    }
  });

  it("rejects tampered signatures", () => {
    const payload = {
      principalId: "principal-123",
      sessionId: "session-123",
      subscriptionId: "sub-123",
      resourceGroup: "kickstart-rg",
      deploymentName: "kickstart-main",
      healthCheckPath: "/",
      startedAt: "2026-04-15T12:00:00.000Z",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };

    const runId = createRunId(payload, "different-secret");

    expect(() => decodeRunId(runId)).toThrowError(AzureApiError);

    try {
      decodeRunId(runId);
    } catch (error) {
      expect(error).toMatchObject({
        status: 400,
        code: "invalid_run_id",
      });
    }
  });
});
