/**
 * @module @kickstart/core/validation/validators/pod-disruption-budget
 *
 * DS013 — Production-tier deployments should define a PodDisruptionBudget
 * to maintain availability during voluntary disruptions (node upgrades,
 * cluster autoscaler scale-in, etc.).
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

export const podDisruptionBudgetValidator: Validator = {
  name: "pod-disruption-budget",
  description:
    "Production Deployments should have a PodDisruptionBudget (DS013).",

  validate(artifact: Artifact): ValidationResult {
    const content = artifact.content;
    const isDeployment = /^kind:\s*Deployment\s*$/m.test(content);

    if (!isDeployment) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — pod-disruption-budget check skipped.",
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
          "Deployment does not appear to be production-tier — pod-disruption-budget check skipped.",
        severity: "info",
      };
    }

    return {
      passed: false,
      message:
        "Production-tier Deployment detected but no PodDisruptionBudget found. Add a PDB to maintain availability during disruptions.",
      severity: "warning",
      fix: "Create a PodDisruptionBudget with minAvailable or maxUnavailable matching your replica count.",
    };
  },
};
