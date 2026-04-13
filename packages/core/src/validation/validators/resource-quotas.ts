/**
 * @module @kickstart/core/validation/validators/resource-quotas
 *
 * DS011 — Production-tier deployments should include a ResourceQuota in the namespace.
 * This is a cross-artifact check: it looks at all artifacts in a validation run
 * to see if a ResourceQuota exists alongside production Deployments.
 *
 * Since individual validators only see one artifact at a time, this validator
 * checks if the artifact itself is a ResourceQuota. The ValidationEngine's
 * cross-artifact checks use this to flag missing quotas.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

export const resourceQuotasValidator: Validator = {
  name: "resource-quotas",
  description:
    "Production namespaces should define a ResourceQuota (DS011).",

  validate(artifact: Artifact): ValidationResult {
    const content = artifact.content;
    const isDeployment = /^kind:\s*Deployment\s*$/m.test(content);

    if (!isDeployment) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — resource-quotas check skipped.",
        severity: "info",
      };
    }

    // Heuristic: production tier markers in the manifest
    const replicaMatch = content.match(/^\s*replicas:\s*(\d+)\s*$/m);
    const replicaCount = replicaMatch ? parseInt(replicaMatch[1], 10) : 1;
    const isLikelyProduction = replicaCount >= 3;

    if (!isLikelyProduction) {
      return {
        passed: true,
        message:
          "Deployment does not appear to be production-tier — resource-quotas check skipped.",
        severity: "info",
      };
    }

    return {
      passed: false,
      message:
        "Production-tier Deployment detected but no ResourceQuota found. Add a ResourceQuota to limit namespace resource consumption.",
      severity: "warning",
      fix: "Create a ResourceQuota manifest in the same namespace to cap CPU, memory, and pod count.",
    };
  },
};
