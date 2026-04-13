/**
 * @module @kickstart/core/validation/validators/no-host-pid
 *
 * DS016 — Pods must not use hostPID.
 * AKS Automatic enforces Pod Security Standards which prohibit
 * sharing the host PID namespace.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const noHostPidValidator: Validator = {
  name: "no-host-pid",
  description:
    "Pods must not use hostPID (DS016).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — no-host-pid check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasHostPid = /^\s+hostPID:\s*true\s*$/m.test(content);

    if (hasHostPid) {
      return {
        passed: false,
        message:
          "Pod spec sets hostPID: true. AKS Automatic prohibits sharing the host PID namespace.",
        severity: "error",
        fix: "Remove 'hostPID: true' from the pod spec or set it to false.",
      };
    }

    return {
      passed: true,
      message: "hostPID is not enabled.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (!/^\s+hostPID:\s*true\s*$/m.test(content)) return null;

    return content.replace(/^\s+hostPID:\s*true\s*\n/m, "");
  },
};
