import { apiFetch } from './api-client';

export type DeploymentStepStatus = 'pending' | 'running' | 'complete' | 'error' | 'skipped';
export type AzureDeploymentStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

export interface AzureDeploymentStep {
  id: string;
  label: string;
  status: DeploymentStepStatus;
  detail?: string;
  timestamp?: string;
}

export interface AzureDeploymentRun {
  runId: string;
  status: AzureDeploymentStatus;
  steps: AzureDeploymentStep[];
  statusMessage?: string;
  appUrl?: string;
  portalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  lastUpdated?: string;
}

export interface AzureTargetPayload {
  subscriptionId: string;
  subscriptionName?: string;
  resourceGroup: string;
  resourceGroupName?: string;
  resourceGroupMode: 'existing' | 'new';
  location: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readErrorMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  const direct = readString(record?.error);
  const nestedError = asRecord(record?.error);
  return direct
    ?? readString(record?.message)
    ?? readString(nestedError?.message)
    ?? fallback;
}

function normalizeStepStatus(value: unknown): DeploymentStepStatus {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  switch (status) {
    case 'queued':
    case 'pending':
    case 'not_started':
      return 'pending';
    case 'running':
    case 'in_progress':
    case 'active':
      return 'running';
    case 'succeeded':
    case 'success':
    case 'completed':
    case 'complete':
      return 'complete';
    case 'failed':
    case 'error':
    case 'cancelled':
      return 'error';
    case 'skipped':
      return 'skipped';
    default:
      return 'pending';
  }
}

function normalizeStatus(value: unknown): AzureDeploymentStatus {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  switch (status) {
    case 'queued':
    case 'pending':
      return 'queued';
    case 'running':
    case 'in_progress':
    case 'active':
      return 'running';
    case 'succeeded':
    case 'success':
    case 'completed':
    case 'complete':
      return 'succeeded';
    case 'failed':
    case 'error':
    case 'cancelled':
      return 'failed';
    default:
      return 'idle';
  }
}

function normalizeSteps(value: unknown): AzureDeploymentStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const step = asRecord(item);
      const label = readString(step?.label) ?? readString(step?.name);
      if (!step || !label) return null;

      return {
        id: readString(step.id) ?? `step-${index + 1}`,
        label,
        status: normalizeStepStatus(step.status),
        detail: readString(step.detail) ?? readString(step.message),
        timestamp: readString(step.timestamp) ?? readString(step.updatedAt),
      } satisfies AzureDeploymentStep;
    })
    .filter((item): item is AzureDeploymentStep => item !== null);
}

function normalizeDeployment(body: unknown): AzureDeploymentRun {
  const root = asRecord(body) ?? {};
  const payload = asRecord(root.deployState) ?? asRecord(root.deployment) ?? root;
  const error = asRecord(payload.error);

  const runId = readString(payload.runId)
    ?? readString(payload.id)
    ?? readString(payload.deploymentId)
    ?? 'unknown-run';

  return {
    runId,
    status: normalizeStatus(payload.status ?? payload.state ?? payload.overallStatus),
    steps: normalizeSteps(payload.steps ?? asRecord(payload.progress)?.steps),
    statusMessage: readString(payload.statusMessage) ?? readString(payload.message),
    appUrl: readString(payload.appUrl)
      ?? readString(payload.url)
      ?? readString(payload.endpointUrl)
      ?? readString(payload.liveUrl),
    portalUrl: readString(payload.portalUrl) ?? readString(payload.azurePortalUrl),
    errorCode: readString(payload.errorCode) ?? readString(error?.code),
    errorMessage: readString(payload.errorMessage) ?? readString(error?.message),
    lastUpdated: readString(payload.lastUpdated) ?? readString(payload.updatedAt),
  };
}

async function readJsonOrThrow(response: Response, fallback: string): Promise<unknown> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readErrorMessage(body, fallback));
  }
  return body;
}

export async function approveCostGate(
  sessionId: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  const response = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/deploy-gates/cost`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload ?? {}),
  });

  await readJsonOrThrow(response, 'Unable to record deployment cost approval.').catch((error) => {
    if (response.status === 204) return;
    throw error;
  });
}

export async function persistAzureTarget(
  sessionId: string,
  payload: AzureTargetPayload,
): Promise<void> {
  const response = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/azure-target`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  await readJsonOrThrow(response, 'Unable to save the Azure deployment target.');
}

export async function startAzureDeployment(sessionId: string): Promise<AzureDeploymentRun> {
  const response = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/azure-deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const body = await readJsonOrThrow(response, 'Unable to start the Azure deployment.');
  return normalizeDeployment(body);
}

export async function getAzureDeployment(runId: string): Promise<AzureDeploymentRun> {
  const response = await apiFetch(`/api/azure-deployments/${encodeURIComponent(runId)}`);
  const body = await readJsonOrThrow(response, 'Unable to load deployment progress.');
  return normalizeDeployment(body);
}
