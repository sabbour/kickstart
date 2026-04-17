/**
 * @module @kickstart/core/engine/skill-vocabulary
 *
 * Canonical keyword and regex vocabulary for skill-injection mechanisms.
 *
 * Single source of truth for domain term sets used by:
 *   - Mechanism A (`skill-resolver.ts`): substring arrays classify kit prompt
 *     text to conversation phases via `.includes()`.
 *   - Mechanism B (`resolveConversationSkills.ts`): regex arrays detect domains
 *     from user messages via `.test()`.
 *
 * Each domain exports:
 *   - `XXX_KEYWORDS`  — readonly string tuple for Mechanism A
 *   - `XXX_PATTERNS`  — RegExp[] for Mechanism B
 *   - `isXxxRelated(text)` — boolean helper wrapping the regex array
 */

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

/** Substring keywords for Docker-related kit prompts (Mechanism A). */
export const DOCKER_KEYWORDS = [
  "dockerfile", "container", "multi-stage", "docker",
] as const;

/** Regex patterns for Docker-related user messages (Mechanism B). */
export const DOCKER_PATTERNS: RegExp[] = [
  /\bdocker(file)?\b/i,
  /\bcontainer\b/i,
  /\bimage\b.*\btag\b/i,
  /\bmulti.?stage\b/i,
];

/** Returns true if `text` contains Docker-related terminology. */
export function isDockerRelated(text: string): boolean {
  return DOCKER_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// AKS / Kubernetes
// ---------------------------------------------------------------------------

/** Substring keywords for AKS/Kubernetes-related kit prompts (Mechanism A). */
export const AKS_KEYWORDS = [
  "aks", "kubernetes", "k8s", "helm", "manifest", "bicep",
  "workload identity", "gateway api",
] as const;

/** Regex patterns for AKS/Kubernetes-related user messages (Mechanism B). */
export const AKS_PATTERNS: RegExp[] = [
  /\baks\b/i,
  /\bkubernetes\b/i,
  /\bk8s\b/i,
  /\bhelm\b/i,
  /\bmanifest\b/i,
  /\bbicep\b/i,
  /\bworkload identity\b/i,
  /\bgateway api\b/i,
];

/** Returns true if `text` contains AKS/Kubernetes-related terminology. */
export function isAKSRelated(text: string): boolean {
  return AKS_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// CI/CD
// ---------------------------------------------------------------------------

/** Substring keywords for CI/CD-related kit prompts (Mechanism A). */
export const CICD_KEYWORDS = [
  "ci/cd", "pipeline", "workflow", "github actions",
] as const;

/** Regex patterns for CI/CD-related user messages (Mechanism B). */
export const CICD_PATTERNS: RegExp[] = [
  /\bci\/?cd\b/i,
  /\bgithub actions?\b/i,
  /\bpipeline\b/i,
  /\bbuild.*push\b/i,
  /\bdeploy.*workflow\b/i,
];

/** Returns true if `text` contains CI/CD-related terminology. */
export function isCICDRelated(text: string): boolean {
  return CICD_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Authentication / Identity
// ---------------------------------------------------------------------------

/** Substring keywords for auth/identity-related kit prompts (Mechanism A). */
export const AUTH_KEYWORDS = [
  "oidc", "credential", "managed identity", "token",
] as const;

/** Regex patterns for auth/identity-related user messages (Mechanism B). */
export const AUTH_PATTERNS: RegExp[] = [
  /\bauth(entication|orization)?\b/i,
  /\blogin\b/i,
  /\boauth\b/i,
  /\bjwt\b/i,
  /\bmsal\b/i,
  /\btoken\b/i,
  /\bmanaged identity\b/i,
  /\bentra\b/i,
];

/** Returns true if `text` contains authentication/identity-related terminology. */
export function isAuthRelated(text: string): boolean {
  return AUTH_PATTERNS.some((p) => p.test(text));
}

// ---------------------------------------------------------------------------
// Database / Relational persistence
// ---------------------------------------------------------------------------

/** Substring keywords for database-related kit prompts (Mechanism A). */
export const DATABASE_KEYWORDS = [
  "database", "sql", "postgres", "mysql",
] as const;

/** Regex patterns for relational-database-related user messages (Mechanism B). */
export const DATABASE_RELATIONAL_PATTERNS: RegExp[] = [
  /\bpostgres(ql)?\b/i,
  /\bmysql\b/i,
  /\bsql\b/i,
  /\bdatabase\b/i,
  /\bprisma\b/i,
  /\bsequelize\b/i,
  /\borm\b/i,
];

/** Returns true if `text` contains relational-database-related terminology. */
export function isDatabaseRelated(text: string): boolean {
  return DATABASE_RELATIONAL_PATTERNS.some((p) => p.test(text));
}
