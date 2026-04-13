/**
 * @module @kickstart/core/validation/validators/read-only-root-fs
 *
 * DS007 — readOnlyRootFilesystem should be true in container securityContext.
 * Prevents unexpected file modifications at runtime. Warning severity because
 * some apps need writable /tmp or /var.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const readOnlyRootFsValidator: Validator = {
  name: "read-only-root-fs",
  description:
    "Container securityContext should set readOnlyRootFilesystem: true (DS007).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — read-only-root-fs check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasReadOnly =
      /^\s+readOnlyRootFilesystem:\s*true\s*$/m.test(content);

    if (!hasReadOnly) {
      return {
        passed: false,
        message:
          "Container securityContext does not set readOnlyRootFilesystem: true.",
        severity: "warning",
        fix: "Add 'readOnlyRootFilesystem: true' to the container securityContext. Use emptyDir volumes for /tmp if needed.",
      };
    }

    return {
      passed: true,
      message: "readOnlyRootFilesystem is set to true.",
      severity: "info",
    };
  },
};
