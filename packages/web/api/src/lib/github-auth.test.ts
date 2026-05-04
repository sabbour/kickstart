import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cookie, HttpRequest } from "@azure/functions";
import {
  commitGitHubFilesAndCreatePullRequestForRequest,
  completeGitHubAuth,
  getGitHubAuthLogin,
} from "./github-auth.js";

const fetchMock = vi.fn<typeof fetch>();
const ORIGINAL_ENV = {
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  sessionSecret: process.env.GITHUB_SESSION_SECRET,
};
const VIEWER = {
  login: "sabbour",
  avatar_url: "https://avatars.githubusercontent.com/u/103856?v=4",
  html_url: "https://github.com/sabbour",
  name: "Ahmed Sabbour",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function makeRequest(
  headers: Record<string, string> = {},
  url = "https://kickstart.test/api/github/pulls",
): HttpRequest {
  return {
    headers: new Headers(headers),
    url,
  } as unknown as HttpRequest;
}

function cookieHeader(cookies: Cookie[]): string {
  return cookies
    .filter((cookie) => cookie.maxAge !== 0 && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function createSessionCookie(): Promise<string> {
  const loginRequest = makeRequest({
    "x-ms-client-principal-id": "principal-123",
    host: "kickstart.test",
    "x-forwarded-proto": "https",
  }, "https://kickstart.test/api/github-auth/login");
  const { location, cookies } = getGitHubAuthLogin(loginRequest, "principal-123", "/handoff");
  const state = new URL(location).searchParams.get("state");
  if (!state) {
    throw new Error("Expected GitHub OAuth state.");
  }

  fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: "ghs_test_token" }));
  fetchMock.mockResolvedValueOnce(jsonResponse(VIEWER));
  fetchMock.mockResolvedValueOnce(jsonResponse([]));

  const callbackRequest = makeRequest({
    cookie: cookieHeader(cookies),
    host: "kickstart.test",
    "x-forwarded-proto": "https",
  }, "https://kickstart.test/api/github-auth/callback");
  const { cookies: sessionCookies } = await completeGitHubAuth(callbackRequest, "code-123", state);
  return cookieHeader(sessionCookies);
}

