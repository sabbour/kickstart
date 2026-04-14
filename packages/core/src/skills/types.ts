/**
 * @module @kickstart/core/skills/types
 *
 * Types for public Copilot skill consumption.
 *
 * Public skills are fetched at **build time** from configured GitHub repos,
 * validated through a security pipeline, and stored as a committed lockfile.
 * At runtime, the loader reads only from the lockfile — zero network calls.
 */

import type { Phase } from '../engine/types.js';

// ── Config types ────────────────────────────────────────────────────────────

/**
 * Declares a public Copilot skill repository to consume.
 *
 * ## Security Model
 * - `sha` must be a full 40-char commit SHA (branches/tags rejected)
 * - `trustedOrgs` restricts which GitHub organizations are allowed
 * - Commit signature verification is mandatory
 */
export interface PublicSkillSource {
  /** GitHub repo in owner/name format, e.g. "microsoft/github-copilot-for-azure" */
  repo: string;
  /** Full 40-char commit SHA — branches and tags are rejected */
  sha: string;
  /** Path to skills directory within the repo (default: "plugin/skills") */
  skillsPath?: string;
  /** Specific skill folders to include (default: all) */
  include?: string[];
  /** Skill folders to exclude */
  exclude?: string[];
  /** Phase mapping overrides (public skill name → Kickstart phases) */
  phaseOverrides?: Record<string, Phase[]>;
}

/**
 * Top-level public skills configuration.
 */
export interface PublicSkillsConfig {
  /** Allowed GitHub organizations for skill repos */
  trustedOrgs: string[];
  /** Skill sources to fetch at build time */
  sources: PublicSkillSource[];
}

// ── Provenance & metadata ───────────────────────────────────────────────────

/**
 * Full provenance chain for a public skill — stored on every skill object
 * for auditability and incident response.
 */
export interface SkillProvenance {
  /** Source repo, e.g. "microsoft/github-copilot-for-azure" */
  repo: string;
  /** Pinned commit SHA */
  sha: string;
  /** Path within the repo, e.g. "plugin/skills/azure-kubernetes/SKILL.md" */
  path: string;
  /** ISO-8601 timestamp when the skill was fetched */
  fetchedAt: string;
  /** SHA-256 hash of the raw SKILL.md body */
  contentHash: string;
  /** Version of the policy rules applied during sync */
  policyVersion: string;
  /** Whether the commit signature was verified */
  signatureVerified: boolean;
}

/**
 * Structured representation of a public skill's knowledge.
 * Raw markdown is **never** injected into the prompt — only this
 * constrained JSON structure is used.
 */
export interface SkillKnowledgeBlock {
  /** Skill ID with repo prefix, e.g. "ghca:azure-kubernetes" */
  skillId: string;
  /** Human-readable name from frontmatter */
  displayName: string;
  /** Domain area from frontmatter */
  domain: string;
  /** Extracted factual statements (declarative only, no imperatives) */
  knowledgeFacts: string[];
  /** Question patterns this skill can answer */
  supportedQuestionPatterns: string[];
  /** Full provenance chain */
  provenance: SkillProvenance;
}

// ── SKILL.md frontmatter ────────────────────────────────────────────────────

/**
 * Parsed YAML frontmatter from a public SKILL.md file.
 */
export interface SkillFrontmatter {
  name: string;
  description?: string;
  license?: string;
  metadata?: {
    author?: string;
    version?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Result of parsing a SKILL.md file — frontmatter + body separated.
 */
export interface ParsedSkillMd {
  frontmatter: SkillFrontmatter;
  body: string;
}

// ── Policy types ────────────────────────────────────────────────────────────

export type PolicySeverity = 'error' | 'warning';

/**
 * A single policy violation found during skill scanning.
 */
export interface PolicyViolation {
  /** Rule identifier */
  rule: string;
  /** Human-readable description */
  message: string;
  /** Severity — 'error' causes sync to fail */
  severity: PolicySeverity;
}

// ── Lockfile types ──────────────────────────────────────────────────────────

/**
 * A single skill entry in the lockfile.
 */
export interface LockfileSkillEntry {
  /** Skill ID with repo prefix */
  skillId: string;
  /** Human-readable display name */
  displayName: string;
  /** Domain area */
  domain: string;
  /** Extracted factual knowledge */
  knowledgeFacts: string[];
  /** Question patterns */
  supportedQuestionPatterns: string[];
  /** Kickstart phases this skill maps to */
  phases: Phase[];
  /** Activation keywords */
  keywords: string[];
  /** Full provenance metadata */
  provenance: SkillProvenance;
}

/**
 * Per-source entry in the lockfile.
 */
export interface LockfileSourceEntry {
  repo: string;
  sha: string;
  fetchedAt: string;
  signatureVerified: boolean;
  skills: LockfileSkillEntry[];
}

/**
 * The committed public-skills.lock.json file.
 */
export interface PublicSkillsLockfile {
  /** Schema version for forward compatibility */
  version: 1;
  /** Policy version applied during generation */
  policyVersion: string;
  /** ISO-8601 timestamp of lockfile generation */
  generatedAt: string;
  /** Per-source skill data */
  sources: LockfileSourceEntry[];
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum raw file size for a SKILL.md (bytes) */
export const MAX_SKILL_FILE_SIZE = 50 * 1024; // 50KB

/** Maximum token count for a SKILL.md body */
export const MAX_SKILL_TOKENS = 500;

/** Maximum number of skills per repo */
export const MAX_SKILLS_PER_REPO = 50;

/** Default priority for public skills (below first-party kit skills) */
export const PUBLIC_SKILL_PRIORITY = -5;

/** HTTP timeout for fetching from GitHub API (ms) */
export const FETCH_TIMEOUT_MS = 30_000;

/** Maximum HTTP retry count */
export const FETCH_MAX_RETRIES = 3;

/** Current policy version string */
export const POLICY_VERSION = '1.0.0';

/** Regex to validate a 40-char hex SHA */
export const SHA_PATTERN = /^[0-9a-f]{40}$/;
