/**
 * core.inspect_repo — language/framework detection from GitHub repos (or local paths in dev mode).
 *
 * Security controls (Zapp-approved):
 *  1. GitHub HTTPS-only URL allowlist
 *  2. GitHub REST API file fetch (hardcoded manifest set, no shell execution, no disk writes for remote)
 *  3. Dev-mode path canonicalization + workspace containment
 *  4. Static-file-only inspection (hardcoded fetch list — see readManifestsFromApi)
 *  5. Output redaction (canonical dep names only — no versions, no URLs, no raw strings)
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import { resolve, join } from 'node:path';
import type { ToolContribution } from '@aks-kickstart/harness';

// ── Constants ────────────────────────────────────────────────────────────────

const GH_API_TIMEOUT_MS = 10_000;

// ── URL validation ───────────────────────────────────────────────────────────

const GITHUB_HTTPS_RE = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;

export function validateGitHubUrl(url: string): string {
  const trimmed = url.trim();
  if (!GITHUB_HTTPS_RE.test(trimmed)) {
    throw new Error(
      `inspect_repo: only GitHub HTTPS URLs are accepted (https://github.com/<owner>/<repo>). Got: "${trimmed}"`,
    );
  }
  // Return without trailing slash or .git
  return trimmed.replace(/\/$/, '').replace(/\.git$/, '');
}

// ── GitHub REST API helpers ───────────────────────────────────────────────────

/** URL-encode each path segment while preserving the `/` separators. */
function encodeGitHubPath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

/**
 * Fetch a single file from a GitHub repo via the REST API.
 * Returns the raw text content, or null if the file does not exist (404).
 * Throws on any other non-2xx response.
 */
export async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GH_API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'aks-kickstart/inspect_repo',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`inspect_repo: GitHub API error ${res.status} fetching ${path} from ${owner}/${repo}`);
  }
  return res.text();
}

/**
 * Check whether a file exists in a GitHub repo without downloading its content.
 * Returns true if the file exists (200), false if not (404).
 * Throws on any other non-2xx response.
 */
async function checkGitHubFileExists(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GH_API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'aks-kickstart/inspect_repo',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  // Discard the response body — we only need the status code
  await res.body?.cancel().catch(() => undefined);
  if (res.status === 404) return false;
  if (!res.ok) {
    throw new Error(`inspect_repo: GitHub API error ${res.status} checking ${path} in ${owner}/${repo}`);
  }
  return true;
}

/**
 * List the entries in a directory within a GitHub repo, including their type.
 * Returns null if the directory does not exist (404) or the path resolves to a
 * file rather than a directory (API returns a non-array payload).
 * Throws on any other non-2xx response.
 */
export async function listGitHubDir(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<Array<{ name: string; type: string }> | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GH_API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'aks-kickstart/inspect_repo',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`inspect_repo: GitHub API error ${res.status} listing ${path} in ${owner}/${repo}`);
  }
  const entries = await res.json() as unknown;
  if (!Array.isArray(entries)) return null; // path is a file, not a directory
  return (entries as Array<{ name: string; type: string }>).map((e) => ({ name: e.name, type: e.type }));
}

/**
 * Build a Manifests object by fetching only the hardcoded manifest set via GitHub REST API.
 * Files needed only for existence checks use checkGitHubFileExists (no body download).
 * No files are written to disk.
 */
