import type { Cookie, HttpRequest } from "@azure/functions";
import type { GitHubRepo } from "@kickstart/core";
import { randomBytes } from "node:crypto";
import { getSwaPrincipalId, safeEqual, seal, unseal } from "./auth-state.js";

const FLOW_COOKIE_NAME = "kickstart-github-flow";
const SESSION_COOKIE_NAME = "kickstart-github-session";
const FLOW_TTL_S = 10 * 60;
const SESSION_TTL_S = 8 * 60 * 60;
const MAX_REPO_NAME_LENGTH = 100;
const GITHUB_API_BASE = "https://api.github.com";
const GITHUB_AUTH_BASE = "https://github.com";
const DEFAULT_GITHUB_SCOPES = "repo read:user read:org";

interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  redirectUri: string;
  scopes: string;
}

interface GitHubFlowCookie {
  principalId: string;
  returnTo: string;
  state: string;
  expiresAt: number;
}

interface GitHubSessionCookie {
  principalId: string;
  accessToken: string;
  expiresAt: number;
}

interface GitHubUserResponse {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

interface GitHubOrgResponse {
  login: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubTokenResponse {
  access_token?: string;
}

interface GitHubRepoResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  stargazers_count?: number;
  updated_at?: string;
}

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

export class GitHubAuthError extends Error {
  status: number;
  cookies: Cookie[];

  constructor(message: string, status = 400, cookies: Cookie[] = []) {
    super(message);
    this.name = "GitHubAuthError";
    this.status = status;
    this.cookies = cookies;
  }
}

function stripControlChars(value: string): string {
  return Array.from(value)
    .map((char) => (char === "\t" || char === "\n" || char === "\r" ? " " : char))
    .filter((char) => {
      const codePoint = char.codePointAt(0) ?? 0;
      return !(
        (codePoint >= 0x00 && codePoint <= 0x08)
        || codePoint === 0x0b
        || codePoint === 0x0c
        || (codePoint >= 0x0e && codePoint <= 0x1f)
        || (codePoint >= 0x7f && codePoint <= 0x9f)
      );
    })
    .join("")
    .replace(/ {2,}/g, " ")
    .trim();
}

function sanitizeMessage(value: string, fallback: string): string {
  const cleaned = stripControlChars(value).slice(0, 200);
  return cleaned || fallback;
}

function isSecureRequest(request: HttpRequest): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function getPublicOrigin(request: HttpRequest): string {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host");

  if (host) {
    return `${forwardedProto ?? "https"}://${host}`;
  }

  return new URL(request.url).origin;
}

function getGitHubConfig(request: HttpRequest): GitHubConfig {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const sessionSecret = (process.env.GITHUB_SESSION_SECRET?.trim() || clientSecret || "").trim();

  if (!clientId || !clientSecret || !sessionSecret) {
    throw new GitHubAuthError(
      "GitHub OAuth is not configured on the server.",
      503,
    );
  }

  return {
    clientId,
    clientSecret,
    sessionSecret,
    redirectUri: `${getPublicOrigin(request)}/api/github-auth/callback`,
    scopes: process.env.GITHUB_OAUTH_SCOPES?.trim() || DEFAULT_GITHUB_SCOPES,
  };
}

export function isGitHubConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_CLIENT_ID?.trim()
    && process.env.GITHUB_CLIENT_SECRET?.trim(),
  );
}

export function getGitHubPrincipalId(request: HttpRequest): string | null {
  return getSwaPrincipalId(request);
}

function getCookieValue(request: HttpRequest, name: string): string | null {
  const rawCookie = request.headers.get("cookie");
  if (!rawCookie) return null;

  for (const part of rawCookie.split(";")) {
    const [cookieName, ...rest] = part.trim().split("=");
    if (cookieName === name) {
      return rest.join("=") || "";
    }
  }

  return null;
}

function buildCookie(
  request: HttpRequest,
  name: string,
  value: string,
  maxAge: number,
): Cookie {
  return {
    name,
    value,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecureRequest(request),
    maxAge,
  };
}

function expireCookie(request: HttpRequest, name: string): Cookie {
  return buildCookie(request, name, "", 0);
}

function readFlowCookie(request: HttpRequest): GitHubFlowCookie | null {
  if (!isGitHubConfigured()) return null;

  const config = getGitHubConfig(request);
  const value = getCookieValue(request, FLOW_COOKIE_NAME);
  if (!value) return null;

  const flow = unseal<GitHubFlowCookie>(value, config.sessionSecret, FLOW_COOKIE_NAME);
  if (!flow || flow.expiresAt <= Date.now()) {
    return null;
  }

  return flow;
}

function readSessionCookie(request: HttpRequest, principalId: string): GitHubSessionCookie | null {
  if (!isGitHubConfigured()) return null;

  const config = getGitHubConfig(request);
  const value = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!value) return null;

  const session = unseal<GitHubSessionCookie>(value, config.sessionSecret, SESSION_COOKIE_NAME);
  if (!session || session.expiresAt <= Date.now()) {
    return null;
  }

  if (session.principalId !== principalId) {
    return null;
  }

  return session;
}

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";

  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/";
  }

  return trimmed;
}

