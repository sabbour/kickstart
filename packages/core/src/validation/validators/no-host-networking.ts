/**
 * @module @kickstart/core/validation/validators/no-host-networking
 *
 * DS005 — hostNetwork, hostPID, and hostIPC must be false or unset.
 * AKS Automatic blocks host-level namespace sharing via Pod Security Standards.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const noHostNetworkingValidator: Validator = {
  name: "no-host-networking",
  description:
    "Pods must not use hostNetwork, hostPID, or hostIPC (DS005).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — no-host-networking check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const violations: string[] = [];

    if (/^\s+hostNetwork:\s*true\s*$/m.test(content)) {
      violations.push("hostNetwork");
    }
    if (/^\s+hostPID:\s*true\s*$/m.test(content)) {
      violations.push("hostPID");
    }
    if (/^\s+hostIPC:\s*true\s*$/m.test(content)) {
      violations.push("hostIPC");
    }

    if (violations.length > 0) {
      return {
        passed: false,
        message: `Pod uses host-level namespaces: ${violations.join(", ")}. AKS Automatic blocks these settings.`,
        severity: "error",
        fix: `Remove or set to false: ${violations.join(", ")}. Apps on AKS Automatic run in isolated pod namespaces.`,
      };
    }

    return {
      passed: true,
      message: "No host-level namespace sharing detected.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;

    let fixed = content;
    let changed = false;
    for (const field of ["hostNetwork", "hostPID", "hostIPC"]) {
      const re = new RegExp(`^(\\s+${field}:\\s*)true(\\s*)$`, "m");
      if (re.test(fixed)) {
        fixed = fixed.replace(re, "$1false$2");
        changed = true;
      }
    }
    return changed ? fixed : null;
  },
};
