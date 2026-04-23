/**
 * Azure deployments service.
 *
 * Provides helpers for creating and monitoring ARM template deployments.
 * All writes go through user actions — this service is used for READ and STATUS
 * operations only (the deploy write itself lives in user-actions/deploy.ts).
 */

import type { SessionCtx } from '@aks-kickstart/harness';
import { getAzureToken, armAuthHeaders, armBaseUrl, pollArmLro } from './azure-auth.js';

const ARM_DEPLOYMENTS_API = '2021-04-01';

export interface DeploymentStatus {
  name: string;
  provisioningState: string;
  correlationId?: string;
  timestamp?: string;
  outputs?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export interface DeploymentListItem {
  id: string;
  name: string;
  provisioningState: string;
  timestamp: string;
}

/**
 * Gets the current status of an ARM deployment.
 */
export async function getDeploymentStatus(
  session: SessionCtx | undefined,
  subscriptionId: string,
  resourceGroupName: string,
  deploymentName: string,
): Promise<DeploymentStatus> {
  const token = getAzureToken(session);
  const url =
    `${armBaseUrl()}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}` +
    `/providers/Microsoft.Resources/deployments/${deploymentName}` +
    `?api-version=${ARM_DEPLOYMENTS_API}`;

  const resp = await fetch(url, {
    headers: armAuthHeaders(token),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Get deployment status HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    name?: string;
    properties?: {
      provisioningState?: string;
      correlationId?: string;
      timestamp?: string;
      outputs?: Record<string, unknown>;
      error?: { code: string; message: string; details?: unknown[] };
    };
  };

  return {
    name: data.name ?? deploymentName,
    provisioningState: data.properties?.provisioningState ?? 'Unknown',
    correlationId: data.properties?.correlationId,
    timestamp: data.properties?.timestamp,
    outputs: data.properties?.outputs,
    error: data.properties?.error,
  };
}

/**
 * Lists recent deployments in a resource group.
 */
export async function listDeployments(
  session: SessionCtx | undefined,
  subscriptionId: string,
  resourceGroupName: string,
  top = 10,
): Promise<DeploymentListItem[]> {
  const token = getAzureToken(session);
  const url =
    `${armBaseUrl()}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}` +
    `/providers/Microsoft.Resources/deployments` +
    `?api-version=${ARM_DEPLOYMENTS_API}&$top=${top}`;

  const resp = await fetch(url, {
    headers: armAuthHeaders(token),
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`List deployments HTTP ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = (await resp.json()) as {
    value?: Array<{
      id?: string;
      name?: string;
      properties?: { provisioningState?: string; timestamp?: string };
    }>;
  };

  return (data.value ?? []).map((d) => ({
    id: d.id ?? '',
    name: d.name ?? '',
    provisioningState: d.properties?.provisioningState ?? 'Unknown',
    timestamp: d.properties?.timestamp ?? '',
  }));
}

/**
 * Waits for a deployment to complete by polling its status.
 * Used by the deploy user action after initiating the ARM deployment.
 */
export async function waitForDeployment(
  session: SessionCtx | undefined,
  subscriptionId: string,
  resourceGroupName: string,
  deploymentName: string,
): Promise<DeploymentStatus> {
  const token = getAzureToken(session);
  const lroUrl =
    `${armBaseUrl()}/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}` +
    `/providers/Microsoft.Resources/deployments/${deploymentName}` +
    `?api-version=${ARM_DEPLOYMENTS_API}`;

  await pollArmLro(lroUrl, token, { maxAttempts: 60, intervalMs: 5_000 });

  return getDeploymentStatus(session, subscriptionId, resourceGroupName, deploymentName);
}
