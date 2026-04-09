/**
 * @module @kickstart/core/validation/validators/replica-count
 *
 * Production Deployments must run more than one replica for high availability.
 * A single-replica deployment has no redundancy — a pod restart takes your
 * app offline.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const replicaCountValidator: Validator = {
  name: "replica-count",
  description:
    "Deployments should run more than one replica for high availability.",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — replica-count check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const replicaMatch = content.match(/^\s*replicas:\s*(\d+)\s*$/m);

    if (!replicaMatch) {
      // No replicas field — Kubernetes defaults to 1
      return {
        passed: false,
        message:
          "Deployment does not specify 'replicas'. Kubernetes will default to 1, which has no redundancy.",
        severity: "warning",
        fix: "Add 'replicas: 2' (or more) to the Deployment spec for high availability.",
      };
    }

    const count = parseInt(replicaMatch[1], 10);
    if (count <= 1) {
      return {
        passed: false,
        message: `Deployment has only ${count} replica. At least 2 replicas are recommended for production.`,
        severity: "warning",
        fix: "Increase 'replicas' to 2 or more. Consider pairing with a HorizontalPodAutoscaler.",
      };
    }

    return {
      passed: true,
      message: `Deployment runs ${count} replicas.`,
      severity: "info",
    };
  },
};
