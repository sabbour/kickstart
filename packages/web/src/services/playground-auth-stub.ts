import type { AzureSubscription, GitHubRepo } from "@kickstart/core";
import type { AzureAuthSessionState } from "./azure-auth";
import type { GitHubSessionState, GitHubOwnerSummary, GitHubViewerSummary } from "./github-handoff";
import { isPlaygroundMode } from "./mock-streaming";

const AZURE_STUB_SUBSCRIPTIONS: AzureSubscription[] = [
  {
    subscriptionId: "00000000-0000-0000-0000-000000000001",
    displayName: "Kickstart Dev Subscription",
    state: "Enabled",
    tenantId: "00000000-0000-0000-0000-000000000099",
  },
];

const GITHUB_STUB_VIEWER: GitHubViewerSummary = {
  login: "stub-user",
  name: "Stub User",
  avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
  htmlUrl: "https://github.com/stub-user",
};

const GITHUB_STUB_OWNERS: GitHubOwnerSummary[] = [
  {
    login: GITHUB_STUB_VIEWER.login,
    type: "User",
    label: GITHUB_STUB_VIEWER.login,
    avatarUrl: GITHUB_STUB_VIEWER.avatarUrl,
    htmlUrl: GITHUB_STUB_VIEWER.htmlUrl,
  },
];

const GITHUB_STUB_REPOS: GitHubRepo[] = [
  {
    id: 9001,
    name: "my-web-app",
    full_name: "stub-user/my-web-app",
    private: false,
    html_url: "https://github.com/stub-user/my-web-app",
    description: "Demo repository surfaced by Playground stub mode.",
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 42,
    updated_at: "2026-04-15T00:00:00.000Z",
  },
  {
    id: 9002,
    name: "kickstart-portal",
    full_name: "stub-user/kickstart-portal",
    private: true,
    html_url: "https://github.com/stub-user/kickstart-portal",
    description: "Private portal prototype used for offline Playground validation.",
    default_branch: "main",
    language: "JavaScript",
    stargazers_count: 7,
    updated_at: "2026-04-14T00:00:00.000Z",
  },
];

export const DEFAULT_GITHUB_STUB_OWNER = GITHUB_STUB_VIEWER.login;

export function shouldUsePlaygroundAuthStub(): boolean {
  return typeof window !== "undefined" && isPlaygroundMode();
}

export function createAzureStubSession(authenticated: boolean): AzureAuthSessionState {
  return {
    configured: true,
    authenticated,
    user: authenticated
      ? {
          name: "Azure User",
          username: "azure.user@kickstart.local",
          tenantId: AZURE_STUB_SUBSCRIPTIONS[0]?.tenantId,
        }
      : undefined,
    subscriptions: authenticated ? AZURE_STUB_SUBSCRIPTIONS : [],
  };
}

export function createGitHubStubSession(authenticated: boolean): GitHubSessionState {
  return {
    authenticated,
    configured: true,
    viewer: authenticated ? GITHUB_STUB_VIEWER : undefined,
    owners: authenticated ? GITHUB_STUB_OWNERS : [],
  };
}

export function listGitHubStubRepos(owner = DEFAULT_GITHUB_STUB_OWNER): GitHubRepo[] {
  return GITHUB_STUB_REPOS.map((repo) => ({
    ...repo,
    full_name: `${owner}/${repo.name}`,
    html_url: `https://github.com/${owner}/${repo.name}`,
  }));
}

export function createGitHubStubRepo(input: {
  owner?: string;
  name: string;
  description?: string;
  private?: boolean;
}): GitHubRepo {
  const owner = input.owner ?? DEFAULT_GITHUB_STUB_OWNER;
  const name = input.name.trim();

  return {
    id: Date.now(),
    name,
    full_name: `${owner}/${name}`,
    private: Boolean(input.private),
    html_url: `https://github.com/${owner}/${name}`,
    description: input.description?.trim() || null,
    default_branch: "main",
    language: "TypeScript",
    stargazers_count: 0,
    updated_at: new Date().toISOString(),
  };
}
