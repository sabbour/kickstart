import type { GitHubRepo } from "@kickstart/harness";
import { apiFetch } from "./api-client";

const AUTH_COMPLETE_EVENT = "kickstart:github-auth:complete";
const AUTH_ERROR_EVENT = "kickstart:github-auth:error";

export interface GitHubViewerSummary {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GitHubOwnerSummary {
  login: string;
  type: "User" | "Organization";
  label: string;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GitHubSessionState {
  authenticated: boolean;
  configured: boolean;
  viewer?: GitHubViewerSummary;
  owners: GitHubOwnerSummary[];
  error?: string;
}

export interface GitHubCreateRepoInput {
  owner: string;
  name: string;
  description?: string;
  private?: boolean;
}

function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function readErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
    return body.error;
  }

  return fallback;
}

async function readJsonOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw new Error(readErrorMessage(body, fallback));
  }
  return body as T;
}

export async function getGitHubSession(): Promise<GitHubSessionState> {
  const response = await apiFetch("/api/github-auth/session");
  return readJsonOrThrow<GitHubSessionState>(
    response,
    "Unable to load GitHub session state.",
  );
}

export function buildGitHubLoginUrl(returnTo = currentReturnTo()): string {
  return `/api/github-auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function signInWithGitHubPopup(): Promise<GitHubSessionState> {
  const loginUrl = buildGitHubLoginUrl();
  const popup = window.open(
    loginUrl,
    "kickstart-github-auth",
    "popup=yes,width=640,height=760,left=120,top=80",
  );

  if (!popup) {
    window.location.assign(loginUrl);
    return new Promise<GitHubSessionState>(() => undefined);
  }

  return new Promise<GitHubSessionState>((resolve, reject) => {
    let finished = false;

    const cleanup = () => {
      finished = true;
      window.clearInterval(closeWatcher);
      window.removeEventListener("message", handleMessage);
    };

    const closeWatcher = window.setInterval(() => {
      if (!finished && popup.closed) {
        cleanup();
        reject(new Error("GitHub sign-in was cancelled."));
      }
    }, 400);

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || typeof event.data !== "object" || !("type" in event.data)) return;

      if (event.data.type === AUTH_ERROR_EVENT) {
        cleanup();
        reject(new Error(typeof event.data.error === "string" ? event.data.error : "GitHub sign-in failed."));
        return;
      }

      if (event.data.type !== AUTH_COMPLETE_EVENT) {
        return;
      }

      cleanup();

      try {
        resolve(await getGitHubSession());
      } catch (error) {
        reject(error);
      }
    };

    window.addEventListener("message", handleMessage);
  });
}

export async function signOutGitHub(): Promise<void> {
  const response = await apiFetch("/api/github-auth/logout", { method: "POST" });
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => undefined);
    throw new Error(readErrorMessage(body, "Unable to sign out of GitHub."));
  }
}

export async function listGitHubRepos(
  owner: string,
  page = 1,
  perPage = 20,
): Promise<GitHubRepo[]> {
  const query = new URLSearchParams({
    owner,
    page: String(page),
    perPage: String(perPage),
  });

  const response = await apiFetch(`/api/github/repos?${query.toString()}`);
  const body = await readJsonOrThrow<{ repos: GitHubRepo[] }>(
    response,
    "Unable to load GitHub repositories.",
  );

  return body.repos;
}

export async function createGitHubRepo(input: GitHubCreateRepoInput): Promise<GitHubRepo> {
  const response = await apiFetch("/api/github/repos", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const body = await readJsonOrThrow<{ repo: GitHubRepo }>(
    response,
    "Unable to create the GitHub repository.",
  );

  return body.repo;
}