describe("commitGitHubFilesAndCreatePullRequestForRequest", () => {
  beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = "client-id";
    process.env.GITHUB_CLIENT_SECRET = "client-secret";
    process.env.GITHUB_SESSION_SECRET = "session-secret";
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.clientId;
    process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.clientSecret;
    process.env.GITHUB_SESSION_SECRET = ORIGINAL_ENV.sessionSecret;
  });

  it("commits files and opens a pull request with the server-owned GitHub session", async () => {
    const cookie = await createSessionCookie();
    fetchMock.mockReset();

    fetchMock.mockResolvedValueOnce(jsonResponse(VIEWER));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 1,
      name: "demo-app",
      full_name: "sabbour/demo-app",
      private: true,
      html_url: "https://github.com/sabbour/demo-app",
      description: "Kickstart demo",
      default_branch: "main",
      language: "TypeScript",
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ref: "refs/heads/main",
      object: { sha: "base-sha" },
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse(
      { message: "Not Found" },
      { status: 404 },
    ));
    fetchMock.mockResolvedValueOnce(jsonResponse(
      {
        ref: "refs/heads/feature/kickstart",
        object: { sha: "base-sha" },
      },
      { status: 201 },
    ));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      sha: "base-sha",
      tree: { sha: "tree-base" },
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ sha: "tree-new" }, { status: 201 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      sha: "commit-new",
      tree: { sha: "tree-new" },
    }, { status: 201 }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ref: "refs/heads/feature/kickstart",
      object: { sha: "commit-new" },
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      number: 42,
      html_url: "https://github.com/sabbour/demo-app/pull/42",
      title: "feat: add artifacts",
      state: "open",
      head: { ref: "feature/kickstart", sha: "commit-new" },
      base: { ref: "main" },
    }, { status: 201 }));

    const result = await commitGitHubFilesAndCreatePullRequestForRequest(
      makeRequest({
        "x-ms-client-principal-id": "principal-123",
        cookie,
        host: "kickstart.test",
        "x-forwarded-proto": "https",
      }),
      {
        owner: "sabbour",
        repo: "demo-app",
        head: "feature/kickstart",
        base: "main",
        title: "feat: add artifacts",
        body: "Please review the generated files.",
        commitMessage: "feat: add artifacts",
        files: [
          { path: "Dockerfile", content: "FROM node:20" },
          { path: ".github/workflows/deploy.yml", content: "name: deploy" },
        ],
      },
    );

    expect(result).toMatchObject({
      commitSha: "commit-new",
      committedFilesCount: 2,
      headBranch: "feature/kickstart",
      baseBranch: "main",
      pullRequest: {
        number: 42,
        html_url: "https://github.com/sabbour/demo-app/pull/42",
      },
    });

    const treeCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/git/trees"));
    expect(treeCall).toBeDefined();
    const treeBody = JSON.parse(String(treeCall?.[1]?.body));
    expect(treeBody).toEqual({
      base_tree: "tree-base",
      tree: [
        {
          path: "Dockerfile",
          mode: "100644",
          type: "blob",
          content: "FROM node:20",
        },
        {
          path: ".github/workflows/deploy.yml",
          mode: "100644",
          type: "blob",
          content: "name: deploy",
        },
      ],
    });

    const githubAuthHeaders = fetchMock.mock.calls
      .filter(([url]) => {
        const parsed = new URL(String(url));
        return parsed.origin === "https://api.github.com";
      })
      .map(([, init]) => new Headers(init?.headers).get("authorization"));
    expect(githubAuthHeaders.length).toBeGreaterThan(0);
    expect(githubAuthHeaders.every((value) => value === "Bearer ghs_test_token")).toBe(true);
  });

  it("rejects protected branch writes before any GitHub API call", async () => {
    await expect(
      commitGitHubFilesAndCreatePullRequestForRequest(
        makeRequest(),
        {
          owner: "sabbour",
          repo: "demo-app",
          head: "main",
          title: "feat: add artifacts",
          files: [{ path: "Dockerfile", content: "FROM node:20" }],
        },
      ),
    ).rejects.toMatchObject({
      name: "GitHubAuthError",
      status: 400,
      message: 'Cannot commit directly to protected branch "main".',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GITHUB_BASE_URL override (getPublicOrigin)", () => {
  const ORIGINAL_BASE_URL = process.env.GITHUB_BASE_URL;

  beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = "client-id";
    process.env.GITHUB_CLIENT_SECRET = "client-secret";
    process.env.GITHUB_SESSION_SECRET = "session-secret";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.clientId;
    process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.clientSecret;
    process.env.GITHUB_SESSION_SECRET = ORIGINAL_ENV.sessionSecret;
    if (ORIGINAL_BASE_URL === undefined) {
      delete process.env.GITHUB_BASE_URL;
    } else {
      process.env.GITHUB_BASE_URL = ORIGINAL_BASE_URL;
    }
  });

  function extractRedirectUri(location: string): string {
    return new URL(location).searchParams.get("redirect_uri") ?? "";
  }

  it("uses clean https origin when GITHUB_BASE_URL is a plain origin", () => {
    process.env.GITHUB_BASE_URL = "https://kickstart.aks.azure.sabbour.me";
    const { location } = getGitHubAuthLogin(
      makeRequest({}, "https://internal.azurestaticapps.net/api/github-auth/login"),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.aks.azure.sabbour.me/api/github-auth/callback",
    );
  });

  it("strips path from GITHUB_BASE_URL — only origin is used", () => {
    process.env.GITHUB_BASE_URL = "https://kickstart.aks.azure.sabbour.me/some/path?q=1";
    const { location } = getGitHubAuthLogin(
      makeRequest({}, "https://internal.azurestaticapps.net/api/github-auth/login"),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.aks.azure.sabbour.me/api/github-auth/callback",
    );
  });

  it("strips trailing slash from GITHUB_BASE_URL — only origin is used", () => {
    process.env.GITHUB_BASE_URL = "https://kickstart.aks.azure.sabbour.me/";
    const { location } = getGitHubAuthLogin(
      makeRequest({}, "https://internal.azurestaticapps.net/api/github-auth/login"),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.aks.azure.sabbour.me/api/github-auth/callback",
    );
  });

  it("throws a clear 500 error when GITHUB_BASE_URL has a non-http/https protocol", () => {
    process.env.GITHUB_BASE_URL = "ftp://kickstart.example.com";
    expect(() =>
      getGitHubAuthLogin(
        makeRequest({}, "https://internal.azurestaticapps.net/api/github-auth/login"),
        "principal-1",
        "/",
      ),
    ).toThrow('GITHUB_BASE_URL must use http or https protocol (got "ftp:")');
  });

  it("throws a clear 500 error when GITHUB_BASE_URL is not a valid URL", () => {
    process.env.GITHUB_BASE_URL = "not-a-url";
    expect(() =>
      getGitHubAuthLogin(
        makeRequest({}, "https://internal.azurestaticapps.net/api/github-auth/login"),
        "principal-1",
        "/",
      ),
    ).toThrow('GITHUB_BASE_URL is not a valid URL: "not-a-url"');
  });

  it("uses x-ms-original-url origin when GITHUB_BASE_URL is absent and x-forwarded-host is an internal hostname", () => {
    delete process.env.GITHUB_BASE_URL;
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-ms-original-url": "https://kickstart.azurestaticapps.net/api/github-auth/login",
          "x-forwarded-host": "internal-func.azurewebsites.net",
          "x-forwarded-proto": "https",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.azurestaticapps.net/api/github-auth/callback",
    );
  });

  it("prefers GITHUB_BASE_URL over x-ms-original-url", () => {
    process.env.GITHUB_BASE_URL = "https://my-custom-domain.example.com";
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-ms-original-url": "https://kickstart.azurestaticapps.net/api/github-auth/login",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://my-custom-domain.example.com/api/github-auth/callback",
    );
  });

  it("falls back to x-forwarded-host when x-ms-original-url is absent", () => {
    delete process.env.GITHUB_BASE_URL;
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-forwarded-host": "kickstart.azurestaticapps.net",
          "x-forwarded-proto": "https",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.azurestaticapps.net/api/github-auth/callback",
    );
  });

  it("silently skips a malformed x-ms-original-url and continues to x-forwarded-host", () => {
    delete process.env.GITHUB_BASE_URL;
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-ms-original-url": "not a url at all",
          "x-forwarded-host": "kickstart.azurestaticapps.net",
          "x-forwarded-proto": "https",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.azurestaticapps.net/api/github-auth/callback",
    );
  });
});