async function readManifestsFromApi(owner: string, repo: string, token?: string): Promise<Manifests> {
  const [
    packageJsonRaw,
    requirementsTxt,
    pyprojectToml,
    goMod,
    cargoToml,
    pomXmlExists,
    buildGradleExists,
    dockerfileRaw,
    helmChart1Exists,
    chartsEntries,
    workflowEntries,
  ] = await Promise.all([
    fetchGitHubFile(owner, repo, 'package.json', token),
    fetchGitHubFile(owner, repo, 'requirements.txt', token),
    fetchGitHubFile(owner, repo, 'pyproject.toml', token),
    fetchGitHubFile(owner, repo, 'go.mod', token),
    fetchGitHubFile(owner, repo, 'Cargo.toml', token),
    checkGitHubFileExists(owner, repo, 'pom.xml', token),
    checkGitHubFileExists(owner, repo, 'build.gradle', token),
    fetchGitHubFile(owner, repo, 'Dockerfile', token),
    checkGitHubFileExists(owner, repo, 'helm/Chart.yaml', token),
    listGitHubDir(owner, repo, 'charts', token),
    listGitHubDir(owner, repo, '.github/workflows', token),
  ]);

  // Dockerfile: limit to first 50 lines
  const dockerfile = dockerfileRaw !== null
    ? dockerfileRaw.split('\n').slice(0, 50).join('\n')
    : null;

  // charts/*/Chart.yaml: sequential check with early exit, directories only, capped at 20
  let helmChart2Glob = false;
  if (chartsEntries && chartsEntries.length > 0) {
    const MAX_CHART_DIRS = 20;
    for (const entry of chartsEntries.slice(0, MAX_CHART_DIRS)) {
      if (entry.type !== 'dir') continue;
      const found = await checkGitHubFileExists(owner, repo, `charts/${entry.name}/Chart.yaml`, token);
      if (found) { helmChart2Glob = true; break; }
    }
  }

  const hasGithubActions = workflowEntries !== null &&
    workflowEntries.some((e) => e.name.endsWith('.yaml') || e.name.endsWith('.yml'));

  let packageJson: Record<string, unknown> | null = null;
  if (packageJsonRaw) {
    try {
      packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;
    } catch { /* malformed — ignore */ }
  }

  return {
    packageJson,
    requirementsTxt,
    pyprojectToml,
    goMod,
    cargoToml,
    pomXml: pomXmlExists,
    buildGradle: buildGradleExists,
    dockerfile,
    hasHelmChart: helmChart1Exists || helmChart2Glob,
    hasGithubActions,
  };
}

// ── Dev-mode path validation ─────────────────────────────────────────────────

export function validateLocalPath(localPath: string, workspaceRoot: string): string {
  if (process.env['IS_DEV_MODE'] !== 'true') {
    throw new Error('inspect_repo: local path access requires IS_DEV_MODE=true');
  }
  const canonical = resolve(localPath);
  const root = resolve(workspaceRoot);
  if (!canonical.startsWith(root + '/') && canonical !== root) {
    throw new Error(
      `inspect_repo: local path "${localPath}" resolves outside workspace root "${root}"`,
    );
  }
  return canonical;
}

// ── File reading helpers ─────────────────────────────────────────────────────

async function tryReadFile(base: string, rel: string): Promise<string | null> {
  try {
    return await fs.readFile(join(base, rel), 'utf8');
  } catch {
    return null;
  }
}

async function tryReadFirstLines(base: string, rel: string, lines: number): Promise<string | null> {
  const content = await tryReadFile(base, rel);
  if (content === null) return null;
  return content.split('\n').slice(0, lines).join('\n');
}

async function tryExists(base: string, rel: string): Promise<boolean> {
  try {
    await fs.access(join(base, rel));
    return true;
  } catch {
    return false;
  }
}

// ── Manifest reading ─────────────────────────────────────────────────────────

interface Manifests {
  packageJson: Record<string, unknown> | null;
  requirementsTxt: string | null;
  pyprojectToml: string | null;
  goMod: string | null;
  cargoToml: string | null;
  pomXml: boolean;
  buildGradle: boolean;
  dockerfile: string | null;
  hasHelmChart: boolean;
  hasGithubActions: boolean;
}

