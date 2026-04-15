export type CostEstimateSource = 'live' | 'estimated';
export type CostEstimateBadgeColor = 'success' | 'informative' | 'warning' | 'subtle';
export type CostEstimateNoticeIntent = 'success' | 'info' | 'warning';
export type CostEstimatePricingKind =
  | 'aksAutomaticControlPlane'
  | 'aksAutomaticSystemNodes'
  | 'aksAutomaticWorkloadCompute'
  | 'appRouting'
  | 'containerRegistry'
  | 'storage'
  | 'azureOpenAI';
export type CostEstimateResourcePricingModel = 'monthly' | 'usage' | 'included';
export type CostEstimateCacheStatus = 'miss' | 'hit' | 'stale';

export interface CostEstimatePricingTier {
  label: string;
  monthlyEstimate: number;
}

export interface CostEstimateSkuOption {
  label: string;
  value: string;
  monthlyEstimate: number;
}

export interface CostEstimateResource {
  name: string;
  sku?: string;
  monthlyEstimate: number;
  pricingModel?: CostEstimateResourcePricingModel;
  unitPrice?: number;
  unitOfMeasure?: string;
  skuOptions?: CostEstimateSkuOption[];
  pricingTiers?: CostEstimatePricingTier[];
}

export interface CostEstimatePricingRequestLineItem {
  id: string;
  kind: CostEstimatePricingKind | string;
  name?: string;
  sku?: string;
  quantity?: number;
}

export interface CostEstimatePricingRequest {
  region: string;
  lineItems: CostEstimatePricingRequestLineItem[];
}

export interface LegacyCostEstimateItem {
  name: string;
  sku?: string;
  monthlyCost: number;
}

export interface CostEstimateLoadingState {
  supported: boolean;
  state?: 'idle' | 'loading' | 'ready';
  message?: string;
}

export interface CostEstimateCacheMetadata {
  status: CostEstimateCacheStatus;
  updatedAt?: string;
  expiresAt?: string;
}

export interface CostEstimateFallbackMetadata {
  used: boolean;
  reason?: 'live_pricing_unavailable' | 'unsupported_request';
  message?: string;
}

export interface CostEstimateInput {
  resources?: CostEstimateResource[];
  items?: LegacyCostEstimateItem[];
  monthlyEstimate?: number;
  total?: number;
  currency?: string;
  title?: string;
  projectionMonths?: number;
  showProjectionSlider?: boolean;
  source?: string;
  citation?: string;
  loading?: CostEstimateLoadingState;
  cache?: CostEstimateCacheMetadata;
  fallback?: boolean | CostEstimateFallbackMetadata;
  pricingRequest?: CostEstimatePricingRequest;
  estimatedAt?: string;
  cached?: boolean;
}

export interface CostEstimateData {
  resources: CostEstimateResource[];
  monthlyEstimate: number;
  currency: string;
  title?: string;
  projectionMonths?: number;
  showProjectionSlider?: boolean;
  source?: CostEstimateSource;
  citation?: string;
  loading?: CostEstimateLoadingState;
  cache?: CostEstimateCacheMetadata;
  fallback?: CostEstimateFallbackMetadata;
  estimatedAt?: string;
}

