/**
 * Phase 1 mock-based integration tests for azure-auth.ts
 *
 * Azure auth in this app uses SWA's built-in AAD integration — no MSAL SDK.
 * The browser calls /.auth/me to check session state and redirects to
 * /.auth/login/aad for sign-in. All tests stub fetch and window.location.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAzureSession,
  signInToAzure,
  signOutAzure,
  type AzureAuthSessionState,
} from "../services/azure-auth";
import type { AzureARMConnector, AzureSubscription } from "@kickstart/core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientPrincipal(overrides: Record<string, unknown> = {}) {
  return {
    identityProvider: "aad",
    userDetails: "user@example.com",
    claims: [
      { typ: "preferred_username", val: "user@example.com" },
      { typ: "name", val: "Test User" },
      { typ: "tid", val: "tenant-99" },
    ],
    ...overrides,
  };
}

function mockAuthMe(principal: unknown): void {
  // Use mockImplementation (not mockResolvedValue) so that each fetch call
  // gets a fresh Response instance — a Response body stream can only be read once.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ clientPrincipal: principal }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

function makeConnector(
  subscriptions: AzureSubscription[] = [],
  throwError?: Error,
): AzureARMConnector {
  return {
    isAuthenticated: () => true,
    authenticate: vi.fn(),
    listSubscriptions: throwError
      ? vi.fn().mockRejectedValue(throwError)
      : vi.fn().mockResolvedValue(subscriptions),
    listResourceGroups: vi.fn(),
    listLocations: vi.fn(),
    listAksClusters: vi.fn(),
  } as unknown as AzureARMConnector;
}

const STUB_SUBSCRIPTIONS: AzureSubscription[] = [
  {
    subscriptionId: "sub-001",
    displayName: "Test Subscription",
    state: "Enabled",
    tenantId: "tenant-99",
  },
];

// ---------------------------------------------------------------------------
// Tests: getAzureSession
// ---------------------------------------------------------------------------

describe("getAzureSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns authenticated state with user and subscriptions when principal is present", async () => {
    mockAuthMe(makeClientPrincipal());
    const connector = makeConnector(STUB_SUBSCRIPTIONS);

    const session = await getAzureSession(connector);

    expect(session.authenticated).toBe(true);
    expect(session.configured).toBe(true);
    expect(session.user?.username).toBe("user@example.com");
    expect(session.user?.name).toBe("Test User");
    expect(session.user?.tenantId).toBe("tenant-99");
    expect(session.subscriptions).toHaveLength(1);
    expect(session.subscriptions[0]?.subscriptionId).toBe("sub-001");
  });

  it("returns unauthenticated state when /.auth/me returns null principal", async () => {
    mockAuthMe(null);

    const session = await getAzureSession(makeConnector(STUB_SUBSCRIPTIONS));

    expect(session.authenticated).toBe(false);
    expect(session.subscriptions).toHaveLength(0);
    expect(session.error).toBeUndefined();
  });

  it("returns unauthenticated state when identityProvider is not aad", async () => {
    mockAuthMe(makeClientPrincipal({ identityProvider: "github" }));

    const session = await getAzureSession(makeConnector(STUB_SUBSCRIPTIONS));

    expect(session.authenticated).toBe(false);
    expect(session.subscriptions).toHaveLength(0);
  });

  it("accepts azureActiveDirectory as a valid AAD identity provider", async () => {
    mockAuthMe(makeClientPrincipal({ identityProvider: "azureActiveDirectory" }));
    const connector = makeConnector(STUB_SUBSCRIPTIONS);

    const session = await getAzureSession(connector);

    expect(session.authenticated).toBe(true);
  });

  it("returns error state when ARM connector fails to list subscriptions", async () => {
    mockAuthMe(makeClientPrincipal());
    const connector = makeConnector([], new Error("ARM token expired"));

    const session = await getAzureSession(connector);

    expect(session.authenticated).toBe(false);
    expect(session.error).toBe("ARM token expired");
    expect(session.subscriptions).toHaveLength(0);
  });

  it("returns error state with fallback message when ARM throws non-Error", async () => {
    mockAuthMe(makeClientPrincipal());
    const connector = {
      isAuthenticated: () => true,
      listSubscriptions: vi.fn().mockRejectedValue("string-error"),
    } as unknown as AzureARMConnector;

    const session = await getAzureSession(connector);

    expect(session.authenticated).toBe(false);
    expect(session.error).toBeTruthy();
  });

  it("throws when /.auth/me returns a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 500 })),
    );

    await expect(getAzureSession()).rejects.toThrow("Unable to check Microsoft sign-in status.");
  });

  it("throws when fetch rejects (network error)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );

    await expect(getAzureSession()).rejects.toThrow("Network failure");
  });

  it("returns unauthenticated when no connector is provided but principal is valid", async () => {
    mockAuthMe(makeClientPrincipal());

    // No connector → listSubscriptions will throw "unavailable in this environment"
    const session = await getAzureSession(undefined);

    expect(session.authenticated).toBe(false);
    expect(session.error).toMatch(/unavailable/i);
  });

  it("handles partial claims gracefully — only tenantId present", async () => {
    mockAuthMe({
      identityProvider: "aad",
      userDetails: null,
      claims: [{ typ: "tid", val: "tenant-42" }],
    });
    const connector = makeConnector(STUB_SUBSCRIPTIONS);

    const session = await getAzureSession(connector);

    expect(session.authenticated).toBe(true);
    expect(session.user?.tenantId).toBe("tenant-42");
    expect(session.user?.username).toBeUndefined();
    expect(session.user?.name).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Tests: signInToAzure
// ---------------------------------------------------------------------------

describe("signInToAzure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls getAzureSession and returns state when principal is already present", async () => {
    mockAuthMe(makeClientPrincipal());
    const connector = makeConnector(STUB_SUBSCRIPTIONS);

    const session = await signInToAzure(connector);

    expect(session.authenticated).toBe(true);
    expect(session.subscriptions).toHaveLength(1);
  });

  it("redirects to /.auth/login/aad when /.auth/me returns null principal", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign,
        pathname: "/",
        search: "",
        hash: "",
        origin: "http://localhost",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ clientPrincipal: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const session = await signInToAzure(makeConnector());

    expect(assign).toHaveBeenCalledWith(
      expect.stringContaining("/.auth/login/aad"),
    );
    expect(session.authenticated).toBe(false);
  });

  it("returns unauthenticated silently when /.auth/me fetch fails during signIn", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: {
        assign,
        pathname: "/",
        search: "",
        hash: "",
        origin: "http://localhost",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network failure")),
    );

    const session = await signInToAzure(makeConnector());

    expect(assign).toHaveBeenCalled();
    expect(session.authenticated).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests: signOutAzure
// ---------------------------------------------------------------------------

describe("signOutAzure", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redirects to /.auth/logout on sign-out", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { assign },
    });

    await signOutAzure();

    expect(assign).toHaveBeenCalledWith(
      expect.stringContaining("/.auth/logout"),
    );
  });

  it("includes post_logout_redirect_uri in the logout URL", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { assign },
    });

    await signOutAzure();

    const url: string = assign.mock.calls[0]?.[0];
    expect(url).toMatch(/post_logout_redirect_uri/);
  });
});

// ---------------------------------------------------------------------------
// Tests: AzureAuthSessionState shape contract
// ---------------------------------------------------------------------------

describe("AzureAuthSessionState shape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always sets configured: true in all response paths", async () => {
    const paths: Array<() => Promise<AzureAuthSessionState>> = [
      () => {
        mockAuthMe(null);
        return getAzureSession();
      },
      () => {
        mockAuthMe(makeClientPrincipal());
        return getAzureSession(makeConnector(STUB_SUBSCRIPTIONS));
      },
      () => {
        mockAuthMe(makeClientPrincipal());
        return getAzureSession(makeConnector([], new Error("boom")));
      },
    ];

    for (const path of paths) {
      const session = await path();
      expect(session.configured).toBe(true);
      vi.unstubAllGlobals();
    }
  });
});
