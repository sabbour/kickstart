/**
 * @module @kickstart/core/validation/validators/resource-limits
 *
 * DS001 — Every container in a Deployment must define CPU and memory
 * requests AND limits.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

/** Returns true if the YAML content describes a Kubernetes Deployment. */
function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const resourceLimitsValidator: Validator = {
  name: "resource-limits",
  description:
    "Every container in a Deployment must define CPU and memory requests and limits (DS001).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — resource-limits check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasResourcesBlock = /^\s+resources:/m.test(content);
    const hasRequests = /^\s+requests:/m.test(content);
    const hasLimits = /^\s+limits:/m.test(content);
    // Expect at least two cpu: and memory: entries (one under requests, one under limits)
    const cpuCount = (content.match(/^\s+cpu:/gm) ?? []).length;
    const memCount = (content.match(/^\s+memory:/gm) ?? []).length;

    if (
      !hasResourcesBlock ||
      !hasRequests ||
      !hasLimits ||
      cpuCount < 2 ||
      memCount < 2
    ) {
      return {
        passed: false,
        message:
          "Containers are missing CPU and/or memory resource requests and limits.",
        severity: "error",
        fix: "Add a 'resources' block with both 'requests' (cpu, memory) and 'limits' (cpu, memory) to each container spec.",
      };
    }

    return {
      passed: true,
      message: "Resource requests and limits are defined.",
      severity: "info",
    };
  },
};
