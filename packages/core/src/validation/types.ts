/**
 * @module @kickstart/core/validation/types
 *
 * Core types for the client-side artifact validation system.
 * Validators check generated K8s manifests against deployment safeguards
 * before the user deploys.
 */

import type { Artifact } from "../artifacts/types.js";

/** Severity level of a validation result. */
export type ValidationSeverity = "error" | "warning" | "info";

/**
 * The result of running a single validator against a single artifact.
 * `passed: true` means the artifact is compliant (or not applicable).
 */
export interface ValidationResult {
  /** Whether the artifact passed this validation rule. */
  passed: boolean;
  /** Human-readable explanation of the result. */
  message: string;
  /** Severity when not passed: error blocks deployment, warning suggests improvement. */
  severity: ValidationSeverity;
  /** Optional actionable hint for fixing the violation. */
  fix?: string;
}

/**
 * A named, reusable validation rule.
 * Implementations live in `validators/` and are registered with `ValidationEngine`.
 */
export interface Validator {
  /** Unique machine-readable identifier, e.g. "resource-limits". */
  name: string;
  /** Short human-readable description of what this validator checks. */
  description: string;
  /**
   * Run the validation against a single artifact.
   * Return `{ passed: true }` for artifacts that are not applicable
   * (e.g. a Dockerfile when this rule only applies to K8s Deployments).
   */
  validate(artifact: Artifact): ValidationResult;
  /**
   * Optional auto-fix: given the artifact content, return corrected content
   * or null if no fix is applicable. May add missing security-hardening fields
   * and may also mutate existing insecure values to safer ones.
   */
  autoFix?(content: string): string | null;
}

/** All validation results for a single artifact. */
export interface ArtifactValidationReport {
  /** Artifact path, e.g. "k8s/deployment.yaml". */
  artifact: string;
  /** One result per registered validator. */
  results: ValidationResult[];
  /** True if any result has passed=false and severity="error". */
  hasErrors: boolean;
  /** True if any result has passed=false and severity="warning". */
  hasWarnings: boolean;
}
