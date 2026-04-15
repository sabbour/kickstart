import { apiFetch } from './api-client';
import {
  normalizeCostEstimateInput,
  type CostEstimateData,
  type CostEstimateInput,
  type CostEstimatePricingRequest,
} from '../utils/cost-estimate';

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readOwn(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function readLoadingState(value: unknown): 'idle' | 'loading' | 'ready' | undefined {
  return value === 'idle' || value === 'loading' || value === 'ready' ? value : undefined;
}

function readCacheStatus(value: unknown): 'miss' | 'hit' | 'stale' | undefined {
  return value === 'miss' || value === 'hit' || value === 'stale' ? value : undefined;
}

function readFallbackReason(
  value: unknown,
): 'live_pricing_unavailable' | 'unsupported_request' | undefined {
  return value === 'live_pricing_unavailable' || value === 'unsupported_request'
    ? value
    : undefined;
}

function readErrorMessage(body: unknown, fallback: string): string {
  const record = asRecord(body);
  const direct = readString(record?.error);
  const nested = asRecord(record?.error);
  return direct
    ?? readString(record?.message)
    ?? readString(nested?.message)
    ?? fallback;
}

async function readJsonOrThrow(response: Response, fallback: string): Promise<unknown> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readErrorMessage(body, fallback));
  }
  return body;
}

export function normalizeCostEstimateResponse(body: unknown): CostEstimateData {
  const root = asRecord(body) ?? {};
  const cache = asRecord(readOwn(root, 'cache'));
  const fallback = asRecord(readOwn(root, 'fallback'));
  const loading = asRecord(readOwn(root, 'loading'));
  const resources = readOwn(root, 'resources');
  const items = readOwn(root, 'items');

  return normalizeCostEstimateInput({
    resources: Array.isArray(resources) ? resources as CostEstimateInput['resources'] : undefined,
    items: Array.isArray(items) ? items as CostEstimateInput['items'] : undefined,
    monthlyEstimate: readNumber(readOwn(root, 'monthlyEstimate')) ?? readNumber(readOwn(root, 'total')),
    total: readNumber(readOwn(root, 'total')),
    currency: readString(readOwn(root, 'currency')),
    title: readString(readOwn(root, 'title')),
    projectionMonths: readNumber(readOwn(root, 'projectionMonths')),
    showProjectionSlider: readBoolean(readOwn(root, 'showProjectionSlider')),
    source: readString(readOwn(root, 'source')),
    citation: readString(readOwn(root, 'citation')),
    loading: loading && typeof loading.supported === 'boolean'
      ? {
          supported: loading.supported,
          state: readLoadingState(loading.state),
          message: readString(loading.message),
        }
      : undefined,
    cache: cache
      ? {
          status: readCacheStatus(cache.status),
          updatedAt: readString(cache.updatedAt),
          expiresAt: readString(cache.expiresAt),
        }
      : undefined,
    fallback: fallback && typeof fallback.used === 'boolean'
      ? {
          used: fallback.used,
          reason: readFallbackReason(fallback.reason),
          message: readString(fallback.message),
        }
      : readBoolean(readOwn(root, 'fallback')),
    cached: readBoolean(readOwn(root, 'cached')),
  });
}

export async function fetchCostEstimate(
  sessionId: string,
  payload: CostEstimatePricingRequest,
  signal?: AbortSignal,
): Promise<CostEstimateData> {
  const response = await apiFetch(`/api/sessions/${encodeURIComponent(sessionId)}/cost-estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  const body = await readJsonOrThrow(response, 'Unable to fetch live Azure pricing.');
  return normalizeCostEstimateResponse(body);
}
