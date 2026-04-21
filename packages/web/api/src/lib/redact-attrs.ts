import type { Attributes } from "@opentelemetry/api";
import { sanitizeText } from "../telemetry/sanitize-error.js";

/**
 * Attribute keys that always carry sensitive material and must be scrubbed.
 * sanitizeText redacts conn-strings, bearer tokens, JWTs, and AAD/AOAI keys.
 * Non-scrub strings still pass through sanitizeText as defense-in-depth —
 * attribute-value payloads can carry inline secrets regardless of key.
 */
export const SCRUB_KEYS = new Set<string>([
  "http.url",
  "url.full",
  "url.query",
  "url.path",
  "http.target",
  "http.route",
  "db.statement",
  "messaging.message.body",
  "http.request.header.authorization",
  "http.request.header.cookie",
  "http.response.header.set-cookie",
  "exception.message",
  "exception.stacktrace",
]);

/**
 * Produce a new Attributes object with every string value sanitized.
 * Non-string values (numbers, booleans, arrays) pass through unmodified.
 * Arrays of strings are sanitized element-wise. Never mutates input.
 */
export function redactAttributes(input: Attributes): Attributes {
  const out: Attributes = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) {
      out[k] = v;
      continue;
    }
    if (typeof v === "string") {
      out[k] = sanitizeText(stripQueryIfUrlKey(k, v));
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = (v as string[]).map((s) => sanitizeText(stripQueryIfUrlKey(k, s)));
    } else {
      out[k] = v;
    }
  }
  return out;
}

const URL_KEYS = new Set(["http.url", "url.full", "http.target", "http.route", "url.path"]);

function stripQueryIfUrlKey(key: string, value: string): string {
  if (!URL_KEYS.has(key)) return value;
  const qIdx = value.indexOf("?");
  return qIdx >= 0 ? `${value.slice(0, qIdx)}?<redacted>` : value;
}
