/**
 * @module @kickstart/core/validation
 *
 * Client-side artifact validation system.
 *
 * Validates generated Kubernetes manifests and other deployment artifacts
 * against deployment safeguards before the user deploys. Each validator
 * maps to one or more DEPLOYMENT_SAFEGUARDS rules (DS001–DS013).
 *
 * @example
 * ```ts
 * import { ValidationEngine, resourceLimitsValidator, noLatestTagValidator } from "@kickstart/core";
 *
 * const engine = new ValidationEngine();
 * engine.register(resourceLimitsValidator);
 * engine.register(noLatestTagValidator);
 *
 * const report = engine.validateArtifact(myArtifact);
 * if (report.hasErrors) {
 *   console.error("Deployment blocked — fix errors first.");
 * }
 * ```
 */

export type {
  ValidationSeverity,
  ValidationResult,
  Validator,
  ArtifactValidationReport,
} from "./types.js";

export { ValidationEngine } from "./engine.js";

// Individual validators
export { resourceLimitsValidator } from "./validators/resource-limits.js";
export { noLatestTagValidator } from "./validators/no-latest-tag.js";
export { healthProbesValidator } from "./validators/health-probes.js";
export { noPrivilegedValidator } from "./validators/no-privileged.js";
export { namespaceSetValidator } from "./validators/namespace-set.js";
export { replicaCountValidator } from "./validators/replica-count.js";
export { imagePullPolicyValidator } from "./validators/image-pull-policy.js";

import { ValidationEngine } from "./engine.js";
import { resourceLimitsValidator } from "./validators/resource-limits.js";
import { noLatestTagValidator } from "./validators/no-latest-tag.js";
import { healthProbesValidator } from "./validators/health-probes.js";
import { noPrivilegedValidator } from "./validators/no-privileged.js";
import { namespaceSetValidator } from "./validators/namespace-set.js";
import { replicaCountValidator } from "./validators/replica-count.js";
import { imagePullPolicyValidator } from "./validators/image-pull-policy.js";

/**
 * A pre-configured ValidationEngine with all built-in validators registered.
 * Use this for a quick out-of-the-box validation run, or create your own
 * `ValidationEngine` instance for custom validator sets.
 */
export function createDefaultValidationEngine(): ValidationEngine {
  const engine = new ValidationEngine();
  engine.register(resourceLimitsValidator);
  engine.register(noLatestTagValidator);
  engine.register(healthProbesValidator);
  engine.register(noPrivilegedValidator);
  engine.register(namespaceSetValidator);
  engine.register(replicaCountValidator);
  engine.register(imagePullPolicyValidator);
  return engine;
}
