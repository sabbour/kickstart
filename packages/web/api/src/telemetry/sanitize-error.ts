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

export function sanitizeError(error: unknown): Error {
  const source = error instanceof Error ? error : new Error(String(error));
  const sanitized = new Error(sanitizeText(source.message));
  sanitized.name = source.name;

  if (source.stack) {
    sanitized.stack = sanitizeText(source.stack);
  }

  const cause = (source as Error & { cause?: unknown }).cause;
  if (cause !== undefined) {
    (sanitized as Error & { cause?: unknown }).cause =
      cause instanceof Error ? sanitizeError(cause) : sanitizeText(String(cause));
  }

  return sanitized;
}
