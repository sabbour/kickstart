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

// Individual validators — DS001–DS006
export { resourceLimitsValidator } from "./validators/resource-limits.js";
export { noLatestTagValidator } from "./validators/no-latest-tag.js";
export { healthProbesValidator } from "./validators/health-probes.js";
export { noPrivilegedValidator } from "./validators/no-privileged.js";
export { namespaceSetValidator } from "./validators/namespace-set.js";
export { replicaCountValidator } from "./validators/replica-count.js";
export { imagePullPolicyValidator } from "./validators/image-pull-policy.js";

// New validators — DS003–DS005, DS007–DS013
export { runAsNonRootValidator } from "./validators/run-as-non-root.js";
export { noPrivilegeEscalationValidator } from "./validators/no-privilege-escalation.js";
export { noHostNetworkingValidator } from "./validators/no-host-networking.js";
export { readOnlyRootFsValidator } from "./validators/read-only-root-fs.js";
export { gatewayApiIngressValidator } from "./validators/gateway-api-ingress.js";
export { noImagePullSecretsValidator } from "./validators/no-image-pull-secrets.js";
export { resourceQuotasValidator } from "./validators/resource-quotas.js";
export { networkPoliciesValidator } from "./validators/network-policies.js";
export { podDisruptionBudgetValidator } from "./validators/pod-disruption-budget.js";

import type { ArtifactStore } from "../artifacts/types.js";
import { ValidationEngine } from "./engine.js";
import { resourceLimitsValidator } from "./validators/resource-limits.js";
import { noLatestTagValidator } from "./validators/no-latest-tag.js";
import { healthProbesValidator } from "./validators/health-probes.js";
import { noPrivilegedValidator } from "./validators/no-privileged.js";
import { namespaceSetValidator } from "./validators/namespace-set.js";
import { replicaCountValidator } from "./validators/replica-count.js";
import { imagePullPolicyValidator } from "./validators/image-pull-policy.js";
import { runAsNonRootValidator } from "./validators/run-as-non-root.js";
import { noPrivilegeEscalationValidator } from "./validators/no-privilege-escalation.js";
import { noHostNetworkingValidator } from "./validators/no-host-networking.js";
import { readOnlyRootFsValidator } from "./validators/read-only-root-fs.js";
import { gatewayApiIngressValidator } from "./validators/gateway-api-ingress.js";
import { noImagePullSecretsValidator } from "./validators/no-image-pull-secrets.js";
import { resourceQuotasValidator } from "./validators/resource-quotas.js";
import { networkPoliciesValidator } from "./validators/network-policies.js";
import { podDisruptionBudgetValidator } from "./validators/pod-disruption-budget.js";
import type { ArtifactValidationReport } from "./types.js";

/**
 * A pre-configured ValidationEngine with all built-in validators registered.
 * Use this for a quick out-of-the-box validation run, or create your own
 * `ValidationEngine` instance for custom validator sets.
 */
export function createDefaultValidationEngine(): ValidationEngine {
  const engine = new ValidationEngine();
  // Original validators
  engine.register(resourceLimitsValidator);
  engine.register(noLatestTagValidator);
  engine.register(healthProbesValidator);
  engine.register(noPrivilegedValidator);
  engine.register(namespaceSetValidator);
  engine.register(replicaCountValidator);
  engine.register(imagePullPolicyValidator);
  // AKS Automatic safeguards (DS003–DS005, DS007–DS013)
  engine.register(runAsNonRootValidator);
  engine.register(noPrivilegeEscalationValidator);
  engine.register(noHostNetworkingValidator);
  engine.register(readOnlyRootFsValidator);
  engine.register(gatewayApiIngressValidator);
  engine.register(noImagePullSecretsValidator);
  engine.register(resourceQuotasValidator);
  engine.register(networkPoliciesValidator);
  engine.register(podDisruptionBudgetValidator);
  return engine;
}

/**
 * Post-generation injection point — validates all artifacts in the store,
 * applies auto-fixes where possible, and writes corrected artifacts back.
 *
 * @returns Per-artifact validation reports (run after auto-fixes are applied)
 */
export function validateAndFixArtifacts(
  store: ArtifactStore,
): ArtifactValidationReport[] {
  const engine = createDefaultValidationEngine();
  const artifacts = store.list();

  // Apply auto-fixes to each artifact
  for (const artifact of artifacts) {
    const { content, appliedFixes } = engine.applyAutoFixes(artifact);
    if (appliedFixes.length > 0) {
      store.put(artifact.path, content, {
        language: artifact.language,
        metadata: {
          ...artifact.metadata,
          autoFixesApplied: appliedFixes,
        },
      });
    }
  }

  // Re-validate after fixes
  const fixedArtifacts = store.list();
  return engine.validateAll(fixedArtifacts);
}