describe("GITHUB_ALLOWED_ORIGINS allowlist (getPublicOrigin)", () => {
  const ORIGINAL_BASE_URL = process.env.GITHUB_BASE_URL;
  const ORIGINAL_ALLOWED_ORIGINS = process.env.GITHUB_ALLOWED_ORIGINS;

  beforeEach(() => {
    process.env.GITHUB_CLIENT_ID = "client-id";
    process.env.GITHUB_CLIENT_SECRET = "client-secret";
    process.env.GITHUB_SESSION_SECRET = "session-secret";
    delete process.env.GITHUB_BASE_URL;
    delete process.env.GITHUB_ALLOWED_ORIGINS;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env.GITHUB_CLIENT_ID = ORIGINAL_ENV.clientId;
    process.env.GITHUB_CLIENT_SECRET = ORIGINAL_ENV.clientSecret;
    process.env.GITHUB_SESSION_SECRET = ORIGINAL_ENV.sessionSecret;
    if (ORIGINAL_BASE_URL === undefined) {
      delete process.env.GITHUB_BASE_URL;
    } else {
      process.env.GITHUB_BASE_URL = ORIGINAL_BASE_URL;
    }
    if (ORIGINAL_ALLOWED_ORIGINS === undefined) {
      delete process.env.GITHUB_ALLOWED_ORIGINS;
    } else {
      process.env.GITHUB_ALLOWED_ORIGINS = ORIGINAL_ALLOWED_ORIGINS;
    }
  });

  function extractRedirectUri(location: string): string {
    return new URL(location).searchParams.get("redirect_uri") ?? "";
  }

  it("allows x-ms-original-url origin when it is in the allowlist", () => {
    process.env.GITHUB_ALLOWED_ORIGINS = "https://kickstart.azurestaticapps.net,https://kickstart.example.com";
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-ms-original-url": "https://kickstart.azurestaticapps.net/api/github-auth/login",
          "x-forwarded-host": "internal-func.azurewebsites.net",
          "x-forwarded-proto": "https",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.azurestaticapps.net/api/github-auth/callback",
    );
  });

  it("throws a 500 when x-ms-original-url origin is not in the allowlist", () => {
    process.env.GITHUB_ALLOWED_ORIGINS = "https://legit-app.example.com";
    expect(() =>
      getGitHubAuthLogin(
        makeRequest(
          {
            "x-ms-original-url": "https://attacker.evil.com/api/github-auth/login",
            "x-forwarded-host": "internal-func.azurewebsites.net",
            "x-forwarded-proto": "https",
          },
          "https://internal-func.azurewebsites.net/api/github-auth/login",
        ),
        "principal-1",
        "/",
      ),
    ).toThrow('x-ms-original-url origin "https://attacker.evil.com" is not in GITHUB_ALLOWED_ORIGINS');
  });

  it("warns but allows through when GITHUB_ALLOWED_ORIGINS is not set", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { location } = getGitHubAuthLogin(
      makeRequest(
        {
          "x-ms-original-url": "https://kickstart.azurestaticapps.net/api/github-auth/login",
          "x-forwarded-host": "internal-func.azurewebsites.net",
          "x-forwarded-proto": "https",
        },
        "https://internal-func.azurewebsites.net/api/github-auth/login",
      ),
      "principal-1",
      "/",
    );
    expect(extractRedirectUri(location)).toBe(
      "https://kickstart.azurestaticapps.net/api/github-auth/callback",
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("GITHUB_ALLOWED_ORIGINS is not set"));
  });

  it("blocks a second allowlist entry from being used when the header carries a disallowed origin", () => {
    process.env.GITHUB_ALLOWED_ORIGINS = "https://kickstart.azurestaticapps.net";
    expect(() =>
      getGitHubAuthLogin(
        makeRequest(
          {
            "x-ms-original-url": "https://other-app.azurestaticapps.net/api/github-auth/login",
          },
          "https://internal-func.azurewebsites.net/api/github-auth/login",
        ),
        "principal-1",
        "/",
      ),
    ).toThrow('x-ms-original-url origin "https://other-app.azurestaticapps.net" is not in GITHUB_ALLOWED_ORIGINS');
  });
});
