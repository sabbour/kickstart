/**
 * Shared redaction utility for telemetry / log output.
 *
 * Lives in the harness (not the API) so packs and the runner can use it
 * without creating an api → harness dependency inversion. The API's
 * `telemetry/sanitize-error.ts` re-exports `sanitizeText` from here to
 * preserve its existing call sites.
 *
 * Rules scrub common patterns that leak credentials or auth material:
 *  - `?api-key=…`, `?token=…`, `?sig=…` query parameters
 *  - `Authorization: Bearer …` / bare `bearer …` headers
 *  - JWT tokens (`eyJ…` three-part)
 *  - `api_key=…`, `password=…`, etc. key/value pairs
 *  - Azure Storage connection strings (`AccountKey=…`, `SharedAccessSignature=…`)
 *  - Env-variable-looking secrets (`APPLICATIONINSIGHTS_CONNECTION_STRING=…`,
 *    `AZURE_*_KEY=…`, `AZURE_*_SECRET=…`, etc.)
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
    replace: (_, prefix: string) => `${prefix} [REDACTED]`,
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replace: "[REDACTED_JWT]",
  },
  {
    pattern: /\b(api[-_ ]?key|apikey|secret|password|token)\s*([=:])\s*([^\s,;"'`]+)/gi,
    replace: (_, key: string, separator: string) => `${key}${separator}[REDACTED]`,
  },
  {
    pattern: /\b(DefaultEndpointsProtocol|AccountName|AccountKey|SharedAccessSignature|EndpointSuffix)\s*=\s*([^;\s]+)/gi,
    replace: (_, key: string) => `${key}=[REDACTED]`,
  },
  {
    pattern: /\b(AzureWebJobsStorage|APPLICATIONINSIGHTS_CONNECTION_STRING|AZURE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|CONNECTION_STRING))\s*([=:])\s*([^\s,;"'`]+)/g,
    replace: (_, key: string, separator: string) => `${key}${separator}[REDACTED]`,
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
