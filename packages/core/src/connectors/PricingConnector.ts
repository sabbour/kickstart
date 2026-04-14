import type { ConnectorConfig } from './types.js';
import { BaseConnector } from './BaseConnector.js';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ResourceCostInput {
  /** Azure resource type, e.g. "Microsoft.ContainerService/managedClusters" */
  type: string;
  /** Azure region, e.g. "eastus" */
  location: string;
  /** SKU or tier, e.g. "Standard_D2s_v3" */
  sku?: string;
  /** Number of instances / nodes */
  quantity?: number;
}

export interface ResourceCostEstimate {
  type: string;
  sku: string;
  location: string;
  quantity: number;
  unitCostPerHour: number;
  monthlyCost: number;
  currency: 'USD';
}

export interface CostEstimateResult {
  resources: ResourceCostEstimate[];
  totalMonthlyCost: number;
  currency: 'USD';
  /** ISO 8601 timestamp of when this estimate was generated. */
  estimatedAt: string;
  /** Whether the result used live API data or fell back to stubs. */
  source: 'live' | 'stub';
}

/** A single price item from the Azure Retail Prices API. */
export interface RetailPriceItem {
  currencyCode: string;
  retailPrice: number;
  unitPrice: number;
  armRegionName: string;
  location: string;
  meterName: string;
  productId: string;
  skuId: string;
  productName: string;
  skuName: string;
  serviceName: string;
  serviceFamily: string;
  unitOfMeasure: string;
  type: string; // "Consumption" | "Reservation"
  isPrimaryMeterRegion: boolean;
  armSkuName: string;
  effectiveStartDate: string;
  tierMinimumUnits: number;
  reservationTerm?: string; // "1 Year" | "3 Years"
}

/** Response envelope from the Azure Retail Prices API. */
export interface RetailPricesResponse {
  BillingCurrency: string;
  CustomerEntityId: string;
  CustomerEntityType: string;
  Items: RetailPriceItem[];
  NextPageLink: string | null;
  Count: number;
}

export interface RetailPriceQuery {
  /** OData $filter expression. */
  filter: string;
  /** Max pages to fetch (default: 1). */
  maxPages?: number;
}

/** Resolved price for a VM SKU with optional reservation tiers. */
export interface VmPriceResult {
  vmSize: string;
  region: string;
  payAsYouGo: number;
  reserved1Year?: number;
  reserved3Years?: number;
  currency: string;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/** Default cache TTL — 30 minutes. Pricing data changes infrequently. */
const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Connector for the Azure Retail Pricing REST API.
 *
 * No auth required — the Azure pricing API is public.
 * Auth strategy defaults to "none".
 *
 * Provides:
 * - `fetchRetailPrices()` — raw API query with pagination + caching
 * - `lookupVmPrice()` — convenience for VM hourly cost by SKU + region
 * - `estimateCost()` — high-level cost estimation with live API fallback to stubs
 */
export class PricingConnector extends BaseConnector {
  readonly name = 'pricing';

  /** In-memory cache keyed by OData filter string. */
  private readonly _cache = new Map<string, CacheEntry<RetailPriceItem[]>>();
  private readonly _cacheTtlMs: number;

  protected get defaultBaseUrl(): string {
    return 'https://prices.azure.com';
  }