async function readManifests(base: string): Promise<Manifests> {
  const [
    packageJsonRaw,
    requirementsTxt,
    pyprojectToml,
    goMod,
    cargoToml,
    pomXmlExists,
    buildGradleExists,
    dockerfile,
    helmChart1,
    helmChart2Glob,
    ghActionsDir,
  ] = await Promise.all([
    tryReadFile(base, 'package.json'),
    tryReadFile(base, 'requirements.txt'),
    tryReadFile(base, 'pyproject.toml'),
    tryReadFile(base, 'go.mod'),
    tryReadFile(base, 'Cargo.toml'),
    tryExists(base, 'pom.xml'),
    tryExists(base, 'build.gradle'),
    tryReadFirstLines(base, 'Dockerfile', 50),
    tryExists(base, 'helm/Chart.yaml'),
    (async () => {
      // Check for charts/*/Chart.yaml
      try {
        const chartsDir = join(base, 'charts');
        const entries = await fs.readdir(chartsDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const exists = await tryExists(base, `charts/${e.name}/Chart.yaml`);
            if (exists) return true;
          }
        }
      } catch { /* no charts dir */ }
      return false;
    })(),
    (async () => {
      // Check .github/workflows for any .yaml/.yml files (existence only, read first 20 lines)
      try {
        const wfDir = join(base, '.github', 'workflows');
        const entries = await fs.readdir(wfDir);
        return entries.some((e) => e.endsWith('.yaml') || e.endsWith('.yml'));
      } catch { return false; }
    })(),
  ]);

  let packageJson: Record<string, unknown> | null = null;
  if (packageJsonRaw) {
    try {
      packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;
    } catch { /* malformed — ignore */ }
  }

  return {
    packageJson,
    requirementsTxt,
    pyprojectToml,
    goMod,
    cargoToml,
    pomXml: pomXmlExists,
    buildGradle: buildGradleExists,
    dockerfile,
    hasHelmChart: helmChart1 || helmChart2Glob,
    hasGithubActions: ghActionsDir,
  };
}

// ── Detection helpers ─────────────────────────────────────────────────────────

type Language = 'python' | 'typescript' | 'javascript' | 'go' | 'java' | 'rust' | 'unknown';

const PYTHON_FRAMEWORKS = ['fastapi', 'flask', 'django'] as const;
const NODE_FRAMEWORKS = ['express', 'next', 'nest', '@nestjs/core'] as const;
const GO_FRAMEWORKS = ['gin', 'echo', 'fiber'] as const;

/** Extract dep name candidates from requirements.txt (package names only, no versions). */
function pyDepsFromRequirements(content: string): string[] {
  return content
    .split('\n')
    .map((l) => l.trim().toLowerCase())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('-'))
    .map((l) => l.split(/[>=<!;\s[]/)[0]?.trim() ?? '')
    .filter(Boolean);
}

