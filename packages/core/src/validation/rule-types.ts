/**
 * @module @kickstart/core/validation/rule-types
 *
 * Extended types for the rules engine layer. Adds metadata (category, tags,
 * AKS constraint mapping) on top of the base Validator interface.
 */

import type { Validator, ValidationResult, ArtifactValidationReport } from "./types.js";

/** High-level grouping for validation rules. */
export type RuleCategory = "security" | "reliability" | "networking" | "best-practices";

/** AKS Automatic constraint families that enforce specific policies. */
export type AksConstraintFamily =
  | "pod-security-standards"
  | "managed-gateway"
  | "workload-identity"
  | "resource-management";

/**
 * A validation rule — wraps a `Validator` with discovery metadata.
 * Used by `RulesEngine` for categorised filtering and AKS constraint mapping.
 */
export interface ValidationRule {
  /** The underlying validator that performs the actual check. */
  validator: Validator;
  /** High-level category. */
  category: RuleCategory;
  /** Free-form tags for fine-grained filtering (e.g. "container", "pod-spec"). */
  tags: readonly string[];
  /** Which AKS Automatic constraint family enforces this rule (if any). */
  aksConstraint?: AksConstraintFamily;
  /** Whether the validator provides an autoFix method. */
  autoFixAvailable: boolean;
}

/**
 * Per-artifact report produced by the rules engine.
 * Extends ArtifactValidationReport with per-rule metadata.
 */
export interface CategorisedValidationReport extends ArtifactValidationReport {
  /** Results grouped by their rule's category. */
  resultsByCategory: Record<RuleCategory, ValidationResult[]>;
}

/** Aggregate statistics for an engine instance. */
export interface RulesEngineSummary {
  /** Total number of registered rules. */
  totalRules: number;
  /** Count of rules per category. */
  byCategory: Record<RuleCategory, number>;
  /** How many rules offer auto-fix. */
  withAutoFix: number;
  /** How many rules map to an AKS Automatic constraint. */
  withAksConstraint: number;
}