async function githubJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/vnd.github+json");
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("User-Agent", "kickstart-github-handoff/1.0");
  headers.set("X-GitHub-Api-Version", "2022-11-28");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let message = `GitHub request failed (${response.status})`;
    try {
      const json = await response.json() as { message?: unknown };
      if (typeof json.message === "string") {
        message = sanitizeMessage(json.message, message);
      }
    } catch {
      // Ignore JSON parsing failures — the status code message is enough.
    }

    throw new GitHubAuthError(
      response.status === 401
        ? "GitHub sign-in expired. Please sign in again."
        : message,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

async function fetchViewerAndOwners(
  accessToken: string,
): Promise<{ viewer: GitHubViewerSummary; owners: GitHubOwnerSummary[] }> {
  const [user, orgs] = await Promise.all([
    githubJson<GitHubUserResponse>(accessToken, "/user"),
    githubJson<GitHubOrgResponse[]>(accessToken, "/user/orgs?per_page=100"),
  ]);

  const viewer: GitHubViewerSummary = {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
  };

  const owners: GitHubOwnerSummary[] = [
    {
      login: user.login,
      type: "User",
      label: `${user.login} (personal)`,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
    },
    ...orgs.map((org) => ({
      login: org.login,
      type: "Organization" as const,
      label: org.login,
      avatarUrl: org.avatar_url,
      htmlUrl: org.html_url,
    })),
  ];

  return { viewer, owners };
}

function mapRepo(repo: GitHubRepoResponse): GitHubRepo {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: repo.private,
    html_url: repo.html_url,
    description: repo.description,
    default_branch: repo.default_branch,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    updated_at: repo.updated_at,
  };
}

function validateRepoName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Repository name is required.";
  if (trimmed.length > MAX_REPO_NAME_LENGTH) {
    return `Repository name must be ${MAX_REPO_NAME_LENGTH} characters or fewer.`;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) {
    return "Repository name may only contain letters, numbers, '.', '_', and '-'.";
  }
  return null;
}

async function authorizeGitHubSession(request: HttpRequest): Promise<{
  accessToken: string;
  viewer: GitHubViewerSummary;
  owners: GitHubOwnerSummary[];
}> {
  if (!isGitHubConfigured()) {
    throw new GitHubAuthError("GitHub OAuth is not configured on the server.", 503);
  }

  const principalId = getGitHubPrincipalId(request);
  if (!principalId) {
    throw new GitHubAuthError(
      "Sign in to Kickstart before connecting GitHub.",
      403,
    );
  }

  const session = readSessionCookie(request, principalId);
  if (!session) {
    throw new GitHubAuthError("Sign in to GitHub to continue.", 403);
  }

  try {
    const { viewer, owners } = await fetchViewerAndOwners(session.accessToken);
    return { accessToken: session.accessToken, viewer, owners };
  } catch (error) {
    if (error instanceof GitHubAuthError && error.status === 401) {
      throw new GitHubAuthError(
        error.message,
        403,
        destroyGitHubAuthCookies(request),
      );
    }

    throw error;
  }
}

export function destroyGitHubAuthCookies(request: HttpRequest): Cookie[] {
  return [
    expireCookie(request, FLOW_COOKIE_NAME),
    expireCookie(request, SESSION_COOKIE_NAME),
  ];
}

export function getGitHubAuthLogin(
  request: HttpRequest,
  principalId: string,
  returnTo: string | null,
): { location: string; cookies: Cookie[] } {
  const config = getGitHubConfig(request);
  const state = randomBytes(24).toString("hex");
  const safeReturnTo = sanitizeReturnTo(returnTo);
  const flowCookie: GitHubFlowCookie = {
    principalId,
    returnTo: safeReturnTo,
    state,
    expiresAt: Date.now() + FLOW_TTL_S * 1000,
  };

  const location = new URL(`${GITHUB_AUTH_BASE}/login/oauth/authorize`);
  location.searchParams.set("client_id", config.clientId);
  location.searchParams.set("redirect_uri", config.redirectUri);
  location.searchParams.set("scope", config.scopes);
  location.searchParams.set("state", state);

  return {
    location: location.toString(),
    cookies: [
      buildCookie(
        request,
        FLOW_COOKIE_NAME,
        seal(flowCookie, config.sessionSecret, FLOW_COOKIE_NAME),
        FLOW_TTL_S,
      ),
    ],
  };
}

