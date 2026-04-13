/**
 * @module @kickstart/core/validation/validators/service-account-token
 *
 * DS018 — Pods should set automountServiceAccountToken: false unless
 * they need Kubernetes API access. AKS Automatic with Workload Identity
 * manages tokens externally — mounting the default token is unnecessary
 * and increases the attack surface.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const serviceAccountTokenValidator: Validator = {
  name: "service-account-token",
  description:
    "Pods should disable automountServiceAccountToken unless Kubernetes API access is needed (DS018).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — service-account-token check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasDisabled = /^\s+automountServiceAccountToken:\s*false\s*$/m.test(content);

    if (!hasDisabled) {
      return {
        passed: false,
        message:
          "Pod spec does not set automountServiceAccountToken: false. AKS Automatic uses Workload Identity — the default token mount is unnecessary.",
        severity: "warning",
        fix: "Add 'automountServiceAccountToken: false' to the pod spec.",
      };
    }

    return {
      passed: true,
      message: "automountServiceAccountToken is disabled.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (/^\s+automountServiceAccountToken:\s*false\s*$/m.test(content)) return null;

    // Add before containers:
    return content.replace(
      /^(\s+)(containers:)/m,
      "$1automountServiceAccountToken: false\n$1$2",
    );
  },
};
