import { describe, expect, it } from "vitest";
import { sanitizeActionContext } from "../utils/sanitize-action-context";

describe("sanitizeActionContext", () => {
  it("preserves GitHub repository selection keys", () => {
    expect(sanitizeActionContext({
      value: "sabbour/demo-app",
      owner: "sabbour",
      repo: "demo-app",
      visibility: "private",
      ignored: "drop-me",
    })).toEqual({
      value: "sabbour/demo-app",
      owner: "sabbour",
      repo: "demo-app",
      visibility: "private",
    });
  });

  it("preserves Azure deployment target keys needed for the ship path", () => {
    expect(sanitizeActionContext({
      selectedLabel: "Azure target confirmed",
      subscriptionId: "00000000-0000-0000-0000-000000000123",
      resourceGroup: "kickstart-prod-rg",
      location: "eastus",
      resourceId: "/subscriptions/00000000-0000-0000-0000-000000000123/resourceGroups/kickstart-prod-rg/providers/Microsoft.ContainerService/managedClusters/kickstart-aks",
      tenantId: "11111111-1111-1111-1111-111111111111",
      ignored: "drop-me",
    })).toEqual({
      selectedLabel: "Azure target confirmed",
      subscriptionId: "00000000-0000-0000-0000-000000000123",
      resourceGroup: "kickstart-prod-rg",
      location: "eastus",
      resourceId: "/subscriptions/00000000-0000-0000-0000-000000000123/resourceGroups/kickstart-prod-rg/providers/Microsoft.ContainerService/managedClusters/kickstart-aks",
      tenantId: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("drops raw SWA principal details from action context", () => {
    expect(sanitizeActionContext({
      selectedLabel: "Azure target confirmed",
      subscriptionId: "00000000-0000-0000-0000-000000000123",
      clientPrincipal: "{\"userId\":\"abc\",\"userRoles\":[\"authenticated\"]}",
      principalId: "principal-123",
      userDetails: "ahmed@example.com",
      userRoles: "anonymous,authenticated",
      claims: "[{\"typ\":\"name\",\"val\":\"Ahmed\"}]",
    })).toEqual({
      selectedLabel: "Azure target confirmed",
      subscriptionId: "00000000-0000-0000-0000-000000000123",
    });
  });
});
