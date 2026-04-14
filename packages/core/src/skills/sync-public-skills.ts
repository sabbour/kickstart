/**
 * @module @kickstart/core/skills/sync-public-skills
 *
 * Build-time CLI pipeline for fetching, validating, and bundling
 * public Copilot skills into a committed lockfile.
 *
 * ## Security Model (Zapp-approved)
 *
 * 1. SHA-only immutable pinning (no branches/tags)
 * 2. Commit signature verification via GitHub API
 * 3. Trusted org allowlist
 * 4. Policy scanning (reject directives, executables, oversized)
 * 5. Structured JSON output (no raw markdown in prompts)
 * 6. Fail-closed: any error aborts entire sync
 * 7. Content hashing for drift detection
 *
 * This module is ONLY used at build time. It is NOT imported by the
 * runtime skill loader.
 *
 * Uses standard Web APIs (fetch, crypto.subtle) — works in both
 * Node.js 20+ and browser environments.
 */

import type {
  PublicSkillsConfig,
  PublicSkillSource,
  PublicSkillsLockfile,
  LockfileSourceEntry,
  LockfileSkillEntry,
  SkillProvenance,
  PolicyViolation,
} from './types.js';
import {
  SHA_PATTERN,
  MAX_SKILL_FILE_SIZE,
  MAX_SKILLS_PER_REPO,
  FETCH_TIMEOUT_MS,
  FETCH_MAX_RETRIES,
  POLICY_VERSION,
} from './types.js';
import { parseSkillMd } from './frontmatter-parser.js';
import { scanSkillPolicy, hasErrors, stripHtmlInjection } from './skill-policy.js';
import { classifyToPhases, extractKeywords } from './phase-mapper.js';
import { extractKnowledgeFacts, extractQuestionPatterns } from './knowledge-extractor.js';

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Result of a sync operation.
 */
export interface SyncResult {
  success: boolean;
  lockfile?: PublicSkillsLockfile;
  errors: string[];
}

/**
 * Execute the full sync pipeline for all configured sources.
 * Fail-closed: if ANY source fails, the entire sync fails.
 */