export interface CostEstimateNotice {
  badgeLabel?: string;
  badgeColor?: CostEstimateBadgeColor;
  intent?: CostEstimateNoticeIntent;
  message?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function normalizePricingTier(value: CostEstimatePricingTier | null | undefined): CostEstimatePricingTier | null {
  if (!value) return null;
  const label = readText(value.label);
  if (!label || !isFiniteNumber(value.monthlyEstimate)) return null;
  return {
    label,
    monthlyEstimate: roundCurrency(value.monthlyEstimate),
  };
}

function normalizeSkuOption(value: CostEstimateSkuOption | null | undefined): CostEstimateSkuOption | null {
  if (!value) return null;
  const label = readText(value.label);
  const optionValue = readText(value.value);
  if (!label || !optionValue || !isFiniteNumber(value.monthlyEstimate)) return null;
  return {
    label,
    value: optionValue,
    monthlyEstimate: roundCurrency(value.monthlyEstimate),
  };
}

function normalizePricingModel(
  value: unknown,
): CostEstimateResourcePricingModel | undefined {
  return value === 'monthly' || value === 'usage' || value === 'included'
    ? value
    : undefined;
}

function normalizeResource(value: CostEstimateResource | null | undefined): CostEstimateResource | null {
  if (!value) return null;
  const name = readText(value.name);
  if (!name || !isFiniteNumber(value.monthlyEstimate)) return null;

  const skuOptions = Array.isArray(value.skuOptions)
    ? value.skuOptions
      .map(normalizeSkuOption)
      .filter((option): option is CostEstimateSkuOption => Boolean(option))
    : undefined;

  const pricingTiers = Array.isArray(value.pricingTiers)
    ? value.pricingTiers
      .map(normalizePricingTier)
      .filter((tier): tier is CostEstimatePricingTier => Boolean(tier))
    : undefined;

  return {
    name,
    sku: readText(value.sku),
    monthlyEstimate: roundCurrency(value.monthlyEstimate),
    pricingModel: normalizePricingModel(value.pricingModel),
    unitPrice: isFiniteNumber(value.unitPrice) ? value.unitPrice : undefined,
    unitOfMeasure: readText(value.unitOfMeasure),
    skuOptions: skuOptions?.length ? skuOptions : undefined,
    pricingTiers: pricingTiers?.length ? pricingTiers : undefined,
  };
}

function normalizeLoadingState(
  value: CostEstimateLoadingState | null | undefined,
): CostEstimateLoadingState | undefined {
  if (!value || value.supported !== true) return undefined;
  return {
    supported: true,
    state: value.state === 'idle' || value.state === 'loading' || value.state === 'ready'
      ? value.state
      : undefined,
    message: readText(value.message),
  };
}

function normalizeCacheStatus(value: unknown): CostEstimateCacheStatus | undefined {
  return value === 'miss' || value === 'hit' || value === 'stale' ? value : undefined;
}

function normalizeCacheMetadata(
  value: CostEstimateCacheMetadata | null | undefined,
): CostEstimateCacheMetadata | undefined {
  if (!value) return undefined;
  const status = normalizeCacheStatus(value.status);
  if (!status) return undefined;
  return {
    status,
    updatedAt: readText(value.updatedAt),
    expiresAt: readText(value.expiresAt),
  };
}

function normalizeFallbackMetadata(
  value: boolean | CostEstimateFallbackMetadata | null | undefined,
  citation?: string,
): CostEstimateFallbackMetadata | undefined {
  if (value === true) {
    return {
      used: true,
      message: citation,
    };
  }

  if (!value || value.used !== true) return undefined;

  return {
    used: true,
    reason: value.reason === 'live_pricing_unavailable' || value.reason === 'unsupported_request'
      ? value.reason
      : undefined,
    message: readText(value.message) ?? citation,
  };
}

export function sumCostEstimateResources(resources: CostEstimateResource[]): number {
  return roundCurrency(resources.reduce((sum, resource) => sum + resource.monthlyEstimate, 0));
}

export function normalizeCostEstimateSource(value: unknown): CostEstimateSource | undefined {
  const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!source) return undefined;

  if (source === 'live' || source === 'cached' || source === 'cached-live' || source.includes('live')) {
    return 'live';
  }

  if (source === 'estimated' || source === 'stub' || source === 'fallback' || source.includes('estimate')) {
    return 'estimated';
  }

  return undefined;
}

export function normalizeCostEstimateInput(input: CostEstimateInput): CostEstimateData {
  const resources = Array.isArray(input.resources)
    ? input.resources
      .map(normalizeResource)
      .filter((resource): resource is CostEstimateResource => Boolean(resource))
    : Array.isArray(input.items)
      ? input.items
        .map((item) => {
          const name = readText(item.name);
          if (!name || !isFiniteNumber(item.monthlyCost)) return null;
          return {
            name,
            sku: readText(item.sku),
            monthlyEstimate: roundCurrency(item.monthlyCost),
          } satisfies CostEstimateResource;
        })
        .filter((resource): resource is CostEstimateResource => Boolean(resource))
      : [];

  const citation = readText(input.citation);
  const normalizedCache = normalizeCacheMetadata(input.cache)
    ?? (input.cached === true ? { status: 'hit' as const } : undefined);
  const normalizedFallback = normalizeFallbackMetadata(input.fallback, citation);

  const monthlyEstimate = isFiniteNumber(input.monthlyEstimate)
    ? input.monthlyEstimate
    : isFiniteNumber(input.total)
      ? input.total
      : sumCostEstimateResources(resources);

  return {
    resources,
    monthlyEstimate: roundCurrency(monthlyEstimate),
    currency: readText(input.currency) ?? 'USD',
    title: readText(input.title),
    projectionMonths: isFiniteNumber(input.projectionMonths) ? input.projectionMonths : undefined,
    showProjectionSlider: input.showProjectionSlider === true,
    source: normalizeCostEstimateSource(input.source),
    citation,
    loading: normalizeLoadingState(input.loading),
    cache: normalizedCache,
    fallback: normalizedFallback,
    estimatedAt: readText(input.estimatedAt),
  };
}

