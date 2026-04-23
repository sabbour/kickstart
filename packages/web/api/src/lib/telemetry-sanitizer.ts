import { createHash, randomUUID } from "node:crypto";

export { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

export function createSafeCorrelationId(sensitiveId: string | undefined): string {
  if (!sensitiveId || sensitiveId === "anonymous") {
    return "anonymous";
  }

  return createHash("sha256").update(sensitiveId).digest("hex").slice(0, 12);
}

export function createRequestId(): string {
  return randomUUID();
}
