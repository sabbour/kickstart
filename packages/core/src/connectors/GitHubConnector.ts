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
  stargazers_count?: number;
  updated_at?: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string | null;
}

export interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubPullRequest {
  number: number;
  html_url: string;
  title: string;
  state: string;
  head: { ref: string; sha: string };
  base: { ref: string };
}

export interface GitHubBranch {
  name: string;
  protected: boolean;
  commit: { sha: string; url: string };
}

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

export interface GitHubFileContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
  html_url: string;
}

export interface GitHubRepoOptions {
  private?: boolean;
  description?: string;
  auto_init?: boolean;
  gitignore_template?: string;
}

/**
 * Default GitHub OAuth scopes — read-only access.
 */
const DEFAULT_GITHUB_SCOPES = ['read:user'];

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
    if (this.isStubMode()) {
      return { ...STUB_REPO, name: repo, full_name: `${owner}/${repo}` };
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}`);
    return (await res.json()) as GitHubRepo;
  }

  async createRepo(name: string, options: GitHubRepoOptions = {}): Promise<GitHubRepo> {
    if (this.isStubMode()) {
      return { ...STUB_REPO, name, full_name: `stub-user/${name}` };
    }

    const res = await this.request('POST', '/user/repos', { name, ...options });
    return (await res.json()) as GitHubRepo;
  }

  /** List branches for a repository. Returns stub data when not authenticated. */
  async listBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    if (this.isStubMode()) {
      return STUB_BRANCHES;
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}/branches`);
    return (await res.json()) as GitHubBranch[];
  }

  /**
   * List repositories for the authenticated user.
   * Supports pagination via `page` and `perPage` parameters.
   * Returns stub data when not authenticated.
   */
  async listUserRepos(
    page = 1,
    perPage = 30,
    sort: 'updated' | 'full_name' | 'created' | 'pushed' = 'updated',
  ): Promise<GitHubRepo[]> {
    if (this.isStubMode()) {
      return STUB_REPOS;
    }

    const res = await this.request(
      'GET',
      `/user/repos?page=${page}&per_page=${perPage}&sort=${sort}&affiliation=owner,collaborator,organization_member`,
    );
    return (await res.json()) as GitHubRepo[];
  }

  /** Get the authenticated user's profile. Returns stub data when not authenticated. */
  async getAuthenticatedUser(): Promise<GitHubUser> {
    if (this.isStubMode()) {
      return STUB_USER;
    }

    const res = await this.request('GET', '/user');
    return (await res.json()) as GitHubUser;
  }

  /**
   * Get the full recursive file tree for a repository ref.
   * Returns stub data when not authenticated.
   */
  async getTree(owner: string, repo: string, ref = 'HEAD'): Promise<GitHubTree> {
    if (this.isStubMode()) {
      return STUB_TREE;
    }

    const res = await this.request('GET', `/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`);
    return (await res.json()) as GitHubTree;
  }

  /**
   * Read a single file's content from a repository.
   * The GitHub Contents API returns base64-encoded content for files ≤ 100 MB.
   * Returns the raw API response; callers decode base64.
   * Returns stub data when not authenticated.
   */
  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<GitHubFileContent> {
    if (this.isStubMode()) {
      return {
        name: path.split('/').pop() ?? path,
        path,
        sha: 'stub-sha',
        size: 42,
        type: 'file',
        content: btoa('# stub file content'),
        encoding: 'base64',
        html_url: `https://github.com/${owner}/${repo}/blob/main/${path}`,
      };
    }

    const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
    const res = await this.request(
      'GET',
      `/repos/${owner}/${repo}/contents/${path}${query}`,
    );
    return (await res.json()) as GitHubFileContent;
  }

  /**
   * Create a pull request on a repository.
   * Returns stub data when not authenticated.
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string,
  ): Promise<GitHubPullRequest> {
    if (this.isStubMode()) {
      return {
        number: 1,
        html_url: `https://github.com/${owner}/${repo}/pull/1`,
        title,
        state: 'open',
        head: { ref: head, sha: 'abc1234' },
        base: { ref: base },
      };
    }

    const res = await this.request('POST', `/repos/${owner}/${repo}/pulls`, {
      title,
      head,
      base,
      body,
    });
    return (await res.json()) as GitHubPullRequest;
  }
}

// ── Stub data ─────────────────────────────────────────────────────────────────

const STUB_USER: GitHubUser = {
  login: 'stub-user',
  avatar_url: 'https://avatars.githubusercontent.com/u/0',
  html_url: 'https://github.com/stub-user',
  name: 'Stub User',
};

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

const STUB_REPOS: GitHubRepo[] = [
  { ...STUB_REPO },
  {
    id: 123456790,
    name: 'api-service',
    full_name: 'stub-user/api-service',
    private: false,
    html_url: 'https://github.com/stub-user/api-service',
    description: 'REST API built with Node.js',
    default_branch: 'main',
    language: 'JavaScript',
    stargazers_count: 17,
    updated_at: '2026-03-28T08:30:00Z',
  },
  {
    id: 123456791,
    name: 'k8s-configs',
    full_name: 'stub-user/k8s-configs',
    private: true,
    html_url: 'https://github.com/stub-user/k8s-configs',
    description: 'Kubernetes manifests and Helm charts',
    default_branch: 'main',
    language: 'YAML',
    stargazers_count: 5,
    updated_at: '2026-04-05T16:45:00Z',
  },
];

const STUB_BRANCHES: GitHubBranch[] = [
  {
    name: 'main',
    protected: true,
    commit: {
      sha: 'abc123',
      url: 'https://api.github.com/repos/stub-user/my-app/commits/abc123',
    },
  },
  {
    name: 'develop',
    protected: false,
    commit: {
      sha: 'def456',
      url: 'https://api.github.com/repos/stub-user/my-app/commits/def456',
    },
  },
];

const STUB_TREE: GitHubTree = {
  sha: 'abc123',
  url: 'https://api.github.com/repos/stub-user/my-app/git/trees/abc123',
  tree: [
    { path: 'package.json', mode: '100644', type: 'blob', sha: 'a1', size: 512, url: '' },
    { path: 'Dockerfile', mode: '100644', type: 'blob', sha: 'a2', size: 256, url: '' },
    { path: 'src', mode: '040000', type: 'tree', sha: 'a3', url: '' },
    { path: 'src/index.ts', mode: '100644', type: 'blob', sha: 'a4', size: 1024, url: '' },
    { path: '.github/workflows/ci.yml', mode: '100644', type: 'blob', sha: 'a5', size: 384, url: '' },
  ],
  truncated: false,
};
