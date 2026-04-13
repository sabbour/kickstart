/**
 * @module @kickstart/core/validation
 *
 * Client-side artifact validation system.
 *
 * Validates generated Kubernetes manifests and other deployment artifacts
 * against deployment safeguards before the user deploys. Each validator
 * maps to one or more DEPLOYMENT_SAFEGUARDS rules (DS001–DS020).
 *
 * The `RulesEngine` layer adds rule metadata (category, tags, AKS constraint
 * mapping) on top of the core `ValidationEngine` for discovery and reporting.
 *
 * @example
 * ```ts
 * import { createDefaultRulesEngine } from "@kickstart/core";
 *
 * const engine = createDefaultRulesEngine();
 * const securityRules = engine.getByCategory("security");
 * const report = engine.validateWithCategories(myArtifact);
 * ```
 */

export type {
  ValidationSeverity,
  ValidationResult,
  Validator,
  ArtifactValidationReport,
} from "./types.js";

export type {
  RuleCategory,
  AksConstraintFamily,
  ValidationRule,
  CategorisedValidationReport,
  RulesEngineSummary,
} from "./rule-types.js";

export { ValidationEngine } from "./engine.js";
export { RulesEngine } from "./rules-engine.js";

// Individual validators — DS001–DS006
export { resourceLimitsValidator } from "./validators/resource-limits.js";
export { noLatestTagValidator } from "./validators/no-latest-tag.js";
export { healthProbesValidator } from "./validators/health-probes.js";
export { noPrivilegedValidator } from "./validators/no-privileged.js";
export { namespaceSetValidator } from "./validators/namespace-set.js";
export { replicaCountValidator } from "./validators/replica-count.js";
export { imagePullPolicyValidator } from "./validators/image-pull-policy.js";

// AKS Automatic safeguards — DS003–DS005, DS007–DS013
export { runAsNonRootValidator } from "./validators/run-as-non-root.js";
export { noPrivilegeEscalationValidator } from "./validators/no-privilege-escalation.js";
export { noHostNetworkingValidator } from "./validators/no-host-networking.js";
export { readOnlyRootFsValidator } from "./validators/read-only-root-fs.js";
export { gatewayApiIngressValidator } from "./validators/gateway-api-ingress.js";
export { noImagePullSecretsValidator } from "./validators/no-image-pull-secrets.js";
export { resourceQuotasValidator } from "./validators/resource-quotas.js";
export { networkPoliciesValidator } from "./validators/network-policies.js";
export { podDisruptionBudgetValidator } from "./validators/pod-disruption-budget.js";

// Rules engine validators — DS014–DS020
export { containerPortNamesValidator } from "./validators/container-port-names.js";
export { dropAllCapabilitiesValidator } from "./validators/drop-all-capabilities.js";
export { noHostPidValidator } from "./validators/no-host-pid.js";
export { noHostIpcValidator } from "./validators/no-host-ipc.js";
export { serviceAccountTokenValidator } from "./validators/service-account-token.js";
export { labelRequirementsValidator } from "./validators/label-requirements.js";
export { topologySpreadConstraintsValidator } from "./validators/topology-spread-constraints.js";

import type { ArtifactStore } from "../artifacts/types.js";
import { ValidationEngine } from "./engine.js";
import { RulesEngine } from "./rules-engine.js";
import type { ValidationRule } from "./rule-types.js";
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
import { containerPortNamesValidator } from "./validators/container-port-names.js";
import { dropAllCapabilitiesValidator } from "./validators/drop-all-capabilities.js";
import { noHostPidValidator } from "./validators/no-host-pid.js";
import { noHostIpcValidator } from "./validators/no-host-ipc.js";
import { serviceAccountTokenValidator } from "./validators/service-account-token.js";
import { labelRequirementsValidator } from "./validators/label-requirements.js";
import { topologySpreadConstraintsValidator } from "./validators/topology-spread-constraints.js";
import type { ArtifactValidationReport } from "./types.js";

/**
 * All built-in rules with their category, tags, and AKS constraint metadata.
 * This is the canonical rule registry — add new validators here.
 */
export const ALL_RULES: readonly ValidationRule[] = [
  { validator: resourceLimitsValidator, category: "reliability", tags: ["container", "resources"], aksConstraint: "resource-management", autoFixAvailable: false },
  { validator: noLatestTagValidator, category: "best-practices", tags: ["container", "image"], autoFixAvailable: false },
  { validator: healthProbesValidator, category: "reliability", tags: ["container", "probes"], autoFixAvailable: false },
  { validator: noPrivilegedValidator, category: "security", tags: ["container", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: false },
  { validator: namespaceSetValidator, category: "best-practices", tags: ["metadata"], autoFixAvailable: false },
  { validator: replicaCountValidator, category: "reliability", tags: ["pod-spec", "ha"], autoFixAvailable: false },
  { validator: imagePullPolicyValidator, category: "best-practices", tags: ["container", "image"], autoFixAvailable: false },
  { validator: runAsNonRootValidator, category: "security", tags: ["pod-spec", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: noPrivilegeEscalationValidator, category: "security", tags: ["container", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: noHostNetworkingValidator, category: "security", tags: ["pod-spec", "networking"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: readOnlyRootFsValidator, category: "security", tags: ["container", "security-context"], autoFixAvailable: false },
  { validator: gatewayApiIngressValidator, category: "networking", tags: ["ingress", "gateway-api"], aksConstraint: "managed-gateway", autoFixAvailable: false },
  { validator: noImagePullSecretsValidator, category: "security", tags: ["pod-spec", "secrets"], aksConstraint: "workload-identity", autoFixAvailable: false },
  { validator: resourceQuotasValidator, category: "reliability", tags: ["namespace", "resources"], aksConstraint: "resource-management", autoFixAvailable: false },
  { validator: networkPoliciesValidator, category: "networking", tags: ["namespace", "networking"], autoFixAvailable: false },
  { validator: podDisruptionBudgetValidator, category: "reliability", tags: ["pod-spec", "ha"], autoFixAvailable: false },
  { validator: containerPortNamesValidator, category: "best-practices", tags: ["container", "networking"], autoFixAvailable: false },
  { validator: dropAllCapabilitiesValidator, category: "security", tags: ["container", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: noHostPidValidator, category: "security", tags: ["pod-spec", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: noHostIpcValidator, category: "security", tags: ["pod-spec", "security-context"], aksConstraint: "pod-security-standards", autoFixAvailable: true },
  { validator: serviceAccountTokenValidator, category: "security", tags: ["pod-spec", "workload-identity"], aksConstraint: "workload-identity", autoFixAvailable: true },
  { validator: labelRequirementsValidator, category: "best-practices", tags: ["metadata", "observability"], autoFixAvailable: false },
  { validator: topologySpreadConstraintsValidator, category: "reliability", tags: ["pod-spec", "ha"], autoFixAvailable: false },
];

/**
 * A pre-configured ValidationEngine with all built-in validators registered.
 * Use this for a quick out-of-the-box validation run, or create your own
 * `ValidationEngine` instance for custom validator sets.
 */
export function createDefaultValidationEngine(): ValidationEngine {
  const engine = new ValidationEngine();
  for (const rule of ALL_RULES) {
    engine.register(rule.validator);
  }
  return engine;
}

/**
 * A pre-configured RulesEngine with all built-in rules registered.
 * Provides categorised validation, AKS constraint mapping, and discovery APIs.
 */
export function createDefaultRulesEngine(): RulesEngine {
  const engine = new RulesEngine();
  for (const rule of ALL_RULES) {
    engine.register(rule);
  }
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
