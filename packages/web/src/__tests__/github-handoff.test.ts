/**
 * Phase 1 mock-based integration tests for github-handoff.ts
 *
 * GitHub auth uses a custom OAuth popup proxy:
 * - GET /api/github-auth/session — check current session
 * - GET /api/github-auth/login   — redirect/popup to start OAuth
 * - POST /api/github-auth/logout — clear session
 * - Popup window posts kickstart:github-auth:complete when done
 *
 * All tests stub fetch and window APIs. No real network calls are made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGitHubSession,
  signInWithGitHubPopup,
  signOutGitHub,
  buildGitHubLoginUrl,
  listGitHubRepos,
  createGitHubRepo,
  type GitHubSessionState,
} from "../services/github-handoff";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AUTHENTICATED_SESSION: GitHubSessionState = {
  authenticated: true,
  configured: true,
  viewer: {
    login: "test-user",
    name: "Test User",
    avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
    htmlUrl: "https://github.com/test-user",
  },
  owners: [
    {
      login: "test-user",
      type: "User",
      label: "test-user",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      htmlUrl: "https://github.com/test-user",
    },
  ],
};

const UNAUTHENTICATED_SESSION: GitHubSessionState = {
  authenticated: false,
  configured: true,
  owners: [],
};

const UNCONFIGURED_SESSION: GitHubSessionState = {
  authenticated: false,
  configured: false,
  owners: [],
};

function stubFetch(responses: Array<{ status: number; body: unknown }>): void {
  let callIndex = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() => {
      const r = responses[callIndex] ?? responses.at(-1)!;
      callIndex++;
      return Promise.resolve(
        new Response(JSON.stringify(r.body), {
          status: r.status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

// ---------------------------------------------------------------------------
// Tests: getGitHubSession
// ---------------------------------------------------------------------------

describe("getGitHubSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns authenticated session when API returns authenticated state", async () => {
    stubFetch([{ status: 200, body: AUTHENTICATED_SESSION }]);

    const session = await getGitHubSession();

    expect(session.authenticated).toBe(true);
    expect(session.configured).toBe(true);
    expect(session.viewer?.login).toBe("test-user");
    expect(session.owners).toHaveLength(1);
  });

  it("returns unauthenticated session when user is not signed in", async () => {
    stubFetch([{ status: 200, body: UNAUTHENTICATED_SESSION }]);

    const session = await getGitHubSession();

    expect(session.authenticated).toBe(false);
    expect(session.viewer).toBeUndefined();
    expect(session.owners).toHaveLength(0);
  });

  it("returns unconfigured session when OAuth app is not registered", async () => {
    stubFetch([{ status: 200, body: UNCONFIGURED_SESSION }]);

    const session = await getGitHubSession();

    expect(session.configured).toBe(false);
    expect(session.authenticated).toBe(false);
  });

  it("throws with a descriptive message when the session API returns an error body", async () => {
    stubFetch([{ status: 500, body: { error: "Internal server error" } }]);

    await expect(getGitHubSession()).rejects.toThrow("Internal server error");
  });

  it("throws fallback message when the session API returns error without error field", async () => {
    stubFetch([{ status: 503, body: {} }]);

    await expect(getGitHubSession()).rejects.toThrow(
      "Unable to load GitHub session state.",
    );
  });

  it("throws when fetch rejects (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network offline")));

    await expect(getGitHubSession()).rejects.toThrow("Network offline");
  });

  it("calls /api/github-auth/session endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(AUTHENTICATED_SESSION), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await getGitHubSession();

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/github-auth/session");
  });
});

// ---------------------------------------------------------------------------
// Tests: signOutGitHub
// ---------------------------------------------------------------------------

describe("signOutGitHub", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves successfully on 200 response", async () => {
    stubFetch([{ status: 200, body: {} }]);

    await expect(signOutGitHub()).resolves.toBeUndefined();
  });

  it("resolves successfully on 204 No Content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(signOutGitHub()).resolves.toBeUndefined();
  });

  it("throws with API error message on non-ok, non-204 response", async () => {
    stubFetch([{ status: 401, body: { error: "Session not found" } }]);

    await expect(signOutGitHub()).rejects.toThrow("Session not found");
  });

  it("throws with fallback message on non-ok response with no error field", async () => {
    stubFetch([{ status: 500, body: {} }]);

    await expect(signOutGitHub()).rejects.toThrow("Unable to sign out of GitHub.");
  });

  it("calls /api/github-auth/logout with POST method", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await signOutGitHub();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/api/github-auth/logout");
    expect((init as RequestInit).method).toBe("POST");
  });
});

// ---------------------------------------------------------------------------
// Tests: buildGitHubLoginUrl
// ---------------------------------------------------------------------------

describe("buildGitHubLoginUrl", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a URL pointing to /api/github-auth/login", () => {
    vi.stubGlobal("window", {
      location: { pathname: "/", search: "", hash: "", origin: "http://localhost" },
    });

    const url = buildGitHubLoginUrl("/callback");

    expect(url).toContain("/api/github-auth/login");
  });

  it("encodes the returnTo parameter", () => {
    const url = buildGitHubLoginUrl("/some/path?foo=bar");

    expect(url).toContain(encodeURIComponent("/some/path?foo=bar"));
  });
});

// ---------------------------------------------------------------------------
// Tests: signInWithGitHubPopup — popup lifecycle
// ---------------------------------------------------------------------------

describe("signInWithGitHubPopup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves with authenticated session when popup posts AUTH_COMPLETE event", async () => {
    vi.useFakeTimers();

    // Session fetch after popup completes
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(AUTHENTICATED_SESSION), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    let capturedMessageHandler: ((event: MessageEvent) => void) | undefined;
    const removeEventListener = vi.fn();
    const clearInterval = vi.fn();
    const popup = { closed: false };

    vi.stubGlobal("window", {
      location: {
        origin: "http://localhost",
        pathname: "/",
        search: "",
        hash: "",
        assign: vi.fn(),
      },
      open: vi.fn().mockReturnValue(popup),
      setInterval: vi.fn().mockReturnValue(1),
      clearInterval,
      addEventListener: vi.fn().mockImplementation(
        (_event: string, handler: (event: MessageEvent) => void) => {
          capturedMessageHandler = handler;
        },
      ),
      removeEventListener,
    });

    const promise = signInWithGitHubPopup();

    // Simulate popup posting AUTH_COMPLETE
    capturedMessageHandler!({
      origin: "http://localhost",
      data: { type: "kickstart:github-auth:complete" },
    } as MessageEvent);

    const session = await promise;

    expect(session.authenticated).toBe(true);
    expect(session.viewer?.login).toBe("test-user");
    expect(clearInterval).toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalled();
  });

  it("rejects when popup posts AUTH_ERROR event", async () => {
    vi.useFakeTimers();

    let capturedMessageHandler: ((event: MessageEvent) => void) | undefined;

    vi.stubGlobal("window", {
      location: { origin: "http://localhost", pathname: "/", search: "", hash: "", assign: vi.fn() },
      open: vi.fn().mockReturnValue({ closed: false }),
      setInterval: vi.fn().mockReturnValue(1),
      clearInterval: vi.fn(),
      addEventListener: vi.fn().mockImplementation(
        (_event: string, handler: (event: MessageEvent) => void) => {
          capturedMessageHandler = handler;
        },
      ),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());

    const promise = signInWithGitHubPopup();

    capturedMessageHandler!({
      origin: "http://localhost",
      data: { type: "kickstart:github-auth:error", error: "OAuth app not configured" },
    } as MessageEvent);

    await expect(promise).rejects.toThrow("OAuth app not configured");
  });

  it("rejects with generic error when AUTH_ERROR has no error string", async () => {
    vi.useFakeTimers();

    let capturedMessageHandler: ((event: MessageEvent) => void) | undefined;

    vi.stubGlobal("window", {
      location: { origin: "http://localhost", pathname: "/", search: "", hash: "", assign: vi.fn() },
      open: vi.fn().mockReturnValue({ closed: false }),
      setInterval: vi.fn().mockReturnValue(1),
      clearInterval: vi.fn(),
      addEventListener: vi.fn().mockImplementation(
        (_event: string, handler: (event: MessageEvent) => void) => {
          capturedMessageHandler = handler;
        },
      ),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());

    const promise = signInWithGitHubPopup();

    capturedMessageHandler!({
      origin: "http://localhost",
      data: { type: "kickstart:github-auth:error" },
    } as MessageEvent);

    await expect(promise).rejects.toThrow("GitHub sign-in failed.");
  });

  it("ignores messages from different origins", async () => {
    let capturedMessageHandler: ((event: MessageEvent) => void) | undefined;
    let storedIntervalCb: (() => void) | undefined;
    const popup = { closed: false };

    vi.stubGlobal("window", {
      location: { origin: "http://localhost", pathname: "/", search: "", hash: "", assign: vi.fn() },
      open: vi.fn().mockReturnValue(popup),
      setInterval: vi.fn().mockImplementation((cb: () => void) => {
        storedIntervalCb = cb;
        return 1;
      }),
      clearInterval: vi.fn(),
      addEventListener: vi.fn().mockImplementation(
        (_event: string, handler: (event: MessageEvent) => void) => {
          capturedMessageHandler = handler;
        },
      ),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("fetch", vi.fn());

    const promise = signInWithGitHubPopup();

    // Cross-origin message should be ignored
    capturedMessageHandler!({
      origin: "https://evil.example.com",
      data: { type: "kickstart:github-auth:complete" },
    } as MessageEvent);

    // Close the popup and trigger the interval watcher directly
    popup.closed = true;
    storedIntervalCb!();

    await expect(promise).rejects.toThrow("GitHub sign-in was cancelled.");
  });

  it("rejects with cancellation error when user closes the popup", async () => {
    let storedIntervalCb: (() => void) | undefined;
    const popup = { closed: false };

    vi.stubGlobal("window", {
      location: { origin: "http://localhost", pathname: "/", search: "", hash: "", assign: vi.fn() },
      open: vi.fn().mockReturnValue(popup),
      setInterval: vi.fn().mockImplementation((cb: () => void) => {
        storedIntervalCb = cb;
        return 1;
      }),
      clearInterval: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const promise = signInWithGitHubPopup();

    // Simulate popup closing and trigger the close watcher directly
    popup.closed = true;
    storedIntervalCb!();

    await expect(promise).rejects.toThrow("GitHub sign-in was cancelled.");
  });

  it("falls back to redirect when window.open returns null (popup blocked)", async () => {
    const assign = vi.fn();
    vi.stubGlobal("window", {
      location: { origin: "http://localhost", pathname: "/", search: "", hash: "", assign },
      open: vi.fn().mockReturnValue(null),
    });

    // signInWithGitHubPopup returns a never-resolving promise when falling back to redirect
    signInWithGitHubPopup();

    expect(assign).toHaveBeenCalledWith(
      expect.stringContaining("/api/github-auth/login"),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: listGitHubRepos
// ---------------------------------------------------------------------------

describe("listGitHubRepos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns repos array on success", async () => {
    const repos = [
      { id: 1, name: "my-app", full_name: "owner/my-app" },
    ];
    stubFetch([{ status: 200, body: { repos } }]);

    const result = await listGitHubRepos("owner");

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("my-app");
  });

  it("passes owner, page, and perPage as query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ repos: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listGitHubRepos("test-owner", 2, 10);

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("owner=test-owner");
    expect(url).toContain("page=2");
    expect(url).toContain("perPage=10");
  });

  it("throws with API error on non-ok response", async () => {
    stubFetch([{ status: 401, body: { error: "Unauthorized" } }]);

    await expect(listGitHubRepos("owner")).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// Tests: createGitHubRepo
// ---------------------------------------------------------------------------

describe("createGitHubRepo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns created repo on success", async () => {
    const repo = {
      id: 42,
      name: "new-repo",
      full_name: "owner/new-repo",
      private: false,
    };
    stubFetch([{ status: 201, body: { repo } }]);

    const result = await createGitHubRepo({
      owner: "owner",
      name: "new-repo",
      description: "A new repo",
      private: false,
    });

    expect(result.name).toBe("new-repo");
    expect(result.id).toBe(42);
  });

  it("sends POST to /api/github/repos with JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ repo: { id: 1, name: "r", full_name: "o/r", private: false } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await createGitHubRepo({ owner: "o", name: "r" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("/api/github/repos");
    expect((init as RequestInit).method).toBe("POST");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.owner).toBe("o");
    expect(body.name).toBe("r");
  });

  it("throws with API error on conflict", async () => {
    stubFetch([{ status: 422, body: { error: "Repository name already taken" } }]);

    await expect(
      createGitHubRepo({ owner: "owner", name: "existing-repo" }),
    ).rejects.toThrow("Repository name already taken");
  });
});
