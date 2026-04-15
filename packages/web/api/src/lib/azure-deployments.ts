import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AzureContext } from "@kickstart/core";
import {
  createResourceGroup,
  getResourceGroupDeployment,
  getResourceGroupInfo,
  getSubscriptionInfo,
  listResourceGroupDeploymentOperations,
  submitResourceGroupDeployment,
  type ArmDeploymentInfo,
  type ArmDeploymentOperation,
} from "./arm-client.js";
import { compileBicepFiles, type DeploymentFileInput } from "./bicep-compiler.js";
import { AzureApiError } from "./azure-errors.js";
import type {
  ApiSession,
  DeployCostGateState,
  DeployErrorState,
  DeployState,
} from "./session-store.js";
import { getSession } from "./session-store.js";

const RESOURCE_GROUP_RE = /^[-\w.()]{1,90}$/;
const DEPLOYMENT_NAME_RE = /^[A-Za-z0-9._()\-]{1,64}$/;
const HEALTH_CHECK_TIMEOUT_MS = 10_000;
const HEALTH_CHECK_GRACE_MS = 15 * 60 * 1000;

export interface CostGateInput {
  estimatedMonthlyTotal: number;
  currency: string;
  source: string;
}

export interface AzureTargetInput {
  subscriptionId: string;
  resourceGroup: string;
  location: string;
  createIfMissing?: boolean;
}

export interface StartDeploymentInput {
  deploymentName?: string;
  mainFile: string;
  files: DeploymentFileInput[];
  parameters?: Record<string, unknown>;
  appUrlOutput?: string;
  healthCheckPath?: string;
}

export interface DeploymentStep {
  id: string;
  label: string;
  status: "pending" | "running" | "complete" | "error";
  detail?: string;
  timestamp?: string;
}

export interface DeploymentErrorPayload {
  code: string;
  message: string;
  retryable?: boolean;
  actionableSteps?: string[];
}

export interface DeploymentStatusResponse {
  runId: string;
  pollUrl: string;
  overallStatus: "running" | "complete" | "error";
  steps: DeploymentStep[];
  appUrl?: string;
  error?: DeploymentErrorPayload;
  deployment?: {
    name: string;
    provisioningState?: string;
  };
}

interface DeploymentRunPayload {
  principalId: string;
  sessionId: string;
  subscriptionId: string;
  resourceGroup: string;
  deploymentName: string;
  appUrlOutput?: string;
  healthCheckPath: string;
  startedAt: string;
}

interface HealthCheckResult {
  status: "pending" | "complete" | "error";
  detail?: string;
}

function requireFiniteNumber(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AzureApiError(400, "invalid_request", `${fieldName} must be a positive number.`);
  }

  return value;
}

function sanitizeResourceGroupName(value: string): string {
  const trimmed = value.trim();
  if (!RESOURCE_GROUP_RE.test(trimmed) || trimmed.endsWith(".")) {
    throw new AzureApiError(
      400,
      "invalid_resource_group",
      "Resource group names must be 1-90 characters and may not end with a period.",
    );
  }

  return trimmed;
}

function sanitizeDeploymentName(value?: string, mainFile = "main.bicep"): string {
  const fallbackBase = mainFile.split("/").pop()?.replace(/\.bicep$/i, "") || "kickstart";
  const fallback = `${fallbackBase}-${randomUUID().slice(0, 8)}`.slice(0, 64);
  const candidate = (value?.trim() || fallback).slice(0, 64);

  if (!DEPLOYMENT_NAME_RE.test(candidate)) {
    throw new AzureApiError(
      400,
      "invalid_deployment_name",
      "Deployment names may only contain letters, numbers, periods, underscores, parentheses, and hyphens.",
    );
  }

  return candidate;
}

function sanitizeHealthCheckPath(value?: string): string {
  const candidate = value?.trim() || "/";
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    throw new AzureApiError(
      400,
      "invalid_health_check_path",
      "healthCheckPath must start with '/' and cannot be protocol-relative.",
    );
  }
  return candidate;
}

function getRunTokenSecret(): string {
  const secret = process.env.DEPLOY_RUN_SECRET?.trim()
    || process.env.GITHUB_SESSION_SECRET?.trim()
    || process.env.AZURE_CLIENT_SECRET?.trim();

  if (!secret) {
    throw new AzureApiError(
      503,
      "deploy_run_secret_missing",
      "Deployment progress tracking is not configured on the server.",
      undefined,
      false,
      [
        "Set DEPLOY_RUN_SECRET (recommended) or ensure AZURE_CLIENT_SECRET is available to the API.",
      ],
    );
  }

  return secret;
}

