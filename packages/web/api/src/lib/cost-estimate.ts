import {
  PricingConnector,
  type CostEstimateProps,
  type CostEstimatePricingLineItem,
  type CostEstimatePricingRequest,
  type CostEstimateResource,
} from '@kickstart/core';
import type { ApiSession, CostEstimateCacheEntry } from './session-store.js';

const HOURS_PER_MONTH = 730;
const DAYS_PER_MONTH = HOURS_PER_MONTH / 24;
const LIVE_CACHE_TTL_MS = 15 * 60 * 1000;
const ESTIMATED_CACHE_TTL_MS = 60 * 1000;
const LIVE_LOOKUP_TIMEOUT_MS = 8_000;
const MAX_LINE_ITEMS = 12;
const MAX_COMPUTE_QUANTITY = 20;
const MAX_STORAGE_QUANTITY = 10;

export const COST_ESTIMATE_LOADING_MESSAGE = 'Fetching live prices from Azure Retail Prices API…';

export const ALLOWED_COST_ESTIMATE_REGIONS = new Set([
  'eastus',
  'eastus2',
  'westus',
  'westus2',
  'westeurope',
  'northeurope',
  'southeastasia',
  'australiaeast',
]);

const pricingConnector = new PricingConnector(
  {
    auth: { kind: 'none' },
    retry: {
      maxRetries: 1,
      baseDelayMs: 200,
      maxDelayMs: 500,
      jitterFactor: 0,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
  },
  10 * 60 * 1000,
);

type AllowedWorkloadSku =
  | 'Standard_B2s'
  | 'Standard_B4ms'
  | 'Standard_D2s_v3'
  | 'Standard_D4s_v3'
  | 'Standard_D8s_v3'
  | 'Standard_D2as_v5'
  | 'Standard_D4as_v5'
  | 'Standard_D2s_v5'
  | 'Standard_D4s_v5'
  | 'Standard_D8s_v5';

type AllowedStorageSku = 'E30_LRS' | 'LRS';
type AllowedOpenAiSku = 'gpt-4.1-mini' | 'gpt-4.1';

interface WorkloadSkuConfig {
  displaySku: string;
  vcpuCount: number;
  fallbackVmHourly: number;
  fallbackSurchargeHourly: number;
  surchargeMeterName: 'Automatic General Purpose';
}

interface StorageSkuConfig {
  requestSku: AllowedStorageSku;
  displaySku: string;
  retailFilter: string;
  fallbackMonthly: number;
}

interface OpenAiSkuConfig {
  requestSku: AllowedOpenAiSku;
  displaySku: string;
  retailSkuName: string;
  unitOfMeasure: string;
  fallbackUnitPrice: number;
}

const WORKLOAD_SKUS: Record<AllowedWorkloadSku, WorkloadSkuConfig> = {
  Standard_B2s: {
    displaySku: 'Standard_B2s',
    vcpuCount: 2,
    fallbackVmHourly: 0.048,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_B4ms: {
    displaySku: 'Standard_B4ms',
    vcpuCount: 4,
    fallbackVmHourly: 0.192,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D2s_v3: {
    displaySku: 'Standard_D2s_v3',
    vcpuCount: 2,
    fallbackVmHourly: 0.096,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D4s_v3: {
    displaySku: 'Standard_D4s_v3',
    vcpuCount: 4,
    fallbackVmHourly: 0.192,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D8s_v3: {
    displaySku: 'Standard_D8s_v3',
    vcpuCount: 8,
    fallbackVmHourly: 0.384,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D2as_v5: {
    displaySku: 'Standard_D2as_v5',
    vcpuCount: 2,
    fallbackVmHourly: 0.096,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D4as_v5: {
    displaySku: 'Standard_D4as_v5',
    vcpuCount: 4,
    fallbackVmHourly: 0.192,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D2s_v5: {
    displaySku: 'Standard_D2s_v5',
    vcpuCount: 2,
    fallbackVmHourly: 0.096,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D4s_v5: {
    displaySku: 'Standard_D4s_v5',
    vcpuCount: 4,
    fallbackVmHourly: 0.192,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
  Standard_D8s_v5: {
    displaySku: 'Standard_D8s_v5',
    vcpuCount: 8,
    fallbackVmHourly: 0.384,
    fallbackSurchargeHourly: 0.007841,
    surchargeMeterName: 'Automatic General Purpose',
  },
};

const STORAGE_SKUS: Record<AllowedStorageSku, StorageSkuConfig> = {
  E30_LRS: {
    requestSku: 'E30_LRS',
    displaySku: 'E30 LRS',
    retailFilter:
      "serviceName eq 'Storage' and productName eq 'Standard SSD Managed Disks' and skuName eq 'E30 LRS' and meterName eq 'E30 LRS Disk Mount'",
    fallbackMonthly: 6.57,
  },
  LRS: {
    requestSku: 'LRS',
    displaySku: 'E30 LRS',
    retailFilter:
      "serviceName eq 'Storage' and productName eq 'Standard SSD Managed Disks' and skuName eq 'E30 LRS' and meterName eq 'E30 LRS Disk Mount'",
    fallbackMonthly: 6.57,
  },
};

const OPENAI_SKUS: Record<AllowedOpenAiSku, OpenAiSkuConfig> = {
  'gpt-4.1-mini': {
    requestSku: 'gpt-4.1-mini',
    displaySku: 'GPT-4.1 mini',
    retailSkuName: 'gpt 4.1 mini Inp regnl',
    unitOfMeasure: '1K tokens',
    fallbackUnitPrice: 0.00044,
  },
  'gpt-4.1': {
    requestSku: 'gpt-4.1',
    displaySku: 'GPT-4.1',
    retailSkuName: 'gpt 4.1 Inp regnl',
    unitOfMeasure: '1K tokens',
    fallbackUnitPrice: 0.0022,
  },
};

export class CostEstimateRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'CostEstimateRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface NormalizedCostEstimateRequest {
  region: string;
  lineItems: Array<
    | { id: string; kind: 'aksAutomaticControlPlane'; name?: string }
    | { id: string; kind: 'aksAutomaticSystemNodes'; name?: string }
    | { id: string; kind: 'appRouting'; name?: string }
    | { id: string; kind: 'containerRegistry'; name?: string; sku: 'Basic' }
    | { id: string; kind: 'storage'; name?: string; sku: AllowedStorageSku; quantity: number }
    | { id: string; kind: 'azureOpenAI'; name?: string; sku: AllowedOpenAiSku }
    | { id: string; kind: 'aksAutomaticWorkloadCompute'; name?: string; sku: AllowedWorkloadSku; quantity: number }
  >;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function readPositiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function assertOnlyKeys(value: Record<string, unknown>, allowedKeys: string[], context: string): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new CostEstimateRequestError(400, 'invalid_request', `${context} contains unsupported field "${key}".`);
    }
  }
}

function assertLineItemId(value: unknown, index: number): string {
  const id = readText(value);
  if (!id) {
    throw new CostEstimateRequestError(400, 'invalid_request', `lineItems[${index}].id is required.`);
  }
  return id;
}

function assertRegion(value: unknown): string {
  const region = readText(value)?.toLowerCase();
  if (!region || !ALLOWED_COST_ESTIMATE_REGIONS.has(region)) {
    throw new CostEstimateRequestError(400, 'invalid_request', 'region must be one of the supported Azure pricing regions.');
  }
  return region;
}

function assertWorkloadSku(value: unknown, index: number): AllowedWorkloadSku {
  const sku = readText(value) as AllowedWorkloadSku | undefined;
  if (!sku || !(sku in WORKLOAD_SKUS)) {
    throw new CostEstimateRequestError(400, 'invalid_request', `lineItems[${index}].sku must be an allowlisted workload compute SKU.`);
  }
  return sku;
}

function assertStorageSku(value: unknown): AllowedStorageSku {
  const sku = (readText(value) ?? 'E30_LRS') as AllowedStorageSku;
  if (!(sku in STORAGE_SKUS)) {
    throw new CostEstimateRequestError(400, 'invalid_request', 'storage sku must be one of the allowlisted storage SKUs.');
  }
  return sku;
}

function assertOpenAiSku(value: unknown): AllowedOpenAiSku {
  const sku = (readText(value) ?? 'gpt-4.1-mini') as AllowedOpenAiSku;
  if (!(sku in OPENAI_SKUS)) {
    throw new CostEstimateRequestError(400, 'invalid_request', 'azureOpenAI sku must be one of the allowlisted Azure OpenAI SKUs.');
  }
  return sku;
}

export function normalizeCostEstimateRequest(body: unknown): NormalizedCostEstimateRequest {
  if (!isRecord(body)) {
    throw new CostEstimateRequestError(400, 'invalid_request', 'Request body must be a JSON object.');
  }

  assertOnlyKeys(body, ['region', 'lineItems'], 'Request body');

  const region = assertRegion(body.region);
  const rawLineItems = body.lineItems;
  if (!Array.isArray(rawLineItems) || rawLineItems.length === 0 || rawLineItems.length > MAX_LINE_ITEMS) {
    throw new CostEstimateRequestError(400, 'invalid_request', `lineItems must contain between 1 and ${MAX_LINE_ITEMS} entries.`);
  }

  const lineItems = rawLineItems.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new CostEstimateRequestError(400, 'invalid_request', `lineItems[${index}] must be an object.`);
    }

    assertOnlyKeys(entry, ['id', 'kind', 'name', 'sku', 'quantity'], `lineItems[${index}]`);

    const id = assertLineItemId(entry.id, index);
    const kind = readText(entry.kind) as CostEstimatePricingLineItem['kind'] | undefined;
    const name = readText(entry.name);

    switch (kind) {
      case 'aksAutomaticControlPlane':
        return { id, kind, ...(name ? { name } : {}) };
      case 'aksAutomaticSystemNodes':
        return { id, kind, ...(name ? { name } : {}) };
      case 'appRouting':
        return { id, kind, ...(name ? { name } : {}) };
      case 'containerRegistry': {
        const sku = readText(entry.sku) ?? 'Basic';
        if (sku !== 'Basic') {
          throw new CostEstimateRequestError(400, 'invalid_request', 'containerRegistry currently supports only the Basic SKU.');
        }
        return { id, kind, sku: 'Basic' as const, ...(name ? { name } : {}) };
      }
      case 'storage': {
        const sku = assertStorageSku(entry.sku);
        const quantity = readPositiveInt(entry.quantity) ?? 1;
        if (quantity > MAX_STORAGE_QUANTITY) {
          throw new CostEstimateRequestError(400, 'invalid_request', `storage quantity must be between 1 and ${MAX_STORAGE_QUANTITY}.`);
        }
        return { id, kind, sku, quantity, ...(name ? { name } : {}) };
      }
      case 'azureOpenAI': {
        const sku = assertOpenAiSku(entry.sku);
        return { id, kind, sku, ...(name ? { name } : {}) };
      }
      case 'aksAutomaticWorkloadCompute': {
        const sku = assertWorkloadSku(entry.sku, index);
        const quantity = readPositiveInt(entry.quantity) ?? 1;
        if (quantity > MAX_COMPUTE_QUANTITY) {
          throw new CostEstimateRequestError(400, 'invalid_request', `aksAutomaticWorkloadCompute quantity must be between 1 and ${MAX_COMPUTE_QUANTITY}.`);
        }
        return { id, kind, sku, quantity, ...(name ? { name } : {}) };
      }
      default:
        throw new CostEstimateRequestError(400, 'invalid_request', `lineItems[${index}].kind must be an allowlisted pricing kind.`);
    }
  });

  return { region, lineItems };
}

export function getCostEstimateRequestKey(request: CostEstimatePricingRequest | NormalizedCostEstimateRequest): string {
  return JSON.stringify({
    region: request.region,
    lineItems: request.lineItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
    })),
  });
}

function cloneEstimate(value: CostEstimateProps): CostEstimateProps {
  return structuredClone(value);
}

function formatRegion(region: string): string {
  return region
    .replace(/([a-z])([0-9]+)/gi, '$1 $2')
    .replace(/(east|west|north|south|central)(?=[a-z])/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function baseLiveCitation(region: string): string {
  return `Prices from Azure Retail Prices API (${formatRegion(region)}, consumption). Usage-based rows are excluded from the monthly total until usage is known.`;
}

function buildEstimatedCitation(region: string): string {
  return `Live Azure pricing is unavailable right now, so these are estimated monthly prices for ${formatRegion(region)}. Usage-based rows are excluded from the monthly total until usage is known.`;
}

function withMetadata(
  estimate: CostEstimateProps,
  cacheStatus: 'miss' | 'hit' | 'stale',
  cachedAt: string,
  expiresAt: number,
): CostEstimateProps {
  return {
    ...cloneEstimate(estimate),
    total: estimate.monthlyEstimate,
    loading: {
      supported: true,
      state: 'ready',
      message: COST_ESTIMATE_LOADING_MESSAGE,
    },
    cache: {
      status: cacheStatus,
      updatedAt: cachedAt,
      expiresAt: new Date(expiresAt).toISOString(),
    },
  };
}

function storeEstimate(
  session: ApiSession,
  requestKey: string,
  estimate: CostEstimateProps,
  source: 'live' | 'estimated',
  ttlMs: number,
): CostEstimateCacheEntry {
  const cachedAt = estimate.estimatedAt ?? new Date().toISOString();
  const entry: CostEstimateCacheEntry = {
    value: cloneEstimate(estimate),
    source,
    cachedAt,
    expiresAt: Date.now() + ttlMs,
  };
  session.costEstimateCache.set(requestKey, entry);
  return entry;
}

async function fetchSingleRetailPrice(filter: string, signal: AbortSignal): Promise<number> {
  const items = await pricingConnector.fetchRetailPrices({ filter, maxPages: 1, signal });
  const match = items.find((item) => item.type === 'Consumption');
  if (!match) {
    throw new Error(`No consumption retail price found for filter: ${filter}`);
  }
  return match.retailPrice;
}

async function resolveLiveLineItem(
  item: NormalizedCostEstimateRequest['lineItems'][number],
  region: string,
  signal: AbortSignal,
): Promise<CostEstimateResource> {
  switch (item.kind) {
    case 'aksAutomaticControlPlane': {
      const hourly = await fetchSingleRetailPrice(
        `serviceName eq 'Azure Kubernetes Service' and armRegionName eq '${region}' and skuName eq 'Automatic' and meterName eq 'Automatic Hosted Control Plane' and isPrimaryMeterRegion eq true`,
        signal,
      );
      return {
        name: item.name ?? 'AKS Automatic control plane',
        sku: 'Standard',
        monthlyEstimate: roundCurrency(hourly * HOURS_PER_MONTH),
      };
    }
    case 'aksAutomaticSystemNodes':
      return {
        name: item.name ?? 'System nodes',
        sku: 'Managed',
        monthlyEstimate: 0,
        pricingModel: 'included',
      };
    case 'appRouting':
      return {
        name: item.name ?? 'App Routing',
        sku: 'Gateway API',
        monthlyEstimate: 0,
        pricingModel: 'included',
      };
    case 'containerRegistry': {
      const daily = await fetchSingleRetailPrice(
        `serviceName eq 'Container Registry' and armRegionName eq '${region}' and skuName eq 'Basic' and meterName eq 'Basic Registry Unit'`,
        signal,
      );
      return {
        name: item.name ?? 'Container Registry',
        sku: 'Basic',
        monthlyEstimate: roundCurrency(daily * DAYS_PER_MONTH),
      };
    }
    case 'storage': {
      const config = STORAGE_SKUS[item.sku];
      const monthly = await fetchSingleRetailPrice(
        `${config.retailFilter} and armRegionName eq '${region}' and isPrimaryMeterRegion eq true`,
        signal,
      );
      return {
        name: item.name ?? 'Storage',
        sku: config.displaySku,
        monthlyEstimate: roundCurrency(monthly * item.quantity),
      };
    }
    case 'azureOpenAI': {
      const config = OPENAI_SKUS[item.sku];
      const unitPrice = await fetchSingleRetailPrice(
        `serviceName eq 'Foundry Models' and productName eq 'Azure OpenAI' and armRegionName eq '${region}' and skuName eq '${config.retailSkuName}' and isPrimaryMeterRegion eq true`,
        signal,
      );
      return {
        name: item.name ?? 'Azure OpenAI',
        sku: config.displaySku,
        monthlyEstimate: 0,
        pricingModel: 'usage',
        unitPrice: roundCurrency(unitPrice),
        unitOfMeasure: config.unitOfMeasure,
      };
    }
    case 'aksAutomaticWorkloadCompute': {
      const config = WORKLOAD_SKUS[item.sku];
      const vmPrice = await pricingConnector.lookupVmPrice(config.displaySku, region, signal);
      if (!vmPrice) {
        throw new Error(`No workload VM retail price found for SKU ${config.displaySku}.`);
      }
      const surchargeHourly = await fetchSingleRetailPrice(
        `serviceName eq 'Azure Kubernetes Service' and armRegionName eq '${region}' and skuName eq 'Automatic' and meterName eq '${config.surchargeMeterName}' and isPrimaryMeterRegion eq true`,
        signal,
      );
      return {
        name: item.name ?? 'Workload compute',
        sku: config.displaySku,
        monthlyEstimate: roundCurrency(
          item.quantity * (vmPrice.payAsYouGo + (config.vcpuCount * surchargeHourly)) * HOURS_PER_MONTH,
        ),
      };
    }
  }
}

function resolveEstimatedLineItem(
  item: NormalizedCostEstimateRequest['lineItems'][number],
): CostEstimateResource {
  switch (item.kind) {
    case 'aksAutomaticControlPlane':
      return {
        name: item.name ?? 'AKS Automatic control plane',
        sku: 'Standard',
        monthlyEstimate: 116.8,
      };
    case 'aksAutomaticSystemNodes':
      return {
        name: item.name ?? 'System nodes',
        sku: 'Managed',
        monthlyEstimate: 0,
        pricingModel: 'included',
      };
    case 'appRouting':
      return {
        name: item.name ?? 'App Routing',
        sku: 'Gateway API',
        monthlyEstimate: 0,
        pricingModel: 'included',
      };
    case 'containerRegistry':
      return {
        name: item.name ?? 'Container Registry',
        sku: 'Basic',
        monthlyEstimate: roundCurrency(0.1666 * DAYS_PER_MONTH),
      };
    case 'storage': {
      const config = STORAGE_SKUS[item.sku];
      return {
        name: item.name ?? 'Storage',
        sku: config.displaySku,
        monthlyEstimate: roundCurrency(config.fallbackMonthly * item.quantity),
      };
    }
    case 'azureOpenAI': {
      const config = OPENAI_SKUS[item.sku];
      return {
        name: item.name ?? 'Azure OpenAI',
        sku: config.displaySku,
        monthlyEstimate: 0,
        pricingModel: 'usage',
        unitPrice: config.fallbackUnitPrice,
        unitOfMeasure: config.unitOfMeasure,
      };
    }
    case 'aksAutomaticWorkloadCompute': {
      const config = WORKLOAD_SKUS[item.sku];
      return {
        name: item.name ?? 'Workload compute',
        sku: config.displaySku,
        monthlyEstimate: roundCurrency(
          item.quantity * (config.fallbackVmHourly + (config.vcpuCount * config.fallbackSurchargeHourly)) * HOURS_PER_MONTH,
        ),
      };
    }
  }
}

function buildEstimate(
  request: NormalizedCostEstimateRequest,
  source: 'live' | 'estimated',
  resources: CostEstimateResource[],
): CostEstimateProps {
  const estimatedAt = new Date().toISOString();
  const monthlyEstimate = roundCurrency(resources.reduce((sum, resource) => sum + resource.monthlyEstimate, 0));
  return {
    resources,
    monthlyEstimate,
    total: monthlyEstimate,
    currency: 'USD',
    source,
    citation: source === 'live' ? baseLiveCitation(request.region) : buildEstimatedCitation(request.region),
    fallback: {
      used: source === 'estimated',
      ...(source === 'estimated'
        ? {
            reason: 'live_pricing_unavailable' as const,
            message: 'Azure Retail Prices API was unavailable, so these values fall back to the estimated session pricing table.',
          }
        : {}),
    },
    estimatedAt,
  };
}

async function resolveLiveEstimate(request: NormalizedCostEstimateRequest): Promise<CostEstimateProps> {
  const signal = AbortSignal.timeout(LIVE_LOOKUP_TIMEOUT_MS);
  const resources = await Promise.all(request.lineItems.map((item) => resolveLiveLineItem(item, request.region, signal)));
  return buildEstimate(request, 'live', resources);
}

function resolveEstimatedEstimate(request: NormalizedCostEstimateRequest): CostEstimateProps {
  const resources = request.lineItems.map((item) => resolveEstimatedLineItem(item));
  return buildEstimate(request, 'estimated', resources);
}

export async function resolveSessionCostEstimate(
  session: ApiSession,
  request: CostEstimatePricingRequest,
): Promise<CostEstimateProps> {
  const normalized = normalizeCostEstimateRequest(request);
  const requestKey = getCostEstimateRequestKey(normalized);
  const cached = session.costEstimateCache.get(requestKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return withMetadata(cached.value, 'hit', cached.cachedAt, cached.expiresAt);
  }

  try {
    const liveEstimate = await resolveLiveEstimate(normalized);
    const entry = storeEstimate(session, requestKey, liveEstimate, 'live', LIVE_CACHE_TTL_MS);
    return withMetadata(entry.value, 'miss', entry.cachedAt, entry.expiresAt);
  } catch {
    if (cached && cached.source === 'live') {
      const stale = cloneEstimate(cached.value);
      stale.citation = `${cached.value.citation ?? baseLiveCitation(normalized.region)} Using cached live pricing from ${cached.cachedAt} because Azure Retail Prices API is temporarily unavailable.`;
      return withMetadata(stale, 'stale', cached.cachedAt, cached.expiresAt);
    }

    const estimated = resolveEstimatedEstimate(normalized);
    const entry = storeEstimate(session, requestKey, estimated, 'estimated', ESTIMATED_CACHE_TTL_MS);
    return withMetadata(entry.value, 'miss', entry.cachedAt, entry.expiresAt);
  }
}
