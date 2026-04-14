/**
 * @module @kickstart/core/__tests__/pricing-connector
 *
 * Tests for PricingConnector — retail price fetching, caching,
 * VM price lookup, and stub fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PricingConnector,
  _stubEstimate,
  HOURS_PER_MONTH,
} from "../connectors/PricingConnector.js";
import type {
  RetailPricesResponse,
  ResourceCostInput,
} from "../connectors/PricingConnector.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePricingResponse(
  items: RetailPricesResponse["Items"],
  nextPageLink: string | null = null,
): RetailPricesResponse {
  return {
    BillingCurrency: "USD",
    CustomerEntityId: "Default",
    CustomerEntityType: "Retail",
    Items: items,
    NextPageLink: nextPageLink,
    Count: items.length,
  };
}

function makeVmItem(overrides: Partial<RetailPricesResponse["Items"][0]> = {}) {
  return {
    currencyCode: "USD",
    tierMinimumUnits: 0,
    retailPrice: 0.192,
    unitPrice: 0.192,
    armRegionName: "eastus",
    location: "US East",
    effectiveStartDate: "2017-12-15T00:00:00Z",
    meterId: "test-meter-id",
    meterName: "D4s v3",
    productId: "DZH318Z0BQ50",
    skuId: "DZH318Z0BQ50/00RD",
    productName: "Virtual Machines DSv3 Series",
    skuName: "D4s v3",
    serviceName: "Virtual Machines",
    serviceId: "DZH313Z7MMC8",
    serviceFamily: "Compute",
    unitOfMeasure: "1 Hour",
    type: "Consumption",
    isPrimaryMeterRegion: true,
    armSkuName: "Standard_D4s_v3",
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PricingConnector", () => {
  let connector: PricingConnector;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    connector = new PricingConnector(
      { auth: { kind: 'none' }, retry: { maxRetries: 0, baseDelayMs: 0, maxDelayMs: 0, jitterFactor: 0, retryableStatuses: [] } },
      5000,
    );
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    connector.clearCache();
  });

  // ── stubEstimate ──────────────────────────────────────────────────────────

  describe("stubEstimate", () => {
    it("returns correct stub for known resource type and SKU", () => {
      const input: ResourceCostInput = {
        type: "Microsoft.Compute/virtualMachineScaleSets",
        location: "eastus",
        sku: "Standard_D4s_v3",
        quantity: 3,
      };
      const result = _stubEstimate(input);
      expect(result.unitCostPerHour).toBe(0.192);
      expect(result.monthlyCost).toBe(
        Math.round(0.192 * 3 * HOURS_PER_MONTH * 100) / 100,
      );
      expect(result.currency).toBe("USD");
    });

    it("falls back to default pricing for unknown type", () => {
      const input: ResourceCostInput = {
        type: "Microsoft.SomeUnknown/service",
        location: "westus",
      };
      const result = _stubEstimate(input);
      expect(result.unitCostPerHour).toBe(0.05);
      expect(result.sku).toBe("default");
      expect(result.quantity).toBe(1);
    });
  });

  // ── fetchRetailPrices ─────────────────────────────────────────────────────

  describe("fetchRetailPrices", () => {
    it("fetches and returns items from the API", async () => {
      const items = [makeVmItem()];
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.fetchRetailPrices({
        filter: "serviceName eq 'Virtual Machines'",
      });

      expect(result).toHaveLength(1);
      expect(result[0].retailPrice).toBe(0.192);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("caches results and returns from cache on second call", async () => {
      const items = [makeVmItem()];
      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const filter = "serviceName eq 'Virtual Machines' and armRegionName eq 'eastus'";
      const first = await connector.fetchRetailPrices({ filter });
      const second = await connector.fetchRetailPrices({ filter });

      expect(first).toEqual(second);
      // Only one fetch call — second was served from cache
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("follows NextPageLink for pagination", async () => {
      const page1Items = [makeVmItem({ meterName: "D4s v3" })];
      const page2Items = [makeVmItem({ meterName: "D8s v3", retailPrice: 0.384 })];

      fetchSpy
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify(
              makePricingResponse(page1Items, "https://prices.azure.com/api/retail/prices?next=2"),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(makePricingResponse(page2Items)), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const result = await connector.fetchRetailPrices({
        filter: "serviceName eq 'Virtual Machines'",
        maxPages: 2,
      });

      expect(result).toHaveLength(2);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws on non-OK response", async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response("Internal Server Error", {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      await expect(
        connector.fetchRetailPrices({
          filter: "serviceName eq 'Virtual Machines'",
        }),
      ).rejects.toThrow("Azure Pricing API returned 500");
    });
  });

  // ── lookupVmPrice ─────────────────────────────────────────────────────────

  describe("lookupVmPrice", () => {
    it("returns pay-as-you-go price for a Linux VM", async () => {
      const items = [
        makeVmItem({ type: "Consumption", retailPrice: 0.192 }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.lookupVmPrice("Standard_D4s_v3", "eastus");
      expect(result).not.toBeNull();
      expect(result!.payAsYouGo).toBe(0.192);
      expect(result!.vmSize).toBe("Standard_D4s_v3");
      expect(result!.region).toBe("eastus");
    });

    it("includes reservation prices when available", async () => {
      const items = [
        makeVmItem({ type: "Consumption", retailPrice: 0.192 }),
        makeVmItem({
          type: "Reservation",
          retailPrice: 0.12,
          reservationTerm: "1 Year",
        }),
        makeVmItem({
          type: "Reservation",
          retailPrice: 0.08,
          reservationTerm: "3 Years",
        }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.lookupVmPrice("Standard_D4s_v3", "eastus");
      expect(result!.reserved1Year).toBe(0.12);
      expect(result!.reserved3Years).toBe(0.08);
    });

    it("filters out Windows VMs", async () => {
      const items = [
        makeVmItem({
          productName: "Virtual Machines DSv3 Series Windows",
          type: "Consumption",
        }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.lookupVmPrice("Standard_D4s_v3", "eastus");
      expect(result).toBeNull();
    });

    it("returns null on fetch failure", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("Network error"));

      const result = await connector.lookupVmPrice("Standard_D4s_v3", "eastus");
      expect(result).toBeNull();
    });
  });

  // ── lookupServicePrice ────────────────────────────────────────────────────

  describe("lookupServicePrice", () => {
    it("returns items for a service name and region", async () => {
      const items = [
        makeVmItem({
          serviceName: "Azure Kubernetes Service",
          skuName: "Standard",
          retailPrice: 0.1,
        }),
      ];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.lookupServicePrice(
        "Azure Kubernetes Service",
        "eastus",
      );
      expect(result).toHaveLength(1);
      expect(result[0].retailPrice).toBe(0.1);
    });

    it("returns empty array on failure", async () => {
      fetchSpy.mockRejectedValueOnce(new Error("timeout"));

      const result = await connector.lookupServicePrice(
        "Azure Kubernetes Service",
        "eastus",
      );
      expect(result).toEqual([]);
    });
  });

  // ── estimateCost ──────────────────────────────────────────────────────────

  describe("estimateCost", () => {
    it("returns stub estimates when API call fails", async () => {
      fetchSpy.mockRejectedValue(new Error("offline"));

      const result = await connector.estimateCost([
        {
          type: "Microsoft.ContainerService/managedClusters",
          location: "eastus",
          sku: "standard",
        },
      ]);

      expect(result.source).toBe("stub");
      expect(result.resources).toHaveLength(1);
      expect(result.currency).toBe("USD");
    });

    it("returns live estimates when API responds for VMSS", async () => {
      const items = [makeVmItem({ retailPrice: 0.192, type: "Consumption" })];

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await connector.estimateCost([
        {
          type: "Microsoft.Compute/virtualMachineScaleSets",
          location: "eastus",
          sku: "Standard_D4s_v3",
          quantity: 3,
        },
      ]);

      expect(result.source).toBe("live");
      expect(result.resources[0].unitCostPerHour).toBe(0.192);
      expect(result.resources[0].monthlyCost).toBe(
        Math.round(0.192 * 3 * HOURS_PER_MONTH * 100) / 100,
      );
    });

    it("includes estimatedAt timestamp", async () => {
      fetchSpy.mockRejectedValue(new Error("offline"));

      const result = await connector.estimateCost([
        { type: "Microsoft.Network/publicIPAddresses", location: "eastus" },
      ]);

      expect(result.estimatedAt).toBeDefined();
      expect(() => new Date(result.estimatedAt)).not.toThrow();
    });
  });

  // ── Cache management ──────────────────────────────────────────────────────

  describe("clearCache", () => {
    it("forces re-fetch after cache is cleared", async () => {
      const items = [makeVmItem()];
      const makeResponse = () =>
        new Response(JSON.stringify(makePricingResponse(items)), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      fetchSpy.mockResolvedValueOnce(makeResponse());
      fetchSpy.mockResolvedValueOnce(makeResponse());

      const filter = "test-filter";
      await connector.fetchRetailPrices({ filter });
      connector.clearCache();
      await connector.fetchRetailPrices({ filter });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
