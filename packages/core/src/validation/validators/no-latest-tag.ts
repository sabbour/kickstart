/**
 * @module @kickstart/core/validation/validators/no-latest-tag
 *
 * DS006 — Container images must not use the :latest tag or omit a version tag.
 * Pin to a specific version tag or SHA digest for reproducible deployments.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

/** Extracts all image: values from a YAML string. */
function extractImages(content: string): string[] {
  // Match `image: value` whether the line starts with spaces or `- image:`
  const matches = content.matchAll(/^\s+(?:-\s+)?image:\s+(\S+)/gm);
  return [...matches].map((m) => m[1]);
}

/** Returns true if an image reference violates the no-latest rule. */
function isLatestOrUntagged(image: string): boolean {
  // Allow placeholders like <IMAGE_PLACEHOLDER>
  if (image.startsWith("<") && image.endsWith(">")) return false;
  // Allow digest references: image@sha256:...
  if (image.includes("@")) return false;
  // Fail explicit :latest
  if (image.endsWith(":latest")) return true;
  // Fail if no tag separator (implicit latest)
  const lastSlash = image.lastIndexOf("/");
  const nameAndTag = lastSlash === -1 ? image : image.slice(lastSlash + 1);
  return !nameAndTag.includes(":");
}

export const noLatestTagValidator: Validator = {
  name: "no-latest-tag",
  description:
    "Container images must not use the :latest tag or omit a version tag (DS006).",

  validate(artifact: Artifact): ValidationResult {
    const images = extractImages(artifact.content);

    if (images.length === 0) {
      return {
        passed: true,
        message: "No container images found — no-latest-tag check skipped.",
        severity: "info",
      };
    }

    const violations = images.filter(isLatestOrUntagged);

    if (violations.length > 0) {
      return {
        passed: false,
        message: `Container image(s) use :latest or have no version tag: ${violations.join(", ")}`,
        severity: "error",
        fix: "Pin each image to a specific version tag (e.g. myapp:v1.2.3) or a SHA digest (e.g. myapp@sha256:...).",
      };
    }

    return {
      passed: true,
      message: "All container images are pinned to a specific version.",
      severity: "info",
    };
  },
};
