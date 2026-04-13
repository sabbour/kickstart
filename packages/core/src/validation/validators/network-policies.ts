/**
 * @module @kickstart/core/validation/validators/network-policies
 *
 * DS012 — Production-tier deployments should include a NetworkPolicy
 * to restrict pod-to-pod traffic. AKS Automatic uses Azure Network Policy
 * Manager (Cilium-based) which supports K8s NetworkPolicy resources.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

export const networkPoliciesValidator: Validator = {
  name: "network-policies",
  description:
    "Production namespaces should define a NetworkPolicy (DS012).",

  validate(artifact: Artifact): ValidationResult {
    const content = artifact.content;
    const isDeployment = /^kind:\s*Deployment\s*$/m.test(content);

    if (!isDeployment) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — network-policies check skipped.",
        severity: "info",
      };
    }

    const replicaMatch = content.match(/^\s*replicas:\s*(\d+)\s*$/m);
    const replicaCount = replicaMatch ? parseInt(replicaMatch[1], 10) : 1;
    const isLikelyProduction = replicaCount >= 3;

    if (!isLikelyProduction) {
      return {
        passed: true,
        message:
          "Deployment does not appear to be production-tier — network-policies check skipped.",
        severity: "info",
      };
    }

    return {
      passed: false,
      message:
        "Production-tier Deployment detected. Ensure the namespace defines a NetworkPolicy to restrict pod-to-pod traffic.",
      severity: "warning",
      fix: "Create a NetworkPolicy manifest that defines ingress/egress rules for this Deployment's pods.",
    };
  },
};
