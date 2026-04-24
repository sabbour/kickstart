/**
 * Safeguards module — static analysis + deterministic fixes for K8s manifests.
 *
 * Rules ported from Microsoft AKS-Copilot PRs #1837 and #1976.
 */

export { type SafeguardViolation, type SafeguardRule, type Severity, SAFEGUARD_RULES, getRuleById } from './rules.js';
export { parseManifest, type ParseResult, type ParseError } from './parser.js';
export { applyFixes, isFixable, type FixResult } from './fixes.js';
export { checkSafeguards, type CheckResult } from './check.js';
