/**
 * @module @kickstart/core/validation/validators/gateway-api-ingress
 *
 * DS008 — Use Gateway API (HTTPRoute) for ingress, not the legacy Ingress resource.
 * AKS Automatic ships with a managed Gateway controller and recommends HTTPRoute
 * over the legacy Ingress resource.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

export const gatewayApiIngressValidator: Validator = {
  name: "gateway-api-ingress",
  description:
    "Use Gateway API (HTTPRoute) for ingress instead of legacy Ingress (DS008).",

  validate(artifact: Artifact): ValidationResult {
    const content = artifact.content;
    const isIngress =
      /^kind:\s*Ingress\s*$/m.test(content) &&
      /^apiVersion:\s*networking\.k8s\.io/m.test(content);

    if (!isIngress) {
      return {
        passed: true,
        message:
          "Not a legacy Ingress resource — gateway-api-ingress check skipped.",
        severity: "info",
      };
    }

    return {
      passed: false,
      message:
        "Uses legacy Ingress resource. AKS Automatic includes a managed Gateway controller — use HTTPRoute instead.",
      severity: "error",
      fix: "Replace the Ingress resource with a Gateway API HTTPRoute. See https://learn.microsoft.com/azure/aks/istio-deploy-ingress.",
    };
  },
};
