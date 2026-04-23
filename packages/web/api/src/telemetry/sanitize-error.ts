import { sanitizeText } from "@aks-kickstart/harness/runtime/redact";

export { sanitizeText };

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
