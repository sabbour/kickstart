/**
 * @module @kickstart/core/validation/validators/image-pull-policy
 *
 * Container imagePullPolicy should be IfNotPresent or Never for tagged images.
 * Using Always with a pinned version tag causes unnecessary registry round-trips
 * on every pod start and breaks offline/air-gapped scenarios.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

/** Returns true if any image reference uses :latest or has no version tag. */
function hasLatestImages(content: string): boolean {
  const matches = content.matchAll(/^\s+(?:-\s+)?image:\s+(\S+)/gm);
  for (const m of matches) {
    const image = m[1];
    if (image.startsWith("<") && image.endsWith(">")) continue;
    if (image.includes("@")) continue;
    if (image.endsWith(":latest")) return true;
    const lastSlash = image.lastIndexOf("/");
    const nameAndTag = lastSlash === -1 ? image : image.slice(lastSlash + 1);
    if (!nameAndTag.includes(":")) return true;
  }
  return false;
}

export const imagePullPolicyValidator: Validator = {
  name: "image-pull-policy",
  description:
    "Container imagePullPolicy should be IfNotPresent or Never for tagged images, not Always.",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message:
          "Not a Deployment manifest — image-pull-policy check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const pullPolicyMatch = content.match(
      /^\s+imagePullPolicy:\s+(\S+)\s*$/m,
    );

    if (!pullPolicyMatch) {
      // Not set — Kubernetes defaults are fine (IfNotPresent for tagged images)
      return {
        passed: true,
        message:
          "No imagePullPolicy set — Kubernetes will use its default (IfNotPresent for tagged images).",
        severity: "info",
      };
    }

    const policy = pullPolicyMatch[1];

    if (policy === "Always" && !hasLatestImages(content)) {
      return {
        passed: false,
        message:
          "imagePullPolicy is set to 'Always' for a pinned-version image. This causes unnecessary registry pulls on every pod start.",
        severity: "warning",
        fix: "Change imagePullPolicy to 'IfNotPresent' for tagged images. Reserve 'Always' only for :latest or mutable tags.",
      };
    }

    return {
      passed: true,
      message: `imagePullPolicy is '${policy}'.`,
      severity: "info",
    };
  },
};