function signRunToken(encodedPayload: string): string {
  return createHmac("sha256", getRunTokenSecret())
    .update(encodedPayload)
    .digest("base64url");
}

function equalSignature(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createRunId(payload: DeploymentRunPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signRunToken(encodedPayload)}`;
}

export function decodeRunId(runId: string): DeploymentRunPayload {
  const [encodedPayload, signature] = runId.split(".", 2);
  if (!encodedPayload || !signature) {
    throw new AzureApiError(400, "invalid_run_id", "Deployment run ID is malformed.");
  }

  const expectedSignature = signRunToken(encodedPayload);
  if (!equalSignature(signature, expectedSignature)) {
    throw new AzureApiError(400, "invalid_run_id", "Deployment run ID could not be verified.");
  }

  try {
    return JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as DeploymentRunPayload;
  } catch {
    throw new AzureApiError(400, "invalid_run_id", "Deployment run ID payload is invalid.");
  }
}

function pollUrlFor(runId: string): string {
  return `/api/azure-deployments/${runId}`;
}

function normalizeArmParameters(parameters?: Record<string, unknown>): Record<string, { value: unknown }> {
  const normalized: Record<string, { value: unknown }> = {};
  for (const [key, value] of Object.entries(parameters ?? {})) {
    const maybeWrapped = value as { value?: unknown };
    normalized[key] = (
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.keys(value).length === 1
      && "value" in maybeWrapped
    )
      ? { value: maybeWrapped.value }
      : { value };
  }
  return normalized;
}

function extractOutputValue(
  outputs: Record<string, { value?: unknown }> | undefined,
  key: string,
): unknown {
  return outputs?.[key]?.value;
}

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9][a-z0-9.-]+$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return undefined;
}

function extractAppUrl(
  outputs: Record<string, { value?: unknown }> | undefined,
  preferredOutput?: string,
): string | undefined {
  const candidates = [
    preferredOutput,
    "appUrl",
    "applicationUrl",
    "url",
    "defaultHostname",
    "hostname",
    "fqdn",
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    const normalized = normalizeUrl(extractOutputValue(outputs, candidate));
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function summarizeOperations(operations: ArmDeploymentOperation[]): string | undefined {
  if (!operations.length) return undefined;

  const complete = operations.filter((operation) => operation.properties?.provisioningState === "Succeeded").length;
  const failed = operations.filter((operation) => operation.properties?.provisioningState === "Failed").length;
  const active = operations.find((operation) => {
    const state = operation.properties?.provisioningState;
    return state && state !== "Succeeded" && state !== "Failed";
  });

  const parts = [`${complete}/${operations.length} ARM operations complete`];
  if (failed > 0) {
    parts.push(`${failed} failed`);
  }
  if (active?.properties?.targetResource?.resourceType || active?.properties?.targetResource?.resourceName) {
    const type = active.properties?.targetResource?.resourceType ?? "resource";
    const name = active.properties?.targetResource?.resourceName ?? "unknown";
    parts.push(`current: ${type}/${name}`);
  }

  return parts.join(" · ");
}

function deploymentErrorPayload(
  code: string,
  message: string,
  actionableSteps?: string[],
  retryable?: boolean,
): DeploymentErrorPayload {
  return {
    code,
    message,
    ...(retryable ? { retryable: true } : {}),
    ...(actionableSteps?.length ? { actionableSteps } : {}),
  };
}

function extractDeploymentError(deployment: ArmDeploymentInfo): DeploymentErrorPayload | undefined {
  const error = deployment.properties?.error;
  if (!error?.message) return undefined;
  return deploymentErrorPayload(
    error.code ?? "deployment_failed",
    error.message,
    ["Review the Azure deployment error payload and fix the invalid resource settings before retrying."],
  );
}

async function runHealthCheck(appUrl: string, healthCheckPath: string, startedAt: string): Promise<HealthCheckResult> {
  try {
    const response = await fetch(new URL(healthCheckPath, appUrl), {
      method: "GET",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      redirect: "follow",
    });

    if (response.status >= 200 && response.status < 400) {
      return {
        status: "complete",
        detail: `Health check passed with HTTP ${response.status}.`,
      };
    }

    if (Date.now() - Date.parse(startedAt) >= HEALTH_CHECK_GRACE_MS) {
      return {
        status: "error",
        detail: `Health check returned HTTP ${response.status}.`,
      };
    }

    return {
      status: "pending",
      detail: `Waiting for the app to become ready (HTTP ${response.status}).`,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (Date.now() - Date.parse(startedAt) >= HEALTH_CHECK_GRACE_MS) {
      return {
        status: "error",
        detail: `Health check failed: ${detail}`,
      };
    }

    return {
      status: "pending",
      detail: `Waiting for the app to respond: ${detail}`,
    };
  }
}

function updateSessionDeployState(
  session: ApiSession | undefined,
  nextState: Partial<DeployState>,
): void {
  if (!session) return;
  session.deployState = {
    ...session.deployState,
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
}

export function recordCostGate(session: ApiSession, input: CostGateInput): DeployState {
  const costGate: DeployCostGateState = {
    acknowledgedAt: new Date().toISOString(),
    estimatedMonthlyTotal: requireFiniteNumber(input.estimatedMonthlyTotal, "estimatedMonthlyTotal"),
    currency: input.currency.trim().toUpperCase(),
    source: input.source.trim() || "unknown",
  };

  updateSessionDeployState(session, {
    stage: "cost-gated",
    costGate,
    activeRunId: undefined,
    deploymentName: undefined,
    appUrl: undefined,
    lastError: undefined,
  });

  return session.deployState;
}

export async function persistAzureTarget(
  accessToken: string,
  session: ApiSession,
  input: AzureTargetInput,
): Promise<{ azureContext: AzureContext; deployState: DeployState }> {
  if (!session.deployState.costGate) {
    throw new AzureApiError(
      409,
      "cost_gate_required",
      "Acknowledge the cost gate before selecting an Azure target.",
    );
  }

  const subscriptionId = input.subscriptionId.trim();
  const resourceGroup = sanitizeResourceGroupName(input.resourceGroup);
  const location = input.location.trim();

  if (!subscriptionId || !location) {
    throw new AzureApiError(
      400,
      "invalid_target_selection",
      "subscriptionId and location are required.",
    );
  }

  const subscription = await getSubscriptionInfo(accessToken, subscriptionId);
  if (subscription.state !== "Enabled") {
    throw new AzureApiError(
      400,
      "subscription_not_enabled",
      `Subscription "${subscription.displayName}" is not enabled for deployments.`,
    );
  }

  let resourceGroupInfo;
  try {
    resourceGroupInfo = await getResourceGroupInfo(accessToken, subscriptionId, resourceGroup);
  } catch (error) {
    if (
      error instanceof AzureApiError
      && error.status === 404
      && input.createIfMissing
    ) {
      resourceGroupInfo = await createResourceGroup(accessToken, subscriptionId, resourceGroup, location);
    } else {
      throw error;
    }
  }

  const azureContext: AzureContext = {
    subscriptionId: subscription.subscriptionId,
    subscriptionDisplayName: subscription.displayName,
    resourceGroup: resourceGroupInfo.name,
    resourceGroupId: resourceGroupInfo.id,
    region: resourceGroupInfo.location || location,
    tenantId: subscription.tenantId,
  };

  session.state.azureContext = azureContext;
  updateSessionDeployState(session, {
    stage: "target-selected",
    activeRunId: undefined,
    deploymentName: undefined,
    appUrl: undefined,
    lastError: undefined,
  });

  return {
    azureContext,
    deployState: session.deployState,
  };
}

export async function startAzureDeployment(
  accessToken: string,
  principalId: string,
  session: ApiSession,
  input: StartDeploymentInput,
): Promise<DeploymentStatusResponse> {
  if (!session.deployState.costGate) {
    throw new AzureApiError(
      409,
      "cost_gate_required",
      "Acknowledge the cost gate before starting a deployment.",
    );
  }

  const azureContext = session.state.azureContext;
  if (!azureContext?.subscriptionId || !azureContext.resourceGroup) {
    throw new AzureApiError(
      409,
      "azure_target_required",
      "Select an Azure subscription and resource group before starting a deployment.",
    );
  }

  const deploymentName = sanitizeDeploymentName(input.deploymentName, input.mainFile);
  const healthCheckPath = sanitizeHealthCheckPath(input.healthCheckPath);
  const compiled = await compileBicepFiles(input.mainFile, input.files);

  await submitResourceGroupDeployment(
    accessToken,
    azureContext.subscriptionId,
    azureContext.resourceGroup,
    deploymentName,
    compiled.template,
    normalizeArmParameters(input.parameters),
  );

  const runPayload: DeploymentRunPayload = {
    principalId,
    sessionId: session.state.sessionId,
    subscriptionId: azureContext.subscriptionId,
    resourceGroup: azureContext.resourceGroup,
    deploymentName,
    appUrlOutput: input.appUrlOutput?.trim() || undefined,
    healthCheckPath,
    startedAt: new Date().toISOString(),
  };

  const runId = createRunId(runPayload);
  updateSessionDeployState(session, {
    stage: "deploying",
    activeRunId: runId,
    deploymentName,
    appUrl: undefined,
    lastError: undefined,
  });

  return getAzureDeploymentStatus(accessToken, principalId, runId);
}

export async function getAzureDeploymentStatus(
  accessToken: string,
  principalId: string,
  runId: string,
): Promise<DeploymentStatusResponse> {
  const run = decodeRunId(runId);
  if (run.principalId !== principalId) {
    throw new AzureApiError(403, "forbidden_run", "This deployment run belongs to a different user.");
  }

  const deployment = await getResourceGroupDeployment(
    accessToken,
    run.subscriptionId,
    run.resourceGroup,
    run.deploymentName,
  );

  const operations = await listResourceGroupDeploymentOperations(
    accessToken,
    run.subscriptionId,
    run.resourceGroup,
    run.deploymentName,
  ).catch(() => []);

  const provisioningState = deployment.properties?.provisioningState;
  const deploymentError = extractDeploymentError(deployment);
  const appUrl = extractAppUrl(deployment.properties?.outputs, run.appUrlOutput);
  const health = appUrl
    ? await runHealthCheck(appUrl, run.healthCheckPath, run.startedAt)
    : { status: "pending" as const };

  const provisionDetail = summarizeOperations(operations)
    || (provisioningState ? `Azure reports ${provisioningState}.` : undefined);

  const steps: DeploymentStep[] = [
    {
      id: "compile-bicep",
      label: "Compile Bicep",
      status: "complete",
      detail: "Bicep files compiled to an ARM template.",
      timestamp: run.startedAt,
    },
    {
      id: "submit-deployment",
      label: "Submit Azure deployment",
      status: "complete",
      detail: `Deployment "${run.deploymentName}" submitted to Azure Resource Manager.`,
      timestamp: deployment.properties?.timestamp || run.startedAt,
    },
    {
      id: "provision-resources",
      label: "Provision Azure resources",
      status: deploymentError
        ? "error"
        : provisioningState === "Succeeded"
          ? "complete"
          : "running",
      detail: deploymentError?.message || provisionDetail,
    },
    {
      id: "resolve-app-url",
      label: "Resolve application URL",
      status: appUrl
        ? "complete"
        : provisioningState === "Succeeded"
          ? "error"
          : "pending",
      detail: appUrl
        ? `Resolved ${appUrl}`
        : provisioningState === "Succeeded"
          ? "Deployment succeeded, but no app URL output was found."
          : "Waiting for deployment outputs.",
    },
    {
      id: "health-check",
      label: "Verify application health",
      status: !appUrl
        ? "pending"
        : health.status === "complete"
          ? "complete"
          : health.status === "error"
            ? "error"
            : "running",
      detail: !appUrl ? "Waiting for an application URL." : health.detail,
    },
  ];

  const derivedError = deploymentError
    || (
      provisioningState === "Succeeded" && !appUrl
        ? deploymentErrorPayload(
          "app_url_missing",
          "Deployment completed, but no real app URL output was produced.",
          [
            "Add an output such as appUrl, applicationUrl, url, or defaultHostname to the main Bicep file.",
          ],
        )
        : undefined
    )
    || (
      appUrl && health.status === "error"
        ? deploymentErrorPayload(
          "health_check_failed",
          health.detail || "The deployed application did not become reachable in time.",
          [
            "Check the application logs and ingress configuration in Azure.",
            "Confirm the healthCheckPath matches a real route exposed by the app.",
          ],
          true,
        )
        : undefined
    );

  const overallStatus: DeploymentStatusResponse["overallStatus"] = derivedError
    ? "error"
    : appUrl && health.status === "complete"
      ? "complete"
      : "running";

  const session = getSession(run.sessionId);
  updateSessionDeployState(session, {
    stage: overallStatus === "complete" ? "succeeded" : overallStatus === "error" ? "failed" : "deploying",
    activeRunId: runId,
    deploymentName: run.deploymentName,
    appUrl,
    lastError: derivedError as DeployErrorState | undefined,
  });

  return {
    runId,
    pollUrl: pollUrlFor(runId),
    overallStatus,
    steps,
    ...(appUrl ? { appUrl } : {}),
    ...(derivedError ? { error: derivedError } : {}),
    deployment: {
      name: run.deploymentName,
      provisioningState,
    },
  };
}
