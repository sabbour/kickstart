import type { Context } from "@opentelemetry/api";
import type { LogRecordProcessor } from "@opentelemetry/sdk-logs";
import type { SdkLogRecord } from "@opentelemetry/sdk-logs";
import { sanitizeText } from "../telemetry/sanitize-error.js";
import { redactAttributes } from "./redact-attrs.js";

/**
 * LogRecordProcessor that sanitizes `body` and every string attribute on
 * SdkLogRecord before the record leaves the SDK's pipeline.
 *
 * Unlike spans, SdkLogRecord exposes mutating setters (`setAttributes`, writable
 * `body`), so onEmit mutation is contractual here — no decorator needed.
 *
 * Covers the console bridge path: when Azure Monitor's log appender forwards
 * `console.error("auth failed: Bearer …")` into a LogRecord, this processor
 * runs before the batch log-record processor's exporter queues it.
 */
export class RedactingLogRecordProcessor implements LogRecordProcessor {
  onEmit(logRecord: SdkLogRecord, _context?: Context): void {
    try {
      if (typeof logRecord.body === "string") {
        logRecord.body = sanitizeText(logRecord.body);
      }
      const scrubbed = redactAttributes(logRecord.attributes);
      logRecord.setAttributes(scrubbed);
    } catch {
      // Never propagate — telemetry redaction must not mask log emission.
    }
  }

  async forceFlush(): Promise<void> {
    // No buffered state of our own.
  }

  async shutdown(): Promise<void> {
    // No resources to release.
  }
}
