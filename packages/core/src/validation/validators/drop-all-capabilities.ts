/**
 * @module @kickstart/core/validation/validators/drop-all-capabilities
 *
 * DS015 — Containers should drop all Linux capabilities.
 * AKS Automatic enforces Pod Security Standards (Restricted) which
 * requires capabilities.drop: ["ALL"].
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const dropAllCapabilitiesValidator: Validator = {
  name: "drop-all-capabilities",
  description:
    "Containers must drop all Linux capabilities (DS015).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — drop-all-capabilities check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    // Check for capabilities.drop containing ALL
    const hasDropAll =
      /^\s+drop:/m.test(content) &&
      /^\s+- (?:"|')?ALL(?:"|')?\s*$/m.test(content);

    if (!hasDropAll) {
      return {
        passed: false,
        message:
          "Containers do not drop all Linux capabilities. AKS Automatic (Restricted profile) requires capabilities.drop: [\"ALL\"].",
        severity: "error",
        fix: "Add 'securityContext.capabilities.drop: [\"ALL\"]' to each container spec.",
      };
    }

    return {
      passed: true,
      message: "All capabilities are dropped.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (
      /^\s+drop:/m.test(content) &&
      /^\s+- (?:"|')?ALL(?:"|')?\s*$/m.test(content)
    ) {
      return null;
    }

    // If securityContext exists at container level but no capabilities block
    if (/^\s+securityContext:/m.test(content) && !/^\s+capabilities:/m.test(content)) {
      // Add capabilities block after the first securityContext under containers
      return content.replace(
        /^(\s+)(allowPrivilegeEscalation:.*$)/m,
        "$1$2\n$1capabilities:\n$1  drop:\n$1    - ALL",
      );
    }

    // If no securityContext at all, add one before or after containers
    if (!/^\s+securityContext:/m.test(content)) {
      return content.replace(
        /^(\s+)(containers:)/m,
        "$1securityContext:\n$1  runAsNonRoot: true\n$1$2",
      );
    }

    return null;
  },
};
