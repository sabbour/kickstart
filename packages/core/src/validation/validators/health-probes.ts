/**
 * @module @kickstart/core/validation/validators/health-probes
 *
 * DS002 — Every Deployment container must define both a livenessProbe
 * and a readinessProbe so the platform can route traffic correctly and
 * restart unhealthy instances.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const healthProbesValidator: Validator = {
  name: "health-probes",
  description:
    "Deployment containers must define both livenessProbe and readinessProbe (DS002).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — health-probes check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasLiveness = /^\s+livenessProbe:/m.test(content);
    const hasReadiness = /^\s+readinessProbe:/m.test(content);

    if (!hasLiveness && !hasReadiness) {
      return {
        passed: false,
        message:
          "Deployment containers are missing both livenessProbe and readinessProbe.",
        severity: "error",
        fix: "Add 'livenessProbe' and 'readinessProbe' blocks to each container spec. Use httpGet, tcpSocket, or exec probes.",
      };
    }

    if (!hasLiveness) {
      return {
        passed: false,
        message: "Deployment containers are missing a livenessProbe.",
        severity: "error",
        fix: "Add a 'livenessProbe' block to each container spec.",
      };
    }

    if (!hasReadiness) {
      return {
        passed: false,
        message: "Deployment containers are missing a readinessProbe.",
        severity: "error",
        fix: "Add a 'readinessProbe' block to each container spec.",
      };
    }

    return {
      passed: true,
      message: "Both livenessProbe and readinessProbe are defined.",
      severity: "info",
    };
  },
};
