import { describe, expect, it } from "vitest";
import { normalizePublicAppUrl } from "./azure-deployments.js";

describe("normalizePublicAppUrl", () => {
  it("normalizes bare public hostnames to HTTPS", () => {
    expect(normalizePublicAppUrl("myapp.azurecontainerapps.io")).toBe("https://myapp.azurecontainerapps.io");
  });

  it("preserves public HTTP and HTTPS URLs", () => {
    expect(normalizePublicAppUrl("https://kickstart.contoso.com/healthz")).toBe("https://kickstart.contoso.com/healthz");
    expect(normalizePublicAppUrl("http://example.com/status")).toBe("http://example.com/status");
  });

  it("rejects localhost and single-label internal hostnames", () => {
    expect(normalizePublicAppUrl("localhost")).toBeUndefined();
    expect(normalizePublicAppUrl("internal-service")).toBeUndefined();
    expect(normalizePublicAppUrl("metadata.azure.internal")).toBeUndefined();
  });

  it("rejects private and link-local IP literals", () => {
    expect(normalizePublicAppUrl("http://127.0.0.1/health")).toBeUndefined();
    expect(normalizePublicAppUrl("http://10.0.0.8")).toBeUndefined();
    expect(normalizePublicAppUrl("http://169.254.169.254/metadata")).toBeUndefined();
    expect(normalizePublicAppUrl("http://[::1]/health")).toBeUndefined();
  });

  it("rejects credentialed URLs", () => {
    expect(normalizePublicAppUrl("https://user:pass@example.com")).toBeUndefined();
  });
});
