import { AzureApiError } from "./azure-errors.js";

const ARM_BASE_URL = "https://management.azure.com";
const SUBSCRIPTIONS_API_VERSION = "2022-12-01";
const RESOURCE_GROUPS_API_VERSION = "2024-03-01";
const DEPLOYMENTS_API_VERSION = "2024-03-01";

interface ArmErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

interface ValueEnvelope<T> {
  value?: T[];
}

export interface AzureSubscriptionInfo {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId: string;
}

export interface AzureResourceGroupInfo {
  id: string;
  name: string;
  location: string;
  properties?: {
    provisioningState?: string;
  };
}

export interface ArmDeploymentInfo {
  id?: string;
  name?: string;
  properties?: {
    provisioningState?: string;
    outputs?: Record<string, { type?: string; value?: unknown }>;
    error?: {
      code?: string;
      message?: string;
      details?: unknown;
    };
    timestamp?: string;
  };
}

export interface ArmDeploymentOperation {
  id?: string;
  properties?: {
    provisioningState?: string;
    provisioningOperation?: string;
    timestamp?: string;
    targetResource?: {
      resourceType?: string;
      resourceName?: string;
    };
    statusMessage?: unknown;
  };
}

function buildUrl(path: string): string {
  return `${ARM_BASE_URL}${path}`;
}

function sanitizeCode(rawCode: string | undefined, fallback: string): string {
  if (!rawCode) return fallback;
  return rawCode
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || fallback;
}

async function readArmError(response: Response): Promise<AzureApiError> {
  let message = `Azure request failed (${response.status}).`;
  let code = sanitizeCode(response.statusText, "azure_request_failed");

  try {
    const body = (await response.json()) as ArmErrorEnvelope & Record<string, unknown>;
    const error = body.error;
    if (typeof error?.message === "string" && error.message.trim()) {
      message = error.message.trim();
    }
    if (typeof error?.code === "string") {
      code = sanitizeCode(error.code, code);
    }
  } catch {
    // Ignore JSON parse failures — the status code is enough.
  }

  return new AzureApiError(
    response.status,
    code,
    message,
    undefined,
    response.status === 429 || response.status >= 500,
  );
}

async function armRequest<T>(
  accessToken: string,
  method: "GET" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    throw await readArmError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function getSubscriptionInfo(
  accessToken: string,
  subscriptionId: string,
): Promise<AzureSubscriptionInfo> {
  return armRequest<AzureSubscriptionInfo>(
    accessToken,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}?api-version=${SUBSCRIPTIONS_API_VERSION}`,
  );
}

export async function getResourceGroupInfo(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
): Promise<AzureResourceGroupInfo> {
  return armRequest<AzureResourceGroupInfo>(
    accessToken,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups/${encodeURIComponent(resourceGroup)}?api-version=${RESOURCE_GROUPS_API_VERSION}`,
  );
}

export async function createResourceGroup(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  location: string,
): Promise<AzureResourceGroupInfo> {
  return armRequest<AzureResourceGroupInfo>(
    accessToken,
    "PUT",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups/${encodeURIComponent(resourceGroup)}?api-version=${RESOURCE_GROUPS_API_VERSION}`,
    { location },
  );
}

export async function submitResourceGroupDeployment(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  deploymentName: string,
  template: Record<string, unknown>,
  parameters: Record<string, unknown>,
): Promise<ArmDeploymentInfo> {
  return armRequest<ArmDeploymentInfo>(
    accessToken,
    "PUT",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Resources/deployments/${encodeURIComponent(deploymentName)}?api-version=${DEPLOYMENTS_API_VERSION}`,
    {
      properties: {
        mode: "Incremental",
        template,
        parameters,
      },
    },
  );
}

export async function getResourceGroupDeployment(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  deploymentName: string,
): Promise<ArmDeploymentInfo> {
  return armRequest<ArmDeploymentInfo>(
    accessToken,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Resources/deployments/${encodeURIComponent(deploymentName)}?api-version=${DEPLOYMENTS_API_VERSION}`,
  );
}

export async function listResourceGroupDeploymentOperations(
  accessToken: string,
  subscriptionId: string,
  resourceGroup: string,
  deploymentName: string,
): Promise<ArmDeploymentOperation[]> {
  const response = await armRequest<ValueEnvelope<ArmDeploymentOperation>>(
    accessToken,
    "GET",
    `/subscriptions/${encodeURIComponent(subscriptionId)}/resourcegroups/${encodeURIComponent(resourceGroup)}/providers/Microsoft.Resources/deployments/${encodeURIComponent(deploymentName)}/operations?api-version=${DEPLOYMENTS_API_VERSION}`,
  );

  return response.value ?? [];
}
