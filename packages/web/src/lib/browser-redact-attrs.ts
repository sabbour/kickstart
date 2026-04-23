import type { Attributes } from "@opentelemetry/api";
import { sanitizeText, coarseBrowserFamily, stripUrlQuery } from "./sanitize-browser";

/**
 * Per DP-D revision 2 / Zapp Decision 3 — browser-side scrub table.
 *
 *   http.url / url.full  → path only (query + fragment stripped)
 *   http.user_agent      → coarse browser family
 *   any value containing /token|key|secret|password|auth|bearer/i → `[REDACTED]`
 *     via `sanitizeText`, which matches server-side rules byte-for-byte.
 *   tracestate           → stripped entirely before export (handled in the
 *                          exporter wrapper, not here — `tracestate` lives on
 *                          the span context, not in attributes).
 */

const URL_KEYS = new Set(["http.url", "url.full", "http.target", "http.route", "url.path"]);

export function redactBrowserAttributes(input: Attributes): Attributes {
  const out: Attributes = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null) {
      out[k] = v;
      continue;
    }
    if (k === "http.user_agent" || k === "user_agent.original") {
      out[k] = typeof v === "string" ? coarseBrowserFamily(v) : v;
      continue;
    }
    if (typeof v === "string") {
      out[k] = URL_KEYS.has(k) ? stripUrlQuery(v) : sanitizeText(v);
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = (v as string[]).map((s) => (URL_KEYS.has(k) ? stripUrlQuery(s) : sanitizeText(s)));
    } else {
      out[k] = v;
    }
  }
  return out;
}
