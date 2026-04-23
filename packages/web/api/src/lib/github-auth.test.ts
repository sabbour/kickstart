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