export function formatAzureRegion(region?: string): string | undefined {
  const raw = readText(region);
  if (!raw) return undefined;

  return raw
    .replace(/([a-z])([0-9]+)/gi, '$1 $2')
    .replace(/(east|west|north|south|central)(?=[a-z])/gi, '$1 ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function buildDefaultCostEstimateCitation(
  source: CostEstimateSource,
  region?: string,
): string {
  const scope = formatAzureRegion(region);
  if (source === 'live') {
    return `Prices from Azure Retail Prices API${scope ? ` (${scope}, consumption)` : ''}. Usage-based rows are excluded from the monthly total until usage is known.`;
  }

  return `Live Azure pricing is unavailable right now, so these are estimated monthly prices${scope ? ` for ${scope}` : ''}. Usage-based rows are excluded from the monthly total until usage is known.`;
}

export function resolveCostEstimateDisplay({
  initialEstimate,
  fetchedEstimate,
  pricingRequested,
  pricingFailed,
  region,
}: {
  initialEstimate: CostEstimateData;
  fetchedEstimate: CostEstimateData | null;
  pricingRequested: boolean;
  pricingFailed: boolean;
  region?: string;
}): CostEstimateData {
  if (fetchedEstimate) {
    return {
      ...initialEstimate,
      ...fetchedEstimate,
      citation: fetchedEstimate.citation
        ?? buildDefaultCostEstimateCitation(fetchedEstimate.source ?? 'live', region),
      loading: fetchedEstimate.loading ?? initialEstimate.loading,
    };
  }

  if (pricingRequested && pricingFailed) {
    return {
      ...initialEstimate,
      source: 'estimated',
      citation: initialEstimate.citation ?? buildDefaultCostEstimateCitation('estimated', region),
      cache: initialEstimate.cache ?? { status: 'miss' },
      fallback: {
        used: true,
        reason: 'live_pricing_unavailable',
        message: initialEstimate.fallback?.message
          ?? initialEstimate.citation
          ?? 'Azure Retail Prices API was unavailable, so these values fall back to the estimated session pricing table.',
      },
      loading: initialEstimate.loading ?? {
        supported: true,
        state: 'ready',
      },
    };
  }

  if (initialEstimate.source === 'live' && !initialEstimate.citation) {
    return {
      ...initialEstimate,
      citation: buildDefaultCostEstimateCitation('live', region),
    };
  }

  return initialEstimate;
}

export function buildCostEstimateNotice(
  estimate: CostEstimateData,
  region?: string,
): CostEstimateNotice {
  const cacheStatus = estimate.cache?.status;
  const isCached = cacheStatus === 'hit' || cacheStatus === 'stale';
  const fallbackMessage = estimate.fallback?.message
    ?? (estimate.fallback?.used ? buildDefaultCostEstimateCitation('estimated', region) : undefined);

  if (estimate.source === 'live' && isCached) {
    const citation = estimate.citation ?? buildDefaultCostEstimateCitation('live', region);
    return {
      badgeLabel: 'Cached live pricing',
      badgeColor: 'informative',
      intent: 'info',
      message: citation,
    };
  }

  if (estimate.source === 'live') {
    return {
      badgeLabel: 'Live Azure pricing',
      badgeColor: 'success',
      intent: 'success',
      message: estimate.citation ?? buildDefaultCostEstimateCitation('live', region),
    };
  }

  if (estimate.source === 'estimated' && estimate.fallback?.used) {
    return {
      badgeLabel: 'Estimated fallback',
      badgeColor: 'warning',
      intent: 'warning',
      message: fallbackMessage,
    };
  }

  if (estimate.source === 'estimated') {
    return {
      badgeLabel: 'Estimated pricing',
      badgeColor: 'subtle',
      intent: estimate.citation ? 'info' : undefined,
      message: estimate.citation,
    };
  }

  return {};
}

export function shouldFetchLivePricing(
  backendSessionId: string | null | undefined,
  pricingRequest?: CostEstimatePricingRequest,
): boolean {
  return Boolean(
    backendSessionId
      && pricingRequest
      && readText(pricingRequest.region)
      && Array.isArray(pricingRequest.lineItems)
      && pricingRequest.lineItems.length > 0,
  );
}

export function getCostEstimateRequestKey(
  pricingRequest?: CostEstimatePricingRequest,
): string {
  if (!pricingRequest) return '';
  return JSON.stringify({
    region: pricingRequest.region,
    lineItems: pricingRequest.lineItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
    })),
  });
}
