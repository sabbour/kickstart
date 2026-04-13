/**
 * @module @kickstart/core/validation/engine
 *
 * ValidationEngine — registers validators and runs them against artifacts.
 */

import type { Artifact } from "../artifacts/types.js";
import type { Validator, ValidationResult, ArtifactValidationReport } from "./types.js";

/**
 * Runs all registered validators against one or more artifacts and collects
 * the results into per-artifact reports.
 *
 * @example
 * ```ts
 * const engine = new ValidationEngine();
 * engine.register(resourceLimitsValidator);
 * engine.register(noLatestTagValidator);
 *
 * const report = engine.validateArtifact(myArtifact);
 * if (report.hasErrors) { ... }
 * ```
 */
export class ValidationEngine {
  private readonly _validators: Validator[] = [];

  /** Register a validator. No-op if a validator with the same name is already registered. */
  register(validator: Validator): void {
    if (!this._validators.some((v) => v.name === validator.name)) {
      this._validators.push(validator);
    }
  }

  /** Remove a registered validator by name. No-op if not found. */
  unregister(name: string): void {
    const idx = this._validators.findIndex((v) => v.name === name);
    if (idx !== -1) {
      this._validators.splice(idx, 1);
    }
  }

  /** Read-only snapshot of registered validators. */
  get registeredValidators(): ReadonlyArray<Validator> {
    return [...this._validators];
  }

  /**
   * Run all registered validators against a single artifact.
   * Returns a report with one `ValidationResult` per validator.
   */
  validateArtifact(artifact: Artifact): ArtifactValidationReport {
    const results: ValidationResult[] = this._validators.map((v) =>
      v.validate(artifact),
    );

    return {
      artifact: artifact.path,
      results,
      hasErrors: results.some((r) => !r.passed && r.severity === "error"),
      hasWarnings: results.some((r) => !r.passed && r.severity === "warning"),
    };
  }

  /**
   * Run all registered validators against every artifact in the array.
   * Returns one report per artifact.
   */
  validateAll(artifacts: Artifact[]): ArtifactValidationReport[] {
    return artifacts.map((a) => this.validateArtifact(a));
  }

  /**
   * Apply all applicable auto-fixes to an artifact's content.
   * Chains fixes from all registered validators that provide an `autoFix` method.
   * Returns the fixed content, or the original content if no fixes were applied.
   */
  applyAutoFixes(artifact: Artifact): { content: string; appliedFixes: string[] } {
    let content = artifact.content;
    const appliedFixes: string[] = [];

    for (const validator of this._validators) {
      if (typeof validator.autoFix !== "function") continue;
      const fixed = validator.autoFix(content);
      if (fixed !== null && fixed !== content) {
        content = fixed;
        appliedFixes.push(validator.name);
      }
    }

    return { content, appliedFixes };
  }
}
