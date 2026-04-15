import type { InvocationContext } from "@azure/functions";

const GENERIC_AZURE_ERROR = "An error occurred processing the Azure deployment request.";

export class AzureApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly retryable: boolean;
  readonly actionableSteps?: string[];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
    retryable = false,
    actionableSteps?: string[],
  ) {
    super(message);
    this.name = "AzureApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryable = retryable;
    this.actionableSteps = actionableSteps;
  }
}

export function azureErrorResponse(
  err: unknown,
  context: InvocationContext,
  label: string,
): {
  status: number;
  jsonBody: {
    error: string;
    code: string;
    details?: unknown;
    retryable?: boolean;
    actionableSteps?: string[];
  };
} {
  if (err instanceof AzureApiError) {
    context.error(`${label}: ${err.code} ${err.message}`);
    if (err.details !== undefined) {
      context.error(`${label} details: ${JSON.stringify(err.details)}`);
    }

    return {
      status: err.status,
      jsonBody: {
        error: err.message,
        code: err.code,
        ...(err.details !== undefined ? { details: err.details } : {}),
        ...(err.retryable ? { retryable: true } : {}),
        ...(err.actionableSteps?.length ? { actionableSteps: err.actionableSteps } : {}),
      },
    };
  }

  const detail = err instanceof Error ? err.message : String(err);
  context.error(`${label}: ${detail}`);
  if (err instanceof Error && err.stack) {
    context.error(`${label} stack: ${err.stack}`);
  }

  return {
    status: 500,
    jsonBody: {
      error: GENERIC_AZURE_ERROR,
      code: "internal_error",
    },
  };
}
