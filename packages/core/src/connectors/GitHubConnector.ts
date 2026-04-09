import type { APIConnector, APIConnectorRequestOptions } from './types.js';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commit: { sha: string; url: string };
}

export interface GitHubRepoOptions {
  private?: boolean;
  description?: string;
  auto_init?: boolean;
  gitignore_template?: string;
}

/**
 * Connector for the GitHub REST API.
 *
 * Auth: GitHub OAuth Device Flow (coming in B-14). For now, `authenticate()`
 * is a no-op and `isAuthenticated()` returns false.
 *
 * All methods return stub data so the app can build against real shapes.
 */
export class GitHubConnector implements APIConnector {
  readonly name = 'github';
  readonly baseUrl = 'https://api.github.com';

  private _token: string | null = null;

  async authenticate(): Promise<void> {
    // TODO (B-14): run GitHub OAuth Device Flow and store token
    // Stubbed — GitHub OAuth pending (B-14)
  }

  isAuthenticated(): boolean {
    return this._token !== null;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    options?: APIConnectorRequestOptions,
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(this._token ? { Authorization: `Bearer ${this._token}` } : {}),
      ...options?.headers,
    };

    return fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: options?.signal,
    });
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /** Get metadata for a repository. Returns stub data when not authenticated. */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    if (!this.isAuthenticated()) {
      return { ...STUB_REPO, name: repo, full_name: `${owner}/${repo}` };
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}`);
    return res.json();
  }

  /**
   * Create a new repository in the authenticated user's account.
   * Returns stub data when not authenticated.
   */
  async createRepo(name: string, options: GitHubRepoOptions = {}): Promise<GitHubRepo> {
    if (!this.isAuthenticated()) {
      return { ...STUB_REPO, name, full_name: `stub-user/${name}` };
    }

    const res = await this.request('POST', '/user/repos', { name, ...options });
    return res.json();
  }

  /** List branches for a repository. Returns stub data when not authenticated. */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    if (!this.isAuthenticated()) {
      return STUB_BRANCHES;
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}/branches`);
    return res.json();
  }
}

// ── Stub data ─────────────────────────────────────────────────────────────────

const STUB_REPO: GitHubRepo = {
  id: 123456789,
  name: 'my-app',
  full_name: 'stub-user/my-app',
  private: false,
  html_url: 'https://github.com/stub-user/my-app',
  description: 'Stub repository for local development',
  default_branch: 'main',
  language: 'TypeScript',
};

const STUB_BRANCHES: GitHubBranch[] = [
  {
    name: 'main',
    protected: true,
    commit: { sha: 'abc123', url: 'https://api.github.com/repos/stub-user/my-app/commits/abc123' },
  },
  {
    name: 'develop',
    protected: false,
    commit: { sha: 'def456', url: 'https://api.github.com/repos/stub-user/my-app/commits/def456' },
  },
];
