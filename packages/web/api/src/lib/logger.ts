/**
 * Structured JSON logging for Azure Functions with Application Insights.
 *
 * Provides:
 * - Automatic trace ID propagation
 * - Secret redaction (tokens, API keys, PII)
 * - JSON formatting for Azure Portal ingestion
 * - Session and request context injection
 */

import type { InvocationContext } from "@azure/functions";
import { randomUUID } from "crypto";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  trace_id: string;
  session_id?: string;
  request_id?: string;
  function?: string;
  source?: "startup" | "runtime" | "handler";
  message: string;
  [key: string]: any;
}

/**
 * Redacts sensitive information from objects before logging.
 * Masks tokens, API keys, passwords, and PII.
 */
export function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    // Redact common secret patterns
    const patterns = [
      // JWT tokens (usually eyJ... base64)
      { regex: /Bearer\s+([a-zA-Z0-9\-_.]+)/g, replacement: "Bearer ****" },
      // API keys (long alphanumeric sequences)
      { regex: /(["\']api[_-]?key["\']\s*:\s*["\'])([^"\']+)(["\'])/gi, replacement: '$1****$3' },
      // Azure subscription IDs (replace middle part)
      { regex: /(["\']subscription[_-]?id["\']\s*:\s*["\'])([a-f0-9\-]{36})(["\'])/gi, 
        replacement: (match, p1, p2, p3) => {
          const masked = p2.substring(0, 8) + "xxxx" + p2.substring(p2.length - 8);
          return p1 + masked + p3;
        }
      },
      // Connection strings
      { regex: /(connection[_-]?string["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])/gi, 
        replacement: '$1****$3' 
      },
      // Passwords
      { regex: /(["\']password["\']\s*:\s*["\'])([^"\']+)(["\'])/gi, replacement: '$1****$3' },
    ];

    let result = obj;
    for (const { regex, replacement } of patterns) {
      if (typeof replacement === "string") {
        result = result.replace(regex, replacement);
      }
    }
    return result;
  }

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      return obj.map(item => redactSecrets(item));
    }

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive field names entirely (exact or ends-with patterns)
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "token" ||
        lowerKey === "secret" ||
        lowerKey === "password" ||
        lowerKey === "apikey" ||
        lowerKey === "api_key" ||
        lowerKey === "credential" ||
        lowerKey === "credentials" ||
        lowerKey.endsWith("_token") ||
        lowerKey.endsWith("_secret") ||
        lowerKey.endsWith("_password") ||
        lowerKey.endsWith("_key") ||
        lowerKey.endsWith("token") ||
        lowerKey.endsWith("secret")
      ) {
        redacted[key] = "****";
        continue;
      }

      // Redact OID (object ID) if it looks like a GUID
      if (
        (key === "oid" || key === "user_id" || key === "sub" || key === "subscription_id") &&
        typeof value === "string" &&
        /^[a-f0-9\-]{36}$/.test(value)
      ) {
        redacted[key] = value.substring(0, 8) + "-xxxx-xxxx-xxxx-" + value.substring(value.length - 8);
        continue;
      }

      redacted[key] = redactSecrets(value);
    }
    return redacted;
  }

  return obj;
}

/**
 * Azure Functions logger with structured JSON output and automatic redaction.
 *
 * Usage:
 *   const logger = new Logger(ctx, functionName, traceId);
 *   logger.info("Handler started", { path: request.url });
 *   logger.error("Failed to load registry", error, { attempted_packs: 2 });
 */
export class Logger {
  constructor(
    private ctx: InvocationContext,
    private functionName: string,
    private traceId: string,
  ) {}

  private buildEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      trace_id: this.traceId,
      function: this.functionName,
      message,
      ...(metadata ? (redactSecrets(metadata) as Record<string, any>) : {}),
    };
  }

  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.buildEntry("info", message, metadata);
    this.ctx.log(JSON.stringify(entry));
  }

  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.buildEntry("warn", message, metadata);
    this.ctx.log(JSON.stringify(entry));
  }

  error(message: string, error?: Error | null, metadata?: Record<string, any>): void {
    const errorMeta = error
      ? {
          error_message: error.message,
          error_name: error.name,
          stack_trace: error.stack,
        }
      : {};

    const entry = this.buildEntry("error", message, {
      ...errorMeta,
      ...metadata,
    });
    this.ctx.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.buildEntry("debug", message, metadata);
    this.ctx.log(JSON.stringify(entry));
  }

  /**
   * Create a child logger with additional context (e.g., session ID).
   */
  withContext(sessionId: string): Logger {
    const childLogger = new Logger(this.ctx, this.functionName, this.traceId);
    const originalBuildEntry = childLogger["buildEntry"].bind(childLogger);

    childLogger["buildEntry"] = (
      level: LogLevel,
      message: string,
      metadata?: Record<string, any>,
    ): LogEntry => {
      const entry = originalBuildEntry(level, message, metadata);
      entry.session_id = sessionId;
      return entry;
    };

    return childLogger;
  }
}

/**
 * Extract or generate a trace ID from the incoming HTTP request.
 *
 * Looks for:
 * 1. x-trace-id header (custom)
 * 2. traceparent header (W3C Trace Context)
 * 3. x-ms-request-id header (Azure)
 * Falls back to generating a new UUID.
 */
export function extractTraceId(headers: Map<string, string>): string {
  // Try custom trace ID
  const customTraceId = headers.get("x-trace-id");
  if (customTraceId) {
    return customTraceId;
  }

  // Try W3C traceparent format: version-trace-id-parent-flags
  const traceparent = headers.get("traceparent");
  if (traceparent) {
    const parts = traceparent.split("-");
    if (parts.length >= 3) {
      return parts[1]; // Extract trace-id (32 hex chars)
    }
  }

  // Try Azure request ID
  const azureRequestId = headers.get("x-ms-request-id");
  if (azureRequestId) {
    return azureRequestId;
  }

  // Generate new trace ID
  return randomUUID();
}

/**
 * Extract metadata from an HTTP request for logging.
 *
 * Returns: method, path, content_length, headers_count, user_agent
 * (Does not include sensitive headers like Authorization)
 */
export function extractRequestMetadata(request: {
  method?: string;
  url?: string;
  headers: Map<string, string>;
  bodyAsText?: string;
}): Record<string, any> {
  const url = request.url ? new URL(request.url, "http://localhost") : null;
  const contentLength = request.headers.get("content-length");

  return {
    method: request.method,
    path: url?.pathname,
    query: url?.search,
    content_length: contentLength ? parseInt(contentLength, 10) : undefined,
    headers_count: request.headers.size,
    user_agent: request.headers.get("user-agent"),
  };
}
