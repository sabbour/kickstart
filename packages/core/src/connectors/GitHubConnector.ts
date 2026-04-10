import type { ConnectorConfig } from './types.js';
import { BaseConnector } from './BaseConnector.js';

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
 * Default GitHub OAuth scopes.
 */
const DEFAULT_GITHUB_SCOPES = ['repo', 'read:user'];

/**
 * Connector for the GitHub REST API.
 *
 * Auth: OAuth2 via GitHub Device Flow or PAT (injected with `setTokenProvider()`).
 * When no token provider is set, domain methods return stub data so
 * the app can function offline during local development.
 */
export class GitHubConnector extends BaseConnector {
  readonly name = 'github';

  protected get defaultBaseUrl(): string {
    return 'https://api.github.com';
  }

  /**
   * Create a new GitHubConnector.
   * @param config - Optional connector config. Defaults to OAuth2 auth
   *                 with GitHub scopes if not specified.
   */
  constructor(config?: ConnectorConfig) {
    super(config ?? { auth: { kind: 'oauth2', scopes: DEFAULT_GITHUB_SCOPES } });
  }

  /** GitHub-specific headers (Accept, API version). */
  protected override defaultHeaders(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  // ── Domain methods ─────────────────────────────────────────────────────────

  /** Get metadata for a repository. Returns stub data when not authenticated. */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    if (!this.isAuthenticated()) {
      return { ...STUB_REPO, name: repo, full_name: `${owner}/${repo}` };
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}`);
    return (await res.json()) as GitHubRepo;
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
    return (await res.json()) as GitHubRepo;
  }

  /** List branches for a repository. Returns stub data when not authenticated. */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    if (!this.isAuthenticated()) {
      return STUB_BRANCHES;
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}/branches`);
    return (await res.json()) as GitHubBranch[];
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
