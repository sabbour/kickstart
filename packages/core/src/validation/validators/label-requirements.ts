/**
 * @module @kickstart/core/validation/validators/label-requirements
 *
 * DS019 — Deployments should carry standard Kubernetes recommended labels
 * (app.kubernetes.io/name, app.kubernetes.io/version) for observability,
 * service mesh integration, and AKS monitoring.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const labelRequirementsValidator: Validator = {
  name: "label-requirements",
  description:
    "Deployments should carry standard Kubernetes recommended labels (DS019).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — label-requirements check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const missing: string[] = [];

    // Check for app.kubernetes.io/name OR the simple "app" label
    const hasAppLabel =
      /^\s+app\.kubernetes\.io\/name:/m.test(content) ||
      /^\s+app:/m.test(content);
    if (!hasAppLabel) missing.push("app (or app.kubernetes.io/name)");

    // Check for app.kubernetes.io/version OR a "version" label
    const hasVersionLabel =
      /^\s+app\.kubernetes\.io\/version:/m.test(content) ||
      /^\s+version:/m.test(content);
    if (!hasVersionLabel) missing.push("version (or app.kubernetes.io/version)");

    if (missing.length > 0) {
      return {
        passed: false,
        message: `Missing recommended labels: ${missing.join(", ")}. Standard labels improve observability and service mesh integration.`,
        severity: "warning",
        fix: `Add the following labels to metadata.labels and spec.template.metadata.labels: ${missing.join(", ")}.`,
      };
    }

    return {
      passed: true,
      message: "Standard recommended labels are present.",
      severity: "info",
    };
  },
};