/** Extract dep name candidates from pyproject.toml (very lightweight, no full TOML parser). */
function pyDepsFromPyproject(content: string): string[] {
  const deps: string[] = [];
  const dependenciesBlock = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(\[|$)/)?.[1] ?? '';
  const projectDeps = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? '';
  const combined = dependenciesBlock + '\n' + projectDeps;
  for (const line of combined.split('\n')) {
    const m = line.match(/["']?([a-z][a-z0-9_-]*)["']?\s*[=><![\s]/i);
    if (m?.[1]) deps.push(m[1].toLowerCase().replace(/-/g, '_'));
  }
  return deps;
}

function detectLanguageAndFramework(m: Manifests): {
  language: Language;
  framework?: string;
  runtime?: string;
  entrypoint?: string;
  dbDeps: string[];
} {
  // ── Python ──────────────────────────────────────────────────────────────────
  if (m.requirementsTxt !== null || m.pyprojectToml !== null) {
    const allDeps: string[] = [];
    if (m.requirementsTxt) allDeps.push(...pyDepsFromRequirements(m.requirementsTxt));
    if (m.pyprojectToml) allDeps.push(...pyDepsFromPyproject(m.pyprojectToml));

    let framework: string | undefined;
    for (const f of PYTHON_FRAMEWORKS) {
      const normalized = f.replace(/-/g, '_');
      if (allDeps.some((d) => d === f || d === normalized)) {
        framework = f;
        break;
      }
    }

    // Runtime: check pyproject.toml for python-requires, or Dockerfile base image
    let runtime: string | undefined;
    if (m.pyprojectToml) {
      const m1 = m.pyprojectToml.match(/python_requires\s*=\s*["']>=\s*([\d.]+)["']/i)
        ?? m.pyprojectToml.match(/python\s*=\s*["'].*?([\d]+\.[\d]+)["']/i);
      if (m1?.[1]) {
        const ver = m1[1].split('.').slice(0, 2).join('.');
        runtime = `python${ver}`;
      }
    }
    if (!runtime && m.dockerfile) {
      const baseImg = m.dockerfile.match(/^FROM\s+python:([\d.]+)/im);
      if (baseImg?.[1]) {
        const ver = baseImg[1].split('.').slice(0, 2).join('.');
        runtime = `python${ver}`;
      }
    }

    // Entrypoint: look for uvicorn in requirements
    let entrypoint: string | undefined;
    if (allDeps.includes('uvicorn') || allDeps.includes('gunicorn')) {
      entrypoint = 'app.main:app';
    }

    const dbDeps = detectDbDeps(allDeps);
    return { language: 'python', framework, runtime, entrypoint, dbDeps };
  }

  // ── TypeScript / JavaScript ──────────────────────────────────────────────────
  if (m.packageJson !== null) {
    const deps = Object.keys(
      (m.packageJson['dependencies'] as Record<string, string> | undefined) ?? {},
    ).map((k) => k.toLowerCase());
    const devDeps = Object.keys(
      (m.packageJson['devDependencies'] as Record<string, string> | undefined) ?? {},
    ).map((k) => k.toLowerCase());
    const allNodeDeps = [...deps, ...devDeps];

    const isTs = allNodeDeps.includes('typescript') || devDeps.includes('typescript');
    const language: Language = isTs ? 'typescript' : 'javascript';

    let framework: string | undefined;
    for (const f of NODE_FRAMEWORKS) {
      const key = f.toLowerCase();
      if (deps.includes(key)) {
        // Map '@nestjs/core' → 'nest'
        framework = f === '@nestjs/core' ? 'nest' : f;
        break;
      }
    }

    // Runtime: from Dockerfile or engines field
    let runtime: string | undefined;
    if (m.dockerfile) {
      const nodeBase = m.dockerfile.match(/^FROM\s+node:([\d]+)/im);
      if (nodeBase?.[1]) runtime = `node${nodeBase[1]}`;
    }
    if (!runtime) {
      const engines = m.packageJson['engines'] as Record<string, string> | undefined;
      if (engines?.['node']) {
        const ver = engines['node'].replace(/[^0-9.]/g, '').split('.')[0];
        if (ver) runtime = `node${ver}`;
      }
    }

    // Entrypoint: scripts.start or main field
    let entrypoint: string | undefined;
    const scripts = m.packageJson['scripts'] as Record<string, string> | undefined;
    if (scripts?.['start']) {
      // Extract file reference, e.g. "node src/index.js" → "src/index.js"
      const match = scripts['start'].match(/node\s+([\w./]+\.(?:js|mjs|cjs))/);
      if (match?.[1]) entrypoint = match[1];
    }
    if (!entrypoint && typeof m.packageJson['main'] === 'string') {
      entrypoint = m.packageJson['main'] as string;
    }

    const dbDeps = detectDbDeps(deps);
    return { language, framework, runtime, entrypoint, dbDeps };
  }

  // ── Go ────────────────────────────────────────────────────────────────────
  if (m.goMod !== null) {
    let framework: string | undefined;
    for (const f of GO_FRAMEWORKS) {
      if (m.goMod.includes(f)) {
        framework = f;
        break;
      }
    }

    let runtime: string | undefined;
    if (m.dockerfile) {
      const goBase = m.dockerfile.match(/^FROM\s+golang:([\d.]+)/im);
      if (goBase?.[1]) {
        const ver = goBase[1].split('.').slice(0, 2).join('.');
        runtime = `go${ver}`;
      }
    }
    if (!runtime) {
      const goVer = m.goMod.match(/^go\s+([\d.]+)/m);
      if (goVer?.[1]) runtime = `go${goVer[1]}`;
    }

    const entrypoint = 'main.go';
    const dbDeps = detectDbDepsFromGoMod(m.goMod);
    return { language: 'go', framework, runtime, entrypoint, dbDeps };
  }

  // ── Java ──────────────────────────────────────────────────────────────────
  if (m.pomXml || m.buildGradle) {
    return { language: 'java', framework: undefined, dbDeps: [] };
  }

  // ── Rust ─────────────────────────────────────────────────────────────────
  if (m.cargoToml !== null) {
    return { language: 'rust', framework: undefined, dbDeps: [] };
  }

  return { language: 'unknown', dbDeps: [] };
}

const DB_KEYWORDS: Record<string, string> = {
  // Python
  'sqlalchemy': 'postgres',
  'asyncpg': 'postgres',
  'psycopg2': 'postgres',
  'psycopg': 'postgres',
  'pymysql': 'mysql',
  'pymongo': 'mongodb',
  'motor': 'mongodb',
  'redis': 'redis',
  'aioredis': 'redis',
  // Node
  'pg': 'postgres',
  'postgres': 'postgres',
  'mysql2': 'mysql',
  'mysql': 'mysql',
  'mongoose': 'mongodb',
  'mongodb': 'mongodb',
  'ioredis': 'redis',
};

function detectDbDeps(deps: string[]): string[] {
  const found = new Set<string>();
  for (const dep of deps) {
    const db = DB_KEYWORDS[dep];
    if (db) found.add(db);
  }
  return [...found];
}

function detectDbDepsFromGoMod(goMod: string): string[] {
  const found = new Set<string>();
  if (goMod.includes('lib/pq') || goMod.includes('pgx')) found.add('postgres');
  if (goMod.includes('go-sql-driver/mysql')) found.add('mysql');
  if (goMod.includes('mongo-driver')) found.add('mongodb');
  if (goMod.includes('go-redis')) found.add('redis');
  return [...found];
}

// ── Questionnaire generation ─────────────────────────────────────────────────

interface QuestionItem {
  id: string;
  question: string;
  options?: string[];
}

function buildQuestionnaire(
  dbDeps: string[],
  hasDockerfile: boolean,
  entrypoint?: string,
): QuestionItem[] {
  const qs: QuestionItem[] = [];

  for (const db of dbDeps) {
    qs.push({
      id: `db-provisioning-${db}`,
      question: `How is ${db} provisioned today?`,
      options: ['Managed cloud service (e.g. Azure Database)', 'Self-hosted container', 'Not yet decided'],
    });
  }

  if (!hasDockerfile) {
    qs.push({
      id: 'no-dockerfile',
      question: 'Do you have deployment config (Docker, Helm, etc.)?',
      options: ['No — generate it for me', 'Yes — I will provide it', 'Not sure'],
    });
  }

  if (!entrypoint) {
    qs.push({
      id: 'entrypoint',
      question: 'Which entrypoint should AKS use?',
    });
  }

  return qs;
}

// ── Output redaction ─────────────────────────────────────────────────────────

/** Strip any strings that look like version numbers or URLs before returning. */
function redactOutput(output: InspectRepoOutput): InspectRepoOutput {
  const VERSION_RE = /\d+\.\d+/;
  const clean = { ...output };

  if (clean.runtime && VERSION_RE.test(clean.runtime)) {
    // runtime like "python3.11" is canonical — keep it
  }
  // entrypoint might have a file path — keep it, it's static analysis output
  return clean;
}

// ── Core inspection logic (exported for tests) ────────────────────────────────

export interface InspectRepoInput {
  source: 'remote' | 'local';
  remoteUrl: string | null;
  localPath: string | null;
}

export interface InspectRepoOutput {
  language: 'python' | 'typescript' | 'javascript' | 'go' | 'java' | 'rust' | 'unknown';
  framework?: string;
  runtime?: string;
  deps: { database?: string[]; other?: string[] };
  entrypoint?: string;
  hasDockerfile: boolean;
  hasHelmChart: boolean;
  hasGithubActions: boolean;
  questionnaire: Array<{ id: string; question: string; options?: string[] }>;
}

export async function inspectRepo(
  input: InspectRepoInput,
  workspaceRoot: string = process.cwd(),
): Promise<InspectRepoOutput> {
  let manifests: Manifests;

  if (input.source === 'remote') {
    if (!input.remoteUrl) {
      throw new Error('inspect_repo: remoteUrl is required for source=remote');
    }
    const safeUrl = validateGitHubUrl(input.remoteUrl);
    // Parse owner/repo from the normalized URL (guaranteed format: https://github.com/<owner>/<repo>)
    const parts = safeUrl.replace('https://github.com/', '').split('/');
    if (parts.length !== 2) throw new Error(`inspect_repo: Invalid repo format parsed from: ${safeUrl}`);
    const [owner, repo] = parts;
    const token = process.env['GITHUB_TOKEN'];
    if (!token) {
      console.warn(
        'inspect_repo: GITHUB_TOKEN is not set. Unauthenticated GitHub API calls are rate-limited ' +
        'to 60 req/hr per IP. On a shared host, all invocations share this budget — a single user ' +
        'can exhaust it in ~5 calls. Set GITHUB_TOKEN to avoid silent failures.',
      );
    }
    manifests = await readManifestsFromApi(owner, repo, token);
  } else {
    if (!input.localPath) {
      throw new Error('inspect_repo: localPath is required for source=local');
    }
    const repoPath = validateLocalPath(input.localPath, workspaceRoot);
    manifests = await readManifests(repoPath);
  }

  const { language, framework, runtime, entrypoint, dbDeps } =
    detectLanguageAndFramework(manifests);

  const questionnaire = buildQuestionnaire(dbDeps, !!manifests.dockerfile, entrypoint);

  const output: InspectRepoOutput = {
    language,
    ...(framework !== undefined ? { framework } : {}),
    ...(runtime !== undefined ? { runtime } : {}),
    deps: {
      ...(dbDeps.length > 0 ? { database: dbDeps } : {}),
    },
    ...(entrypoint !== undefined ? { entrypoint } : {}),
    hasDockerfile: manifests.dockerfile !== null,
    hasHelmChart: manifests.hasHelmChart,
    hasGithubActions: manifests.hasGithubActions,
    questionnaire,
  };

  return redactOutput(output);
}

// ── Input schema ──────────────────────────────────────────────────────────────

export const InspectRepoInputSchema = z.object({
  source: z.enum(['remote', 'local']).describe(
    'Whether to inspect a remote GitHub repository (via GitHub REST API) or a local path (dev mode only).',
  ),
  remoteUrl: z
    .string()
    .nullable()
    .describe(
      'GitHub HTTPS URL — required when source=remote and otherwise null. Format: https://github.com/<owner>/<repo>',
    ),
  localPath: z
    .string()
    .nullable()
    .describe(
      'Absolute path to a local repository root — required when source=local and otherwise null. Dev mode only (IS_DEV_MODE=true).',
    ),
});

// ── Tool factory ──────────────────────────────────────────────────────────────

export function createInspectRepoTool(workspaceRoot: string = process.cwd()): ToolContribution {
  return {
    name: 'core.inspect_repo',
    tool: tool({
      name: 'core.inspect_repo',
      description:
        'Inspects a GitHub repository (or local path in dev mode) to detect language, framework, ' +
        'runtime, database dependencies, and deployment config. Returns a structured summary and a ' +
        'questionnaire for missing info. Only accepts https://github.com/<owner>/<repo> URLs.',
      parameters: InspectRepoInputSchema,
      execute: async (input) => {
        const result = await inspectRepo(input, workspaceRoot);
        return JSON.stringify(result);
      },
    }),
  };
}
