/**
 * @module @kickstart/core/validation/validators/run-as-non-root
 *
 * DS003 — securityContext.runAsNonRoot must be true on all pods.
 * AKS Automatic enforces Pod Security Standards (Baseline/Restricted)
 * which require non-root execution.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const runAsNonRootValidator: Validator = {
  name: "run-as-non-root",
  description:
    "Pod securityContext must set runAsNonRoot: true (DS003).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — run-as-non-root check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    // TODO: This regex checks if ANY container/pod has runAsNonRoot: true.
    // It should verify ALL containers have it set. Requires YAML parsing
    // or a more sophisticated regex approach to iterate over each container block.
    const hasRunAsNonRoot = /^\s+runAsNonRoot:\s*true\s*$/m.test(content);

    if (!hasRunAsNonRoot) {
      return {
        passed: false,
        message:
          "Pod or container securityContext does not set runAsNonRoot: true. AKS Automatic requires non-root execution.",
        severity: "error",
        fix: "Add 'securityContext: { runAsNonRoot: true }' to the pod spec or each container spec.",
      };
    }

    return {
      passed: true,
      message: "runAsNonRoot is set to true.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (/^\s+runAsNonRoot:\s*true\s*$/m.test(content)) return null;

    // Inject runAsNonRoot into existing securityContext or add one under spec.template.spec
    if (/^\s+securityContext:/m.test(content)) {
      return content.replace(
        /^(\s+)(securityContext:\s*)$/m,
        "$1$2\n$1  runAsNonRoot: true",
      );
    }

    // Add securityContext block after `spec:` under template
    return content.replace(
      /^(\s+)(containers:)/m,
      "$1securityContext:\n$1  runAsNonRoot: true\n$1$2",
    );
  },
};