  constructor(config?: ConnectorConfig, cacheTtlMs?: number) {
    super(config ?? { auth: { kind: 'none' } });
    this._cacheTtlMs = cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  // ── Raw API ─────────────────────────────────────────────────────────────────

  /**
   * Query the Azure Retail Prices API with an OData filter.
   * Results are cached in memory for the session duration (configurable TTL).
   * Follows NextPageLink for pagination up to `maxPages`.
   */
  async fetchRetailPrices(query: RetailPriceQuery): Promise<RetailPriceItem[]> {
    const cached = this._cache.get(query.filter);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const maxPages = query.maxPages ?? 1;
    const allItems: RetailPriceItem[] = [];
    let nextUrl: string | null = null;
    let page = 0;

    // Build initial URL
    const initialPath = `/api/retail/prices?$filter=${encodeURIComponent(query.filter)}`;

    while (page < maxPages) {
      const response = page === 0
        ? await this.request('GET', initialPath)
        : await this.requestUrl('GET', nextUrl!);

      if (!response.ok) {
        throw new Error(`Azure Pricing API returned ${response.status}: ${response.statusText}`);
      }

      const body = (await response.json()) as RetailPricesResponse;
      allItems.push(...body.Items);
      nextUrl = body.NextPageLink;

      if (!nextUrl) break;
      page++;
    }

    this._cache.set(query.filter, {
      data: allItems,
      expiresAt: Date.now() + this._cacheTtlMs,
    });

    return allItems;
  }

  // ── Convenience lookups ─────────────────────────────────────────────────────

  /**
   * Look up hourly cost for a VM size in a given region.
   * Returns pay-as-you-go and optional reservation prices.
   * Returns `null` if the API call fails (caller should fall back to stubs).
   */
  async lookupVmPrice(vmSize: string, region: string): Promise<VmPriceResult | null> {
    // Map Standard_D4s_v3 → D4s v3 (API skuName format)
    const skuName = vmSize.replace(/^Standard_/, '').replace(/_/g, ' ');

    const filter = [
      `serviceName eq 'Virtual Machines'`,
      `armRegionName eq '${region}'`,
      `skuName eq '${skuName}'`,
      `isPrimaryMeterRegion eq true`,
    ].join(' and ');

    try {
      const items = await this.fetchRetailPrices({ filter, maxPages: 1 });

      // Find Linux (non-Windows) consumption price
      const consumption = items.find(
        (i) =>
          i.type === 'Consumption' &&
          !i.productName.includes('Windows') &&
          !i.productName.includes('Spot') &&
          i.armSkuName === vmSize,
      );

      if (!consumption) return null;

      // Find reservation prices
      const reservations = items.filter(
        (i) =>
          i.type === 'Reservation' &&
          !i.productName.includes('Windows') &&
          !i.productName.includes('Spot') &&
          i.armSkuName === vmSize,
      );

      const reserved1yr = reservations.find((r) => r.reservationTerm === '1 Year');
      const reserved3yr = reservations.find((r) => r.reservationTerm === '3 Years');

      return {
        vmSize,
        region,
        payAsYouGo: consumption.retailPrice,
        reserved1Year: reserved1yr ? reserved1yr.retailPrice : undefined,
        reserved3Years: reserved3yr ? reserved3yr.retailPrice : undefined,
        currency: consumption.currencyCode,
      };
    } catch {
      return null;
    }
  }

  /**
   * Look up pricing for an Azure service by name, region, and optional SKU.
   * Returns matching retail price items or empty array on failure.
   */
  async lookupServicePrice(
    serviceName: string,
    region: string,
    skuName?: string,
  ): Promise<RetailPriceItem[]> {
    const parts = [
      `serviceName eq '${serviceName}'`,
      `armRegionName eq '${region}'`,
    ];
    if (skuName) parts.push(`skuName eq '${skuName}'`);
    parts.push(`isPrimaryMeterRegion eq true`);

    const filter = parts.join(' and ');

    try {
      return await this.fetchRetailPrices({ filter, maxPages: 1 });
    } catch {
      return [];
    }
  }

  /** Clear the in-memory cache. */
  clearCache(): void {
    this._cache.clear();
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /**
   * Estimate monthly cost for a list of Azure resources.
   * Tries real pricing API first; falls back to stub data on failure.
   */
  async estimateCost(resources: ResourceCostInput[]): Promise<CostEstimateResult> {
    let source: 'live' | 'stub' = 'stub';
    const estimates: ResourceCostEstimate[] = [];

    for (const r of resources) {
      const live = await this.tryLiveEstimate(r);
      if (live) {
        estimates.push(live);
        source = 'live';
      } else {
        estimates.push(stubEstimate(r));
      }
    }

    const totalMonthlyCost = estimates.reduce((sum, e) => sum + e.monthlyCost, 0);

    return {
      resources: estimates,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      currency: 'USD',
      estimatedAt: new Date().toISOString(),
      source,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Attempt a live price lookup for a resource; returns null on any failure. */
  private async tryLiveEstimate(input: ResourceCostInput): Promise<ResourceCostEstimate | null> {
    try {
      // VM scale sets → look up VM price
      if (input.type === 'Microsoft.Compute/virtualMachineScaleSets' && input.sku) {
        const price = await this.lookupVmPrice(input.sku, input.location);
        if (price) {
          const quantity = input.quantity ?? 1;
          return {
            type: input.type,
            sku: input.sku,
            location: input.location,
            quantity,
            unitCostPerHour: price.payAsYouGo,
            monthlyCost: Math.round(price.payAsYouGo * quantity * HOURS_PER_MONTH * 100) / 100,
            currency: 'USD',
          };
        }
      }

      // AKS clusters → look up AKS service pricing
      if (input.type === 'Microsoft.ContainerService/managedClusters') {
        const items = await this.lookupServicePrice(
          'Azure Kubernetes Service',
          input.location,
          input.sku,
        );
        const match = items.find((i) => i.type === 'Consumption');
        if (match) {
          const quantity = input.quantity ?? 1;
          return {
            type: input.type,
            sku: input.sku ?? match.skuName,
            location: input.location,
            quantity,
            unitCostPerHour: match.retailPrice,
            monthlyCost: Math.round(match.retailPrice * quantity * HOURS_PER_MONTH * 100) / 100,
            currency: 'USD',
          };
        }
      }
    } catch {
      // Fall through to null
    }
    return null;
  }

  /**
   * Make a GET request to a full URL (for NextPageLink pagination).
   * Uses raw fetch to bypass BaseConnector path resolution.
   */
  private async requestUrl(method: 'GET', url: string): Promise<Response> {
    return fetch(url, {
      method,
      headers: { Accept: 'application/json' },
    });
  }
}

// ── Stub pricing table (fallback) ─────────────────────────────────────────────

const HOURS_PER_MONTH = 730;

/** Approximate hourly prices (USD) by resource type + SKU. All stubs — not real. */
const PRICE_TABLE: Record<string, Record<string, number>> = {
  'Microsoft.ContainerService/managedClusters': {
    free: 0,
    standard: 0.1,
    premium: 0.2,
    default: 0.1,
  },
  'Microsoft.ContainerRegistry/registries': {
    basic: 0.00547,
    standard: 0.0166,
    premium: 0.0548,
    default: 0.0166,
  },
  'Microsoft.Network/publicIPAddresses': {
    default: 0.004,
  },
  'Microsoft.Compute/virtualMachineScaleSets': {
    Standard_D2s_v3: 0.096,
    Standard_D4s_v3: 0.192,
    Standard_D8s_v3: 0.384,
    default: 0.096,
  },
  default: {
    default: 0.05,
  },
};

function stubEstimate(input: ResourceCostInput): ResourceCostEstimate {
  const typePrices = PRICE_TABLE[input.type] ?? PRICE_TABLE['default'];
  const sku = input.sku ?? 'default';
  const unitCostPerHour = typePrices[sku] ?? typePrices['default'] ?? 0.05;
  const quantity = input.quantity ?? 1;
  const monthlyCost = Math.round(unitCostPerHour * quantity * HOURS_PER_MONTH * 100) / 100;

  return {
    type: input.type,
    sku,
    location: input.location,
    quantity,
    unitCostPerHour,
    monthlyCost,
    currency: 'USD',
  };
}

// Re-export stubEstimate for testing
export { stubEstimate as _stubEstimate, HOURS_PER_MONTH };
