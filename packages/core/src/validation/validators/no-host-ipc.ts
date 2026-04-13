/**
 * @module @kickstart/core/validation/validators/no-host-ipc
 *
 * DS017 — Pods must not use hostIPC.
 * AKS Automatic enforces Pod Security Standards which prohibit
 * sharing the host IPC namespace.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const noHostIpcValidator: Validator = {
  name: "no-host-ipc",
  description:
    "Pods must not use hostIPC (DS017).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — no-host-ipc check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasHostIpc = /^\s+hostIPC:\s*true\s*$/m.test(content);

    if (hasHostIpc) {
      return {
        passed: false,
        message:
          "Pod spec sets hostIPC: true. AKS Automatic prohibits sharing the host IPC namespace.",
        severity: "error",
        fix: "Remove 'hostIPC: true' from the pod spec or set it to false.",
      };
    }

    return {
      passed: true,
      message: "hostIPC is not enabled.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (!/^\s+hostIPC:\s*true\s*$/m.test(content)) return null;

    return content.replace(/^\s+hostIPC:\s*true\s*\n/m, "");
  },
};
