/**
 * @module @kickstart/core/validation/validators/no-image-pull-secrets
 *
 * DS010 — Container images should be pulled from ACR with AcrPull role binding,
 * not using imagePullSecrets. AKS Automatic clusters are pre-configured for
 * ACR integration via managed identity.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isK8sManifest(content: string): boolean {
  return /^apiVersion:/m.test(content);
}

export const noImagePullSecretsValidator: Validator = {
  name: "no-image-pull-secrets",
  description:
    "Do not use imagePullSecrets — use ACR with AcrPull role binding (DS010).",

  validate(artifact: Artifact): ValidationResult {
    if (!isK8sManifest(artifact.content)) {
      return {
        passed: true,
        message:
          "Not a Kubernetes manifest — no-image-pull-secrets check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const hasImagePullSecrets =
      /^\s+imagePullSecrets:/m.test(content);

    if (hasImagePullSecrets) {
      return {
        passed: false,
        message:
          "Manifest uses imagePullSecrets. AKS Automatic integrates with ACR via managed identity — no pull secrets needed.",
        severity: "error",
        fix: "Remove the imagePullSecrets block. Configure ACR integration with AcrPull role binding on the AKS managed identity instead.",
      };
    }

    return {
      passed: true,
      message: "No imagePullSecrets detected.",
      severity: "info",
    };
  },
};
