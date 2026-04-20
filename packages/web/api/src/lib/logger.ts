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
import { sanitizeError, sanitizeText } from "../telemetry/sanitize-error.js";

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
 * Masks tokens, API keys, passwords, PII, and URL-embedded secrets.
 */
export function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    let result = sanitizeText(obj);

    result = result.replace(/Bearer\s+([a-zA-Z0-9\-_.]+)/g, "Bearer ****");
    result = result.replace(/[?&](api[_-]?key|code|token|secret|password|auth|credential)=([^&\s"']+)/gi,
      (_match, param) => `?${param}=****`);
    result = result.replace(/\?api-key=([^&\s"']+)/gi, "?api-key=****");
    result = result.replace(/\?subscription[_-]?id=([^&\s"']+)/gi, "?subscription_id=****");
    result = result.replace(/[?&]authorization=([^&\s"']+)/gi, "&authorization=****");
    result = result.replace(/(["\']api[_-]?key["\']\s*:\s*["\'])([^"\']+)(["\'])/gi, '$1****$3');
    result = result.replace(/(connection[_-]?string["\']?\s*[:=]\s*["\'])([^"\']+)(["\'])/gi, '$1****$3');
    result = result.replace(/(["\']password["\']\s*:\s*["\'])([^"\']+)(["\'])/gi, '$1****$3');
    result = result.replace(/(["\']authorization["\']\s*:\s*["\'])([^"\']+)(["\'])/gi, '$1****$3');

    return result;
  }

  if (typeof obj === "object") {
    if (Array.isArray(obj)) {
      return obj.map((item) => redactSecrets(item));
    }

    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey === "token" ||
        lowerKey === "secret" ||
        lowerKey === "password" ||
        lowerKey === "apikey" ||
        lowerKey === "api_key" ||
        lowerKey === "authorization" ||
        lowerKey === "credential" ||
        lowerKey === "credentials" ||
        lowerKey === "auth" ||
        lowerKey.endsWith("_token") ||
        lowerKey.endsWith("_secret") ||
        lowerKey.endsWith("_password") ||
        lowerKey.endsWith("_key") ||
        lowerKey.endsWith("-key") ||
        lowerKey.endsWith("token") ||
        lowerKey.endsWith("secret")
      ) {
        redacted[key] = "****";
        continue;
      }

      if (
        (key === "oid" ||
          key === "user_id" ||
          key === "sub" ||
          key === "subscription_id" ||
          key === "tenant_id" ||
          key === "client_id") &&
        typeof value === "string" &&
        /^[a-f0-9\-]{36}$/i.test(value)
      ) {
        redacted[key] = `${value.substring(0, 8)}-xxxx-xxxx-xxxx-${value.substring(value.length - 8)}`;
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
 */
export class Logger {
  constructor(
    private ctx: InvocationContext,
    private functionName: string,
    private traceId: string,
    private baseMetadata: Record<string, unknown> = {},
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
      ...(redactSecrets(this.baseMetadata) as Record<string, any>),
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
    const sanitized = error ? sanitizeError(error) : null;
    const errorMeta = sanitized
      ? {
          error_message: sanitized.message,
          error_name: sanitized.name,
          stack_trace: sanitized.stack,
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
   * Create a child logger with additional context (e.g., request ID).
   */
  withContext(metadata: Record<string, unknown>): Logger {
    return new Logger(this.ctx, this.functionName, this.traceId, {
      ...this.baseMetadata,
      ...metadata,
    });
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
  const customTraceId = headers.get("x-trace-id");
  if (customTraceId) {
    return customTraceId;
  }

  const traceparent = headers.get("traceparent");
  if (traceparent) {
    const parts = traceparent.split("-");
    if (parts.length >= 3) {
      return parts[1];
    }
  }

  const azureRequestId = headers.get("x-ms-request-id");
  if (azureRequestId) {
    return azureRequestId;
  }

  return randomUUID();
}

/**
 * Extract metadata from an HTTP request for logging.
 *
 * Returns: method, path, content_length, headers_count, user_agent
 * Query string is redacted to prevent leaking secrets.
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
  const query = url?.search ? (redactSecrets(url.search) as string) : undefined;

  return {
    method: request.method,
    path: url?.pathname,
    query,
    content_length: contentLength ? parseInt(contentLength, 10) : undefined,
    headers_count: request.headers.size,
    user_agent: request.headers.get("user-agent"),
  };
}