export async function completeGitHubAuth(
  request: HttpRequest,
  code: string | null,
  returnedState: string | null,
): Promise<{ cookies: Cookie[]; returnTo: string }> {
  const config = getGitHubConfig(request);
  const flow = readFlowCookie(request);
  const clearCookies = destroyGitHubAuthCookies(request);

  if (!flow || !returnedState || !safeEqual(flow.state, returnedState)) {
    throw new GitHubAuthError(
      "GitHub sign-in could not be verified. Please try again.",
      400,
      clearCookies,
    );
  }

  if (!code) {
    throw new GitHubAuthError(
      "GitHub did not return an authorization code.",
      400,
      clearCookies,
    );
  }

  try {
    const tokenResponse = await fetch(`${GITHUB_AUTH_BASE}/login/oauth/access_token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "kickstart-github-handoff/1.0",
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    const tokenBody = await tokenResponse.json() as GitHubTokenResponse;
    const accessToken = tokenBody.access_token?.trim();

    if (!tokenResponse.ok || !accessToken) {
      throw new GitHubAuthError(
        "GitHub sign-in failed while exchanging the authorization code.",
        502,
        clearCookies,
      );
    }

    await fetchViewerAndOwners(accessToken);
    const sessionCookie: GitHubSessionCookie = {
      principalId: flow.principalId,
      accessToken,
      expiresAt: Date.now() + SESSION_TTL_S * 1000,
    };

    return {
      cookies: [
        ...clearCookies,
        buildCookie(
          request,
          SESSION_COOKIE_NAME,
          seal(sessionCookie, config.sessionSecret, SESSION_COOKIE_NAME),
          SESSION_TTL_S,
        ),
      ],
      returnTo: flow.returnTo,
    };
  } catch (error) {
    if (error instanceof GitHubAuthError) {
      throw new GitHubAuthError(
        error.message,
        error.status,
        error.cookies.length > 0 ? error.cookies : clearCookies,
      );
    }

    throw new GitHubAuthError(
      "GitHub sign-in failed.",
      502,
      clearCookies,
    );
  }
}

export async function getGitHubSessionState(
  request: HttpRequest,
): Promise<{ state: GitHubSessionState; cookies: Cookie[] }> {
  if (!isGitHubConfigured()) {
    return {
      state: {
        authenticated: false,
        configured: false,
        owners: [],
        error: "GitHub OAuth is not configured on the server.",
      },
      cookies: [],
    };
  }

  const principalId = getGitHubPrincipalId(request);
  if (!principalId) {
    return {
      state: {
        authenticated: false,
        configured: true,
        owners: [],
        error: "Sign in to Kickstart before connecting GitHub.",
      },
      cookies: [],
    };
  }

  const session = readSessionCookie(request, principalId);
  if (!session) {
    return {
      state: {
        authenticated: false,
        configured: true,
        owners: [],
      },
      cookies: [],
    };
  }

  try {
    const { viewer, owners } = await fetchViewerAndOwners(session.accessToken);
    return {
      state: {
        authenticated: true,
        configured: true,
        viewer,
        owners,
      },
      cookies: [],
    };
  } catch (error) {
    if (error instanceof GitHubAuthError && error.status === 401) {
      return {
        state: {
          authenticated: false,
          configured: true,
          owners: [],
          error: error.message,
        },
        cookies: destroyGitHubAuthCookies(request),
      };
    }

    throw error;
  }
}

export async function listGitHubReposForRequest(
  request: HttpRequest,
  owner: string | null,
  page = 1,
  perPage = 20,
): Promise<{ repos: GitHubRepo[]; cookies: Cookie[] }> {
  const authorized = await authorizeGitHubSession(request);
  const selectedOwner = stripControlChars(owner || "").trim() || authorized.viewer.login;

  if (!authorized.owners.some((candidate) => candidate.login === selectedOwner)) {
    throw new GitHubAuthError("Selected GitHub owner is not available.", 400);
  }

  const safePage = Math.max(1, Math.trunc(page) || 1);
  const safePerPage = Math.min(100, Math.max(1, Math.trunc(perPage) || 20));
  const path = selectedOwner === authorized.viewer.login
    ? `/user/repos?page=${safePage}&per_page=${safePerPage}&sort=updated&affiliation=owner`
    : `/orgs/${encodeURIComponent(selectedOwner)}/repos?page=${safePage}&per_page=${safePerPage}&sort=updated&type=all`;

  const repos = await githubJson<GitHubRepoResponse[]>(
    authorized.accessToken,
    path,
  );

  return {
    repos: repos.map(mapRepo),
    cookies: [],
  };
}

export async function createGitHubRepoForRequest(
  request: HttpRequest,
  input: GitHubCreateRepoInput,
): Promise<{ repo: GitHubRepo; cookies: Cookie[] }> {
  const authorized = await authorizeGitHubSession(request);
  const owner = stripControlChars(input.owner || "").trim() || authorized.viewer.login;
  const repoNameError = validateRepoName(input.name || "");

  if (repoNameError) {
    throw new GitHubAuthError(repoNameError, 400);
  }

  if (!authorized.owners.some((candidate) => candidate.login === owner)) {
    throw new GitHubAuthError("Selected GitHub owner is not available.", 400);
  }

  const description = stripControlChars(input.description || "").slice(0, 200);
  const body = {
    name: input.name.trim(),
    private: Boolean(input.private),
    ...(description ? { description } : {}),
    auto_init: false,
  };

  const path = owner === authorized.viewer.login
    ? "/user/repos"
    : `/orgs/${encodeURIComponent(owner)}/repos`;

  const repo = await githubJson<GitHubRepoResponse>(
    authorized.accessToken,
    path,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );

  return {
    repo: mapRepo(repo),
    cookies: [],
  };
}
