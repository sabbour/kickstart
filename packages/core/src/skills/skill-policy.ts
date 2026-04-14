/**
 * @module @kickstart/core/skills/skill-policy
 *
 * Security policy scanner for public SKILL.md files.
 *
 * Runs at sync time (build) to reject unsafe content before it
 * enters the lockfile. Implements the Zapp-approved defense-in-depth
 * controls from the DP on issue #186.
 *
 * Policy rules:
 * - Imperative system directives → reject
 * - Executable code-fence patterns → reject
 * - HTML injection tags → strip + warn
 * - Token count > MAX → reject
 * - File size > MAX → reject
 */

import type { PolicyViolation } from './types.js';
import { MAX_SKILL_FILE_SIZE, MAX_SKILL_TOKENS, POLICY_VERSION } from './types.js';

export { POLICY_VERSION };

/** Patterns that indicate prompt-injection attempts (imperative directives). */
const DIRECTIVE_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\b/i,
  /override\s+(all\s+)?(system\s+)?rules/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /new\s+persona/i,
  /act\s+as\s+if\s+you\s+are/i,
  /from\s+now\s+on\s+you\s+are/i,
  /do\s+not\s+follow\s+(any\s+)?previous/i,
  /system\s*:\s*you\s+are/i,
];

/** Code-fence language tags that indicate executable content. */
const EXECUTABLE_FENCE_PATTERN =
  /```(?:bash|sh|shell|zsh|powershell|ps1|cmd|bat|python|py|ruby|rb|perl|php|javascript|js|typescript|ts|node|eval|exec)\b/i;

/** Inline executable patterns within code fences. */
const EXECUTABLE_INLINE_PATTERNS = [
  /\$\([^)]+\)/,           // $(command substitution)
  /\bcurl\s+-/i,           // curl with flags
  /\bwget\s+-/i,           // wget with flags
  /\bfetch\s*\(/i,         // fetch() calls
  /\bimport\s*\(/i,        // dynamic import
  /\brequire\s*\(/i,       // CommonJS require
  /\beval\s*\(/i,          // eval()
  /\bexec\s*\(/i,          // exec()
  /\bFunction\s*\(/i,      // new Function()
];

/** HTML tags that could be used for injection. */
const HTML_INJECTION_PATTERN =
  /<\s*(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[^>]*>/gi;

/** Event handler attributes in any HTML. */
const EVENT_HANDLER_PATTERN =
  /\bon\w+\s*=/gi;

/**
 * Scan a SKILL.md body for policy violations.
 *
 * @param body - The markdown body (after frontmatter extraction)
 * @param rawSize - The raw file size in bytes
 * @returns Array of violations (empty = clean)
 */
export function scanSkillPolicy(body: string, rawSize: number): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  // ── Size limit ──────────────────────────────────────────────────────
  if (rawSize > MAX_SKILL_FILE_SIZE) {
    violations.push({
      rule: 'max-file-size',
      message: `File size ${rawSize} bytes exceeds limit of ${MAX_SKILL_FILE_SIZE} bytes`,
      severity: 'error',
    });
  }

  // ── Token count (approximate: 1 token ≈ 4 chars for English) ──────
  const approxTokens = Math.ceil(body.length / 4);
  if (approxTokens > MAX_SKILL_TOKENS) {
    violations.push({
      rule: 'max-token-count',
      message: `Approximate token count ${approxTokens} exceeds limit of ${MAX_SKILL_TOKENS}`,
      severity: 'error',
    });
  }

  // ── Imperative system directives ──────────────────────────────────
  for (const pattern of DIRECTIVE_PATTERNS) {
    if (pattern.test(body)) {
      violations.push({
        rule: 'prompt-injection-directive',
        message: `Contains imperative system directive matching: ${pattern.source}`,
        severity: 'error',
      });
      break; // One directive violation is enough to fail
    }
  }

  // ── Executable code fences ────────────────────────────────────────
  if (EXECUTABLE_FENCE_PATTERN.test(body)) {
    violations.push({
      rule: 'executable-code-fence',
      message: 'Contains code fence with executable language tag — all executable patterns are rejected',
      severity: 'error',
    });
  }

  // ── Executable inline patterns inside code blocks ─────────────────
  const codeBlockRegex = /```[\s\S]*?```/g;
  let codeMatch: RegExpExecArray | null;
  while ((codeMatch = codeBlockRegex.exec(body)) !== null) {
    for (const pattern of EXECUTABLE_INLINE_PATTERNS) {
      if (pattern.test(codeMatch[0])) {
        violations.push({
          rule: 'executable-inline-pattern',
          message: `Code block contains executable pattern: ${pattern.source}`,
          severity: 'error',
        });
        break;
      }
    }
  }

  // ── HTML injection ────────────────────────────────────────────────
  if (HTML_INJECTION_PATTERN.test(body)) {
    violations.push({
      rule: 'html-injection',
      message: 'Contains HTML injection tags (script, iframe, etc.)',
      severity: 'warning',
    });
    // Reset lastIndex since we used global regex
    HTML_INJECTION_PATTERN.lastIndex = 0;
  }

  if (EVENT_HANDLER_PATTERN.test(body)) {
    violations.push({
      rule: 'html-event-handler',
      message: 'Contains HTML event handler attributes',
      severity: 'warning',
    });
    EVENT_HANDLER_PATTERN.lastIndex = 0;
  }

  return violations;
}

/**
 * Strip HTML injection patterns from skill content.
 * Used after scanning to clean content that has only warnings (not errors).
 */
export function stripHtmlInjection(body: string): string {
  return body
    .replace(HTML_INJECTION_PATTERN, '')
    .replace(EVENT_HANDLER_PATTERN, '');
}

/**
 * Check if any violations are fatal (severity: 'error').
 */
export function hasErrors(violations: PolicyViolation[]): boolean {
  return violations.some((v) => v.severity === 'error');
}
