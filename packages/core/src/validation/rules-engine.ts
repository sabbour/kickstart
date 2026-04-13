/**
 * @module @kickstart/core/validation/rules-engine
 *
 * RulesEngine — a higher-level wrapper around ValidationEngine that adds
 * rule metadata (category, tags, AKS constraint mapping) and discovery APIs.
 *
 * @example
 * ```ts
 * import { RulesEngine, createDefaultRulesEngine } from "@kickstart/core";
 *
 * const engine = createDefaultRulesEngine();
 * const secRules = engine.getByCategory("security");
 * const report = engine.validateWithCategories(myArtifact);
 * ```
 */

import type { Artifact } from "../artifacts/types.js";
import { ValidationEngine } from "./engine.js";
import type { ValidationResult, ArtifactValidationReport } from "./types.js";
import type {
  ValidationRule,
  RuleCategory,
  AksConstraintFamily,
  CategorisedValidationReport,
  RulesEngineSummary,
} from "./rule-types.js";

const ALL_CATEGORIES: readonly RuleCategory[] = [
  "security",
  "reliability",
  "networking",
  "best-practices",
];

export class RulesEngine {
  private readonly _rules: ValidationRule[] = [];
  private readonly _engine = new ValidationEngine();

  /** Register a validation rule. No-op if a rule with the same validator name exists. */
  register(rule: ValidationRule): void {
    if (this._rules.some((r) => r.validator.name === rule.validator.name)) return;
    this._rules.push(rule);
    this._engine.register(rule.validator);
  }

  /** Remove a rule by validator name. */
  unregister(name: string): void {
    const idx = this._rules.findIndex((r) => r.validator.name === name);
    if (idx !== -1) {
      this._rules.splice(idx, 1);
      this._engine.unregister(name);
    }
  }

  /** Read-only snapshot of all registered rules. */
  get rules(): ReadonlyArray<ValidationRule> {
    return [...this._rules];
  }

  /** Get the inner ValidationEngine for low-level access. */
  get engine(): ValidationEngine {
    return this._engine;
  }

  // ── Discovery ──────────────────────────────────────────────────────

  /** Filter rules by category. */
  getByCategory(category: RuleCategory): ValidationRule[] {
    return this._rules.filter((r) => r.category === category);
  }

  /** Filter rules by tag. */
  getByTag(tag: string): ValidationRule[] {
    return this._rules.filter((r) => r.tags.includes(tag));
  }

  /** Get all rules mapped to an AKS Automatic constraint family. */
  getAksConstraints(family?: AksConstraintFamily): ValidationRule[] {
    if (family) {
      return this._rules.filter((r) => r.aksConstraint === family);
    }
    return this._rules.filter((r) => r.aksConstraint !== undefined);
  }

  /** Get all rules that provide auto-fix. */
  getAutoFixRules(): ValidationRule[] {
    return this._rules.filter((r) => r.autoFixAvailable);
  }

  /** Find a rule by validator name. */
  getRule(name: string): ValidationRule | undefined {
    return this._rules.find((r) => r.validator.name === name);
  }

  // ── Validation ─────────────────────────────────────────────────────

  /** Validate a single artifact (delegates to inner engine). */
  validateArtifact(artifact: Artifact): ArtifactValidationReport {
    return this._engine.validateArtifact(artifact);
  }

  /** Validate all artifacts. */
  validateAll(artifacts: Artifact[]): ArtifactValidationReport[] {
    return this._engine.validateAll(artifacts);
  }

  /**
   * Validate a single artifact and return results grouped by category.
   * Each result is placed in its rule's category bucket.
   */
  validateWithCategories(artifact: Artifact): CategorisedValidationReport {
    const results: ValidationResult[] = [];
    const resultsByCategory: Record<RuleCategory, ValidationResult[]> = {
      security: [],
      reliability: [],
      networking: [],
      "best-practices": [],
    };

    for (const rule of this._rules) {
      const result = rule.validator.validate(artifact);
      results.push(result);
      resultsByCategory[rule.category].push(result);
    }

    return {
      artifact: artifact.path,
      results,
      hasErrors: results.some((r) => !r.passed && r.severity === "error"),
      hasWarnings: results.some((r) => !r.passed && r.severity === "warning"),
      resultsByCategory,
    };
  }

  /** Apply auto-fixes (delegates to inner engine). */
  applyAutoFixes(artifact: Artifact): { content: string; appliedFixes: string[] } {
    return this._engine.applyAutoFixes(artifact);
  }

  // ── Summary ────────────────────────────────────────────────────────

  /** Aggregate stats about registered rules. */
  getSummary(): RulesEngineSummary {
    const byCategory = {} as Record<RuleCategory, number>;
    for (const cat of ALL_CATEGORIES) {
      byCategory[cat] = this._rules.filter((r) => r.category === cat).length;
    }

    return {
      totalRules: this._rules.length,
      byCategory,
      withAutoFix: this._rules.filter((r) => r.autoFixAvailable).length,
      withAksConstraint: this._rules.filter((r) => r.aksConstraint !== undefined).length,
    };
  }
}
