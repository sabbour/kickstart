/**
 * @module @kickstart/core/validation/validators/topology-spread-constraints
 *
 * DS020 — Production deployments should use topologySpreadConstraints
 * to distribute pods across availability zones. AKS Automatic clusters
 * are multi-zone by default — without spread constraints, all replicas
 * may land in the same zone.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

/** Heuristic: 3+ replicas suggests production-tier workload. */
function isProductionTier(content: string): boolean {
  const match = content.match(/^\s+replicas:\s*(\d+)\s*$/m);
  return match !== null && parseInt(match[1], 10) >= 3;
}

export const topologySpreadConstraintsValidator: Validator = {
  name: "topology-spread-constraints",
  description:
    "Production deployments should use topologySpreadConstraints for zone distribution (DS020).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — topology-spread-constraints check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;

    if (!isProductionTier(content)) {
      return {
        passed: true,
        message:
          "Fewer than 3 replicas — topology spread constraints not required for non-production.",
        severity: "info",
      };
    }

    const hasSpread = /^\s+topologySpreadConstraints:/m.test(content);

    if (!hasSpread) {
      return {
        passed: false,
        message:
          "Production deployment (≥3 replicas) has no topologySpreadConstraints. AKS Automatic clusters are multi-zone — without spread constraints, all replicas may land in the same zone.",
        severity: "warning",
        fix: "Add 'topologySpreadConstraints' with 'topologyKey: topology.kubernetes.io/zone' and 'whenUnsatisfiable: DoNotSchedule' to the pod spec.",
      };
    }

    return {
      passed: true,
      message: "Topology spread constraints are configured.",
      severity: "info",
    };
  },
};
