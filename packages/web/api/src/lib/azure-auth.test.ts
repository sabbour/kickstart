import { describe, expect, it } from "vitest";
import type { HttpRequest } from "@azure/functions";
import { requireAzureAccessToken } from "./azure-auth.js";
import { AzureApiError } from "./azure-errors.js";

function makeRequest(headers: Record<string, string>): HttpRequest {
  return {
    headers: new Headers(headers),
  } as unknown as HttpRequest;
}

describe("requireAzureAccessToken", () => {
  it("returns the SWA-injected Azure access token for authenticated requests", () => {
    const token = requireAzureAccessToken(makeRequest({
      "x-ms-client-principal-id": "principal-123",
      "x-ms-token-aad-access-token": "token-abc",
    }));

    expect(token).toBe("token-abc");
  });

  it("fails closed when the request is not owned by an authenticated principal", () => {
    expect(() => requireAzureAccessToken(makeRequest({
      "x-ms-token-aad-access-token": "token-abc",
    }))).toThrowError(AzureApiError);

    try {
      requireAzureAccessToken(makeRequest({
        "x-ms-token-aad-access-token": "token-abc",
      }));
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: "principal_required",
      });
    }
  });

  it("fails closed when SWA does not provide an Azure access token header", () => {
    expect(() => requireAzureAccessToken(makeRequest({
      "x-ms-client-principal-id": "principal-123",
    }))).toThrowError(AzureApiError);

    try {
      requireAzureAccessToken(makeRequest({
        "x-ms-client-principal-id": "principal-123",
      }));
    } catch (error) {
      expect(error).toMatchObject({
        status: 403,
        code: "azure_access_token_missing",
      });
    }
  });
});
