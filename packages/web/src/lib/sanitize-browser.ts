/**
 * Browser-side mirror of the harness `sanitizeText` (`packages/harness/src/runtime/redact.ts`).
 *
 * We can't import that module directly: the harness alias in vite.config.ts
 * resolves the barrel, which transitively pulls in Node.js-only code paths
 * (fs, path, the runner). Duplicating the rule table here keeps the browser
 * bundle cold-start lean and keeps the redactor import-free from any
 * server-only runtime. The rule set MUST stay byte-equivalent to the server
 * version — update both in lock-step (see DP-D revision 2, Zapp Decision 3).
 */

const REDACTION_RULES: Array<{
  pattern: RegExp;
  replace: string | ((substring: string, ...args: string[]) => string);
}> = [
  {
    pattern: /([?&](?:api[-_]?key|token|secret|code|sig|password|authorization)=)([^&\s]+)/gi,
    replace: "$1[REDACTED]",
  },
  {
    pattern: /\b(authorization\s*:\s*bearer|bearer)\s+[^\s"'`]+/gi,
    replace: (_: string, prefix: string) => `${prefix} [REDACTED]`,
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replace: "[REDACTED_JWT]",
  },
  {
    pattern: /\b(api[-_ ]?key|apikey|secret|password|token)\s*([=:])\s*([^\s,;"'`]+)/gi,
    replace: (_: string, key: string, separator: string) => `${key}${separator}[REDACTED]`,
  },
  {
    pattern: /\b(DefaultEndpointsProtocol|AccountName|AccountKey|SharedAccessSignature|EndpointSuffix)\s*=\s*([^;\s]+)/gi,
    replace: (_: string, key: string) => `${key}=[REDACTED]`,
  },
  {
    pattern: /\b(AzureWebJobsStorage|APPLICATIONINSIGHTS_CONNECTION_STRING|AZURE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|CONNECTION_STRING))\s*([=:])\s*([^\s,;"'`]+)/g,
    replace: (_: string, key: string, separator: string) => `${key}${separator}[REDACTED]`,
  },
];

export function sanitizeText(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  let sanitized = String(text);
  for (const rule of REDACTION_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replace as never);
  }
  return sanitized;
}

/**
 * User-agent strings carry fingerprintable device info. Zapp's scrub table
 * allows a coarse browser-family tag only; anything richer is dropped.
 */
export function coarseBrowserFamily(ua: string | null | undefined): string {
  if (!ua) return "unknown";
  const s = String(ua);
  if (/\bEdg\//i.test(s)) return "Edge";
  if (/\bOPR\/|\bOpera\b/i.test(s)) return "Opera";
  if (/\bChrome\//i.test(s)) return "Chrome";
  if (/\bFirefox\//i.test(s)) return "Firefox";
  if (/\bSafari\//i.test(s)) return "Safari";
  return "other";
}

/**
 * Strip query + fragment from a URL-ish string; return the path only (or the
 * input untouched if it doesn't parse as a URL). Mirrors server-side
 * stripQueryIfUrlKey, but collapses "?<redacted>" → path-only per the
 * browser scrub table (Zapp Decision 3).
 */
export function stripUrlQuery(value: string): string {
  if (!value) return value;
  const hashIdx = value.indexOf("#");
  const noHash = hashIdx >= 0 ? value.slice(0, hashIdx) : value;
  const qIdx = noHash.indexOf("?");
  return qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
}
