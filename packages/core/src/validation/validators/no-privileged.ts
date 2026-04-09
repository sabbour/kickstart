/**
 * @module @kickstart/core/validation/validators/no-privileged
 *
 * DS003/DS004 — Containers must not run as root and must not set
 * privileged: true in their securityContext.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isK8sManifest(content: string): boolean {
  return /^apiVersion:/m.test(content);
}

export const noPrivilegedValidator: Validator = {
  name: "no-privileged",
  description:
    "Containers must not run with privileged: true in their securityContext (DS004).",

  validate(artifact: Artifact): ValidationResult {
    if (!isK8sManifest(artifact.content)) {
      return {
        passed: true,
        message: "Not a Kubernetes manifest — no-privileged check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    // Match `privileged: true` (with optional whitespace)
    const hasPrivileged = /^\s+privileged:\s+true\s*$/m.test(content);

    if (hasPrivileged) {
      return {
        passed: false,
        message:
          "One or more containers have 'privileged: true' in their securityContext.",
        severity: "error",
        fix: "Remove 'privileged: true' or set it to 'false'. Use granular Linux capabilities instead if elevated access is required.",
      };
    }

    return {
      passed: true,
      message: "No privileged containers detected.",
      severity: "info",
    };
  },
};
