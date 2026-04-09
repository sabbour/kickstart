/**
 * @module @kickstart/core/validation/validators/namespace-set
 *
 * Kubernetes resources must specify a namespace in their metadata, and that
 * namespace must not be "default". Using a dedicated namespace keeps your
 * app isolated and allows namespace-scoped RBAC and network policies.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isK8sManifest(content: string): boolean {
  return /^apiVersion:/m.test(content) && /^metadata:/m.test(content);
}

export const namespaceSetValidator: Validator = {
  name: "namespace-set",
  description:
    "Kubernetes resources must specify a non-default namespace in metadata.",

  validate(artifact: Artifact): ValidationResult {
    if (!isK8sManifest(artifact.content)) {
      return {
        passed: true,
        message: "Not a Kubernetes manifest — namespace-set check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const namespaceMatch = content.match(/^\s+namespace:\s+(\S+)\s*$/m);

    if (!namespaceMatch) {
      return {
        passed: false,
        message:
          "Resource metadata does not specify a namespace.",
        severity: "error",
        fix: "Add 'namespace: <your-app-name>' under the 'metadata' section of each resource.",
      };
    }

    const namespace = namespaceMatch[1];
    if (namespace === "default") {
      return {
        passed: false,
        message:
          "Resource is deployed to the 'default' namespace. Use a dedicated namespace.",
        severity: "error",
        fix: "Set 'namespace' to a descriptive name for your app (e.g. 'my-app') instead of 'default'.",
      };
    }

    return {
      passed: true,
      message: `Namespace is set to '${namespace}'.`,
      severity: "info",
    };
  },
};
