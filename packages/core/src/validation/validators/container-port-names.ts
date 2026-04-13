/**
 * @module @kickstart/core/validation/validators/container-port-names
 *
 * DS014 — Container ports should have names for service discovery
 * and Gateway API HTTPRoute routing.
 */

import type { Artifact } from "../../artifacts/types.js";
import type { Validator, ValidationResult } from "../types.js";

function isDeployment(content: string): boolean {
  return /^kind:\s*Deployment\s*$/m.test(content);
}

export const containerPortNamesValidator: Validator = {
  name: "container-port-names",
  description:
    "Container ports should have names for service discovery and Gateway API routing (DS014).",

  validate(artifact: Artifact): ValidationResult {
    if (!isDeployment(artifact.content)) {
      return {
        passed: true,
        message: "Not a Deployment manifest — container-port-names check skipped.",
        severity: "info",
      };
    }

    const content = artifact.content;
    const portBlocks = content.match(/^\s+- containerPort:\s*\d+/gm);
    if (!portBlocks || portBlocks.length === 0) {
      return {
        passed: true,
        message: "No container ports defined — check skipped.",
        severity: "info",
      };
    }

    const hasNamedPorts = /^\s+name:\s*\S+/m.test(content);
    const namedPortCount = (content.match(/^\s+name:\s*(http|grpc|https|tcp|udp)\S*/gm) ?? []).length;

    if (namedPortCount < portBlocks.length) {
      return {
        passed: false,
        message:
          "Some container ports are missing names. Named ports improve service discovery and are required for Gateway API HTTPRoute routing.",
        severity: "warning",
        fix: "Add a 'name' field (e.g. 'http', 'grpc') to each containerPort entry.",
      };
    }

    return {
      passed: true,
      message: "All container ports have names.",
      severity: "info",
    };
  },
};
