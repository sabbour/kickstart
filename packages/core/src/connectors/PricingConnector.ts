import type { APIConnector, APIConnectorRequestOptions } from './types.js';

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
}

/**
 * Connector for the Azure Pricing REST API.
 *
 * No auth required — the Azure pricing API is public.
 * `authenticate()` is a no-op; `isAuthenticated()` always returns true.
 *
 * `estimateCost()` currently returns stub data. Real pricing calls (B-14+)
 * will query https://prices.azure.com/api/retail/prices.
 */
export class PricingConnector implements APIConnector {
  readonly name = 'pricing';
  readonly baseUrl = 'https://prices.azure.com';

  async authenticate(): Promise<void> {
    // No auth needed for public pricing API.
  }

  isAuthenticated(): boolean {
    return true;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /**
   * Estimate monthly cost for a list of Azure resources.
   * Returns stub pricing until the real pricing API is wired up.
   */
  async estimateCost(resources: ResourceCostInput[]): Promise<CostEstimateResult> {
    const estimates = resources.map((r) => stubEstimate(r));
    const totalMonthlyCost = estimates.reduce((sum, e) => sum + e.monthlyCost, 0);

    return {
      resources: estimates,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      currency: 'USD',
      estimatedAt: new Date().toISOString(),
    };
  }
}

// ── Stub pricing table ────────────────────────────────────────────────────────

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
