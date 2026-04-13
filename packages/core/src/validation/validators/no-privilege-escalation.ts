/**
 * @module @kickstart/core/validation/validators/no-privilege-escalation
 *
 * DS004 — securityContext.allowPrivilegeEscalation must be false
 * on all containers. AKS Automatic enforces this via Pod Security Standards.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const noPrivilegeEscalationValidator: Validator = {
  name: "no-privilege-escalation",
  description:
    "Container securityContext must set allowPrivilegeEscalation: false (DS004).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — no-privilege-escalation check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    // TODO: This regex checks if ANY container has allowPrivilegeEscalation: false.
    // It should verify ALL containers have it set to false. Requires YAML parsing
    // or a more sophisticated regex approach to iterate over each container block.
    const hasExplicitFalse =
      /^\s+allowPrivilegeEscalation:\s*false\s*$/m.test(content);

    const hasExplicitTrue =
      /^\s+allowPrivilegeEscalation:\s*true\s*$/m.test(content);

    if (hasExplicitTrue) {
      return {
        passed: false,
        message:
          "Container securityContext has allowPrivilegeEscalation: true. AKS Automatic blocks privilege escalation.",
        severity: "error",
        fix: "Set 'allowPrivilegeEscalation: false' in each container's securityContext.",
      };
    }

    if (!hasExplicitFalse) {
      return {
        passed: false,
        message:
          "Container securityContext does not explicitly set allowPrivilegeEscalation: false.",
        severity: "error",
        fix: "Add 'allowPrivilegeEscalation: false' to each container's securityContext.",
      };
    }

    return {
      passed: true,
      message: "allowPrivilegeEscalation is explicitly set to false.",
      severity: "info",
    };
  },

  autoFix(content: string): string | null {
    if (!/^kind:\s*Deployment\s*$/m.test(content)) return null;
    if (/^\s+allowPrivilegeEscalation:\s*false\s*$/m.test(content)) return null;

    // Replace true with false
    if (/^\s+allowPrivilegeEscalation:\s*true\s*$/m.test(content)) {
      return content.replace(
        /^(\s+allowPrivilegeEscalation:\s*)true(\s*)$/m,
        "$1false$2",
      );
    }

    // Add to existing container securityContext
    if (/^\s+securityContext:/m.test(content)) {
      return content.replace(
        /^(\s+)(securityContext:\s*)$/m,
        "$1$2\n$1  allowPrivilegeEscalation: false",
      );
    }

    return null;
  },
};