export async function syncPublicSkills(
  config: PublicSkillsConfig,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<SyncResult> {
  const errors: string[] = [];

  // Validate config
  const configErrors = validateConfig(config);
  if (configErrors.length > 0) {
    return { success: false, errors: configErrors };
  }

  const sources: LockfileSourceEntry[] = [];
  const now = new Date().toISOString();

  for (const source of config.sources) {
    try {
      const result = await syncSource(source, config.trustedOrgs, now, fetchFn);
      sources.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${source.repo}] ${msg}`);
    }
  }

  // Fail-closed: any error means no lockfile output
  if (errors.length > 0) {
    return { success: false, errors };
  }

  const lockfile: PublicSkillsLockfile = {
    version: 1,
    policyVersion: POLICY_VERSION,
    generatedAt: now,
    sources,
  };

  return { success: true, lockfile, errors: [] };
}

// ── Config validation ───────────────────────────────────────────────────────

export function validateConfig(config: PublicSkillsConfig): string[] {
  const errors: string[] = [];

  if (!config.trustedOrgs?.length) {
    errors.push('trustedOrgs must be a non-empty array');
  }

  if (!config.sources?.length) {
    errors.push('sources must be a non-empty array');
  }

  for (const source of config.sources ?? []) {
    if (!source.repo || !source.repo.includes('/')) {
      errors.push(`Invalid repo format: "${source.repo}" — must be owner/name`);
    }

    if (!SHA_PATTERN.test(source.sha)) {
      errors.push(
        `[${source.repo}] sha must be a full 40-char hex commit SHA, not a branch or tag. Got: "${source.sha}"`,
      );
    }

    // Validate org is trusted
    const org = source.repo.split('/')[0];
    if (config.trustedOrgs && !config.trustedOrgs.includes(org)) {
      errors.push(
        `[${source.repo}] Organization "${org}" is not in trustedOrgs: [${config.trustedOrgs.join(', ')}]`,
      );
    }
  }

  return errors;
}

// ── Per-source sync ─────────────────────────────────────────────────────────

async function syncSource(
  source: PublicSkillSource,
  trustedOrgs: string[],
  fetchedAt: string,
  fetchFn: typeof fetch,
): Promise<LockfileSourceEntry> {
  // 1. Verify commit signature via GitHub API
  const signatureVerified = await verifyCommitSignature(
    source.repo,
    source.sha,
    fetchFn,
  );

  if (!signatureVerified) {
    throw new Error(
      `Commit ${source.sha} on ${source.repo} is not signed or signature is not verified`,
    );
  }

  // 2. List skill directories
  const skillsPath = source.skillsPath ?? 'plugin/skills';
  const skillDirs = await listSkillDirectories(
    source.repo,
    source.sha,
    skillsPath,
    fetchFn,
  );

  // 3. Apply include/exclude filters
  let filteredDirs = skillDirs;
  if (source.include?.length) {
    filteredDirs = filteredDirs.filter((d) => source.include!.includes(d));
  }
  if (source.exclude?.length) {
    filteredDirs = filteredDirs.filter((d) => !source.exclude!.includes(d));
  }

  if (filteredDirs.length > MAX_SKILLS_PER_REPO) {
    throw new Error(
      `Repo ${source.repo} has ${filteredDirs.length} skills, exceeding limit of ${MAX_SKILLS_PER_REPO}`,
    );
  }

  // 4. Fetch and process each skill
  const skills: LockfileSkillEntry[] = [];

  for (const dir of filteredDirs) {
    const skillPath = `${skillsPath}/${dir}/SKILL.md`;
    const entry = await processSkill(
      source,
      skillPath,
      dir,
      fetchedAt,
      signatureVerified,
      fetchFn,
    );
    skills.push(entry);
  }

  return {
    repo: source.repo,
    sha: source.sha,
    fetchedAt,
    signatureVerified,
    skills,
  };
}

// ── Skill processing ────────────────────────────────────────────────────────

async function processSkill(
  source: PublicSkillSource,
  skillPath: string,
  dirName: string,
  fetchedAt: string,
  signatureVerified: boolean,
  fetchFn: typeof fetch,
): Promise<LockfileSkillEntry> {
  // Fetch raw SKILL.md content
  const raw = await fetchFileContent(
    source.repo,
    source.sha,
    skillPath,
    fetchFn,
  );

  // Size check (pre-parse safety net)
  const rawSize = new TextEncoder().encode(raw).length;
  if (rawSize > MAX_SKILL_FILE_SIZE) {
    throw new Error(
      `${skillPath}: file size ${rawSize} bytes exceeds limit of ${MAX_SKILL_FILE_SIZE}`,
    );
  }

  // Parse frontmatter + body
  const parsed = parseSkillMd(raw);

  // Policy scan
  const violations = scanSkillPolicy(parsed.body, rawSize);
  if (hasErrors(violations)) {
    const errorMsgs = violations
      .filter((v) => v.severity === 'error')
      .map((v) => `  - [${v.rule}] ${v.message}`);
    throw new Error(
      `${skillPath}: policy violations:\n${errorMsgs.join('\n')}`,
    );
  }

  // Strip HTML warnings (content is cleaned, not rejected)
  const cleanedBody = stripHtmlInjection(parsed.body);

  // Extract structured knowledge
  const knowledgeFacts = extractKnowledgeFacts(cleanedBody);
  const questionPatterns = extractQuestionPatterns(parsed.frontmatter, cleanedBody);

  // Content hash (using Web Crypto API)
  const contentHash = await sha256Hex(raw);

  // Phase mapping (from config override or auto-classification)
  const repoPrefix = source.repo.split('/').pop()?.replace(/^github-copilot-for-/, '') ?? 'ext';
  const skillId = `${repoPrefix}:${parsed.frontmatter.name}`;

  const phases = source.phaseOverrides?.[dirName]
    ?? classifyToPhases(parsed.frontmatter.description ?? parsed.frontmatter.name);

  const keywords = extractKeywords(
    `${parsed.frontmatter.name} ${parsed.frontmatter.description ?? ''}`,
  );

  const provenance: SkillProvenance = {
    repo: source.repo,
    sha: source.sha,
    path: skillPath,
    fetchedAt,
    contentHash,
    policyVersion: POLICY_VERSION,
    signatureVerified,
  };

  return {
    skillId,
    displayName: titleCase(parsed.frontmatter.name),
    domain: repoPrefix,
    knowledgeFacts,
    supportedQuestionPatterns: questionPatterns,
    phases,
    keywords,
    provenance,
  };
}

// ── GitHub API helpers ──────────────────────────────────────────────────────

async function verifyCommitSignature(
  repo: string,
  sha: string,
  fetchFn: typeof fetch,
): Promise<boolean> {
  const url = `https://api.github.com/repos/${repo}/commits/${sha}`;
  const response = await fetchWithRetry(url, fetchFn);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch commit ${sha} from ${repo}: HTTP ${response.status}`,
    );
  }

  const data = (await response.json()) as {
    commit?: { verification?: { verified?: boolean; reason?: string } };
  };

  const verification = data.commit?.verification;
  return verification?.verified === true && verification?.reason === 'valid';
}

async function listSkillDirectories(
  repo: string,
  sha: string,
  skillsPath: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  const url = `https://api.github.com/repos/${repo}/contents/${skillsPath}?ref=${sha}`;
  const response = await fetchWithRetry(url, fetchFn);

  if (!response.ok) {
    throw new Error(
      `Failed to list skills directory ${skillsPath} from ${repo}: HTTP ${response.status}`,
    );
  }

  const items = (await response.json()) as Array<{ name: string; type: string }>;
  return items.filter((i) => i.type === 'dir').map((i) => i.name);
}

async function fetchFileContent(
  repo: string,
  sha: string,
  path: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const url = `https://api.github.com/repos/${repo}/contents/${path}?ref=${sha}`;
  const response = await fetchWithRetry(url, fetchFn);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path} from ${repo}: HTTP ${response.status}`);
  }

  const data = (await response.json()) as { content?: string; encoding?: string };

  if (data.encoding === 'base64' && data.content) {
    return atob(data.content.replace(/\s/g, ''));
  }

  throw new Error(`Unexpected encoding for ${path}: ${data.encoding}`);
}

async function fetchWithRetry(
  url: string,
  fetchFn: typeof fetch,
  retries = FETCH_MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const response = await fetchFn(url, {
          signal: controller.signal,
          headers: {
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'kickstart-public-skill-sync',
          },
        });
        return response;
      } finally {
        clearTimeout(timeout);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < retries) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw new Error(
    `Failed to fetch ${url} after ${retries + 1} attempts: ${lastError?.message}`,
  );
}

// ── Utilities ───────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** SHA-256 hash of a string, returned as hex. Uses Web Crypto API. */
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
