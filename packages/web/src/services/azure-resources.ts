import type {
  AzureLocation,
  AzureResource,
  AzureResourceGroup,
  AzureSubscription,
} from '@kickstart/core';
import { apiFetch } from './api-client';
import { sanitizeAzureUiErrorMessage } from '../utils/azure-ui-safety';

export const AZURE_DISCOVERY_FALLBACK_MESSAGE = 'Azure target discovery is not available yet. Enter the deployment target manually.';

export class AzureDiscoveryUnavailableError extends Error {
  constructor() {
    super(AZURE_DISCOVERY_FALLBACK_MESSAGE);
    this.name = 'AzureDiscoveryUnavailableError';
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readList(body: unknown, keys: string[]): unknown[] {
  if (Array.isArray(body)) {
    return body;
  }

  const root = asRecord(body);
  if (!root) {
    return [];
  }

  for (const key of keys) {
    const candidate = root[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }

    const nested = asRecord(candidate);
    if (nested) {
      if (Array.isArray(nested.items)) {
        return nested.items;
      }
      if (Array.isArray(nested.value)) {
        return nested.value;
      }
    }
  }

  return Array.isArray(root.value) ? root.value : [];
}

function extractSubscriptionId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/\/subscriptions\/([^/]+)/i);
  return match?.[1] ?? value;
}

function normalizeSubscription(item: unknown): AzureSubscription | null {
  const record = asRecord(item);
  const subscriptionId = extractSubscriptionId(
    readString(record?.subscriptionId)
      ?? readString(record?.subscriptionID)
      ?? readString(record?.id),
  );

  if (!subscriptionId) {
    return null;
  }

  return {
    subscriptionId,
    displayName: readString(record?.displayName) ?? readString(record?.name) ?? subscriptionId,
    state: readString(record?.state) ?? 'Enabled',
    tenantId: readString(record?.tenantId) ?? '',
  };
}

function normalizeResourceGroup(item: unknown, subscriptionId: string): AzureResourceGroup | null {
  const record = asRecord(item);
  const name = readString(record?.name);
  if (!name) {
    return null;
  }

  const properties = asRecord(record?.properties);

  return {
    id: readString(record?.id) ?? `/subscriptions/${subscriptionId}/resourceGroups/${name}`,
    name,
    location: readString(record?.location) ?? '',
    provisioningState: readString(record?.provisioningState)
      ?? readString(properties?.provisioningState)
      ?? 'Unknown',
  };
}

function normalizeLocation(item: unknown): AzureLocation | null {
  const record = asRecord(item);
  const name = readString(record?.name) ?? readString(record?.displayName);
  if (!name) {
    return null;
  }

  return {
    name,
    displayName: readString(record?.displayName)
      ?? readString(record?.regionalDisplayName)
      ?? name,
  };
}

function normalizeResource(item: unknown): AzureResource | null {
  const record = asRecord(item);
  const id = readString(record?.id);
  const name = readString(record?.name);
  const type = readString(record?.type);

  if (!id || !name || !type) {
    return null;
  }

  const tags = asRecord(record?.tags);

  return {
    id,
    name,
    type,
    location: readString(record?.location) ?? '',
    tags: tags
      ? Object.fromEntries(
          Object.entries(tags)
            .filter(([, value]): value is string => typeof value === 'string'),
        )
      : undefined,
  };
}

async function readJsonOrThrow(
  response: Response,
  scope: 'target-load' | 'resource-load',
): Promise<unknown> {
  const body = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 404 || response.status === 501) {
      throw new AzureDiscoveryUnavailableError();
    }

    throw new Error(sanitizeAzureUiErrorMessage(body, scope));
  }

  return body;
}

export async function listAzureSubscriptions(): Promise<AzureSubscription[]> {
  const response = await apiFetch('/api/azure/subscriptions');
  const body = await readJsonOrThrow(response, 'target-load');

  return readList(body, ['subscriptions', 'items'])
    .map(normalizeSubscription)
    .filter((item): item is AzureSubscription => item !== null);
}

export async function listAzureResourceGroups(subscriptionId: string): Promise<AzureResourceGroup[]> {
  const query = new URLSearchParams({ subscriptionId });
  const response = await apiFetch(`/api/azure/resource-groups?${query.toString()}`);
  const body = await readJsonOrThrow(response, 'target-load');

  return readList(body, ['resourceGroups', 'items'])
    .map((item) => normalizeResourceGroup(item, subscriptionId))
    .filter((item): item is AzureResourceGroup => item !== null);
}

export async function listAzureLocations(subscriptionId: string): Promise<AzureLocation[]> {
  const query = new URLSearchParams({ subscriptionId });
  const response = await apiFetch(`/api/azure/locations?${query.toString()}`);
  const body = await readJsonOrThrow(response, 'target-load');

  return readList(body, ['locations', 'items'])
    .map(normalizeLocation)
    .filter((item): item is AzureLocation => item !== null);
}

export interface ListAzureResourcesInput {
  subscriptionId: string;
  resourceGroup?: string;
  resourceType?: string;
}

export async function listAzureResources(input: ListAzureResourcesInput): Promise<AzureResource[]> {
  const query = new URLSearchParams({ subscriptionId: input.subscriptionId });
  if (input.resourceGroup) {
    query.set('resourceGroup', input.resourceGroup);
  }
  if (input.resourceType) {
    query.set('resourceType', input.resourceType);
  }

  const response = await apiFetch(`/api/azure/resources?${query.toString()}`);
  const body = await readJsonOrThrow(response, 'resource-load');

  return readList(body, ['resources', 'items'])
    .map(normalizeResource)
    .filter((item): item is AzureResource => item !== null);
}
