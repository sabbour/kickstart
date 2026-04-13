/**
 * @module @kickstart/core/__tests__/validation-safeguards
 *
 * Tests for AKS Automatic deployment safeguard validators (DS003–DS013),
 * auto-fix system, and post-generation injection via validateAndFixArtifacts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Artifact } from "../artifacts/types.js";
import { InMemoryArtifactStore } from "../artifacts/in-memory.js";
import { ValidationEngine } from "../validation/engine.js";
import {
  createDefaultValidationEngine,
  validateAndFixArtifacts,
} from "../validation/index.js";
import { runAsNonRootValidator } from "../validation/validators/run-as-non-root.js";
import { noPrivilegeEscalationValidator } from "../validation/validators/no-privilege-escalation.js";
import { noHostNetworkingValidator } from "../validation/validators/no-host-networking.js";
import { readOnlyRootFsValidator } from "../validation/validators/read-only-root-fs.js";
import { gatewayApiIngressValidator } from "../validation/validators/gateway-api-ingress.js";
import { noImagePullSecretsValidator } from "../validation/validators/no-image-pull-secrets.js";
import { resourceQuotasValidator } from "../validation/validators/resource-quotas.js";
import { networkPoliciesValidator } from "../validation/validators/network-policies.js";
import { podDisruptionBudgetValidator } from "../validation/validators/pod-disruption-budget.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeArtifact(path: string, content: string): Artifact {
  const now = new Date();
  return { path, content, language: "yaml", createdAt: now, updatedAt: now };
}

// A fully compliant deployment with all security contexts
const DEPLOYMENT_FULLY_HARDENED = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: my-app
          image: myregistry.azurecr.io/my-app:v1.0.0
          ports:
            - containerPort: 3000
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
`;

const DEPLOYMENT_BARE = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: myregistry.azurecr.io/my-app:v1.0.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
`;

const DEPLOYMENT_PRODUCTION = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: myregistry.azurecr.io/my-app:v1.0.0
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "1000m"
              memory: "1Gi"
`;

const DOCKERFILE = `FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
`;

const SERVICE_YAML = `apiVersion: v1
kind: Service
metadata:
  name: my-app
  namespace: my-app
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
`;

const INGRESS_YAML = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  namespace: my-app
  annotations:
    kubernetes.io/ingress.class: webapprouting.kubernetes.azure.com
spec:
  rules:
    - host: my-app.eastus.cloudapp.azure.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
`;

const HTTPROUTE_YAML = `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: my-app
  namespace: my-app
spec:
  parentRefs:
    - name: my-gateway
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: my-app
          port: 80
`;

// ---------------------------------------------------------------------------
// DS003 — run-as-non-root
// ---------------------------------------------------------------------------

describe("runAsNonRootValidator (DS003)", () => {
  it("passes when runAsNonRoot: true is set in pod securityContext", () => {
    const result = runAsNonRootValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when runAsNonRoot is not set", () => {
    const result = runAsNonRootValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.fix).toBeDefined();
  });

  it("fails when runAsNonRoot is explicitly false", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      securityContext:\n        runAsNonRoot: false\n      containers:",
    );
    const result = runAsNonRootValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("skips non-Deployment manifests", () => {
    const result = runAsNonRootValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("skips non-K8s files", () => {
    const result = runAsNonRootValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS003 — auto-fix
// ---------------------------------------------------------------------------

describe("runAsNonRootValidator autoFix", () => {
  it("injects securityContext with runAsNonRoot before containers:", () => {
    const fixed = runAsNonRootValidator.autoFix!(DEPLOYMENT_BARE);
    expect(fixed).not.toBeNull();
    expect(fixed!).toContain("runAsNonRoot: true");
    expect(fixed!).toContain("securityContext:");
  });

  it("returns null when already compliant", () => {
    const fixed = runAsNonRootValidator.autoFix!(DEPLOYMENT_FULLY_HARDENED);
    expect(fixed).toBeNull();
  });

  it("returns null for non-Deployment content", () => {
    const fixed = runAsNonRootValidator.autoFix!(SERVICE_YAML);
    expect(fixed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DS004 — no-privilege-escalation
// ---------------------------------------------------------------------------

describe("noPrivilegeEscalationValidator (DS004)", () => {
  it("passes when allowPrivilegeEscalation: false is set", () => {
    const result = noPrivilegeEscalationValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when allowPrivilegeEscalation is not set", () => {
    const result = noPrivilegeEscalationValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.fix).toBeDefined();
  });

  it("fails when allowPrivilegeEscalation is true", () => {
    const content = DEPLOYMENT_BARE.replace(
      "          resources:",
      "          securityContext:\n            allowPrivilegeEscalation: true\n          resources:",
    );
    const result = noPrivilegeEscalationValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("true");
  });

  it("skips non-Deployment manifests", () => {
    const result = noPrivilegeEscalationValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });
});

// ---------------------------------------------------------------------------
// DS004 — auto-fix
// ---------------------------------------------------------------------------

describe("noPrivilegeEscalationValidator autoFix", () => {
  it("flips allowPrivilegeEscalation from true to false", () => {
    const content = DEPLOYMENT_BARE.replace(
      "          resources:",
      "          securityContext:\n            allowPrivilegeEscalation: true\n          resources:",
    );
    const fixed = noPrivilegeEscalationValidator.autoFix!(content);
    expect(fixed).not.toBeNull();
    expect(fixed!).toContain("allowPrivilegeEscalation: false");
    expect(fixed!).not.toContain("allowPrivilegeEscalation: true");
  });

  it("returns null when already compliant", () => {
    const fixed = noPrivilegeEscalationValidator.autoFix!(DEPLOYMENT_FULLY_HARDENED);
    expect(fixed).toBeNull();
  });

  it("returns null for non-Deployment content", () => {
    const fixed = noPrivilegeEscalationValidator.autoFix!(SERVICE_YAML);
    expect(fixed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DS005 — no-host-networking
// ---------------------------------------------------------------------------

describe("noHostNetworkingValidator (DS005)", () => {
  it("passes when no host networking is used", () => {
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when hostNetwork: true is set", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      containers:",
    );
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("hostNetwork");
  });

  it("fails when hostPID: true is set", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostPID: true\n      containers:",
    );
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("hostPID");
  });

  it("fails when hostIPC: true is set", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostIPC: true\n      containers:",
    );
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("hostIPC");
  });

  it("reports multiple host namespace violations together", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      hostPID: true\n      hostIPC: true\n      containers:",
    );
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("hostNetwork");
    expect(result.message).toContain("hostPID");
    expect(result.message).toContain("hostIPC");
  });

  it("passes when host fields are explicitly false", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: false\n      hostPID: false\n      containers:",
    );
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("skips non-Deployment manifests", () => {
    const result = noHostNetworkingValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS005 — auto-fix
// ---------------------------------------------------------------------------

describe("noHostNetworkingValidator autoFix", () => {
  it("flips hostNetwork from true to false", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      containers:",
    );
    const fixed = noHostNetworkingValidator.autoFix!(content);
    expect(fixed).not.toBeNull();
    expect(fixed!).toContain("hostNetwork: false");
  });

  it("flips all three host flags", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      hostPID: true\n      hostIPC: true\n      containers:",
    );
    const fixed = noHostNetworkingValidator.autoFix!(content);
    expect(fixed).not.toBeNull();
    expect(fixed!).toContain("hostNetwork: false");
    expect(fixed!).toContain("hostPID: false");
    expect(fixed!).toContain("hostIPC: false");
  });

  it("returns null when no host flags are true", () => {
    const fixed = noHostNetworkingValidator.autoFix!(DEPLOYMENT_FULLY_HARDENED);
    expect(fixed).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// DS007 — read-only-root-fs
// ---------------------------------------------------------------------------

describe("readOnlyRootFsValidator (DS007)", () => {
  it("passes when readOnlyRootFilesystem: true is set", () => {
    const result = readOnlyRootFsValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails with warning when readOnlyRootFilesystem is not set", () => {
    const result = readOnlyRootFsValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.fix).toBeDefined();
  });

  it("skips non-Deployment manifests", () => {
    const result = readOnlyRootFsValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });

  it("skips Dockerfiles", () => {
    const result = readOnlyRootFsValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS008 — gateway-api-ingress
// ---------------------------------------------------------------------------

describe("gatewayApiIngressValidator (DS008)", () => {
  it("fails when a legacy Ingress resource is used", () => {
    const result = gatewayApiIngressValidator.validate(
      makeArtifact("k8s/ingress.yaml", INGRESS_YAML),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("Ingress");
    expect(result.message).toContain("HTTPRoute");
    expect(result.fix).toBeDefined();
  });

  it("passes for HTTPRoute resources", () => {
    const result = gatewayApiIngressValidator.validate(
      makeArtifact("k8s/httproute.yaml", HTTPROUTE_YAML),
    );
    expect(result.passed).toBe(true);
  });

  it("passes for Deployment manifests", () => {
    const result = gatewayApiIngressValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("passes for non-K8s files", () => {
    const result = gatewayApiIngressValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes for Services", () => {
    const result = gatewayApiIngressValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS010 — no-image-pull-secrets
// ---------------------------------------------------------------------------

describe("noImagePullSecretsValidator (DS010)", () => {
  it("passes when no imagePullSecrets are used", () => {
    const result = noImagePullSecretsValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when imagePullSecrets is present", () => {
    const content = DEPLOYMENT_BARE.replace(
      "      containers:",
      "      imagePullSecrets:\n        - name: my-secret\n      containers:",
    );
    const result = noImagePullSecretsValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("imagePullSecrets");
    expect(result.message).toContain("ACR");
  });

  it("skips non-K8s files", () => {
    const result = noImagePullSecretsValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS011 — resource-quotas
// ---------------------------------------------------------------------------

describe("resourceQuotasValidator (DS011)", () => {
  it("skips non-production Deployments (replicas < 3)", () => {
    const result = resourceQuotasValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("warns for production-tier Deployments (replicas >= 3)", () => {
    const result = resourceQuotasValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_PRODUCTION),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("ResourceQuota");
  });

  it("skips non-Deployment manifests", () => {
    const result = resourceQuotasValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS012 — network-policies
// ---------------------------------------------------------------------------

describe("networkPoliciesValidator (DS012)", () => {
  it("skips non-production Deployments", () => {
    const result = networkPoliciesValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(true);
  });

  it("warns for production-tier Deployments", () => {
    const result = networkPoliciesValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_PRODUCTION),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("NetworkPolicy");
  });

  it("skips non-Deployment manifests", () => {
    const result = networkPoliciesValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DS013 — pod-disruption-budget
// ---------------------------------------------------------------------------

describe("podDisruptionBudgetValidator (DS013)", () => {
  it("skips non-production Deployments", () => {
    const result = podDisruptionBudgetValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    expect(result.passed).toBe(true);
  });

  it("warns for production-tier Deployments", () => {
    const result = podDisruptionBudgetValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_PRODUCTION),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("PodDisruptionBudget");
  });

  it("skips Services", () => {
    const result = podDisruptionBudgetValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });

  it("skips non-K8s files", () => {
    const result = podDisruptionBudgetValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ValidationEngine.applyAutoFixes
// ---------------------------------------------------------------------------

describe("ValidationEngine.applyAutoFixes", () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
    engine.register(runAsNonRootValidator);
    engine.register(noPrivilegeEscalationValidator);
    engine.register(noHostNetworkingValidator);
  });

  it("chains multiple auto-fixes on a single artifact", () => {
    const content = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      containers:",
    );
    const artifact = makeArtifact("k8s/deployment.yaml", content);
    const { content: fixed, appliedFixes } = engine.applyAutoFixes(artifact);

    expect(appliedFixes).toContain("run-as-non-root");
    expect(appliedFixes).toContain("no-host-networking");
    expect(fixed).toContain("runAsNonRoot: true");
    expect(fixed).toContain("hostNetwork: false");
  });

  it("returns original content when no fixes apply", () => {
    const artifact = makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED);
    const { content: fixed, appliedFixes } = engine.applyAutoFixes(artifact);

    expect(appliedFixes).toHaveLength(0);
    expect(fixed).toBe(DEPLOYMENT_FULLY_HARDENED);
  });

  it("returns original for non-K8s artifacts", () => {
    const artifact = makeArtifact("Dockerfile", DOCKERFILE);
    const { content: fixed, appliedFixes } = engine.applyAutoFixes(artifact);

    expect(appliedFixes).toHaveLength(0);
    expect(fixed).toBe(DOCKERFILE);
  });

  it("only includes validators that have autoFix method", () => {
    engine.register(readOnlyRootFsValidator); // no autoFix
    const artifact = makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE);
    const { appliedFixes } = engine.applyAutoFixes(artifact);

    // readOnlyRootFsValidator has no autoFix, so it should not appear
    expect(appliedFixes).not.toContain("read-only-root-fs");
  });
});

// ---------------------------------------------------------------------------
// createDefaultValidationEngine — full DS coverage
// ---------------------------------------------------------------------------

describe("createDefaultValidationEngine (full DS coverage)", () => {
  it("registers all 16 validators", () => {
    const engine = createDefaultValidationEngine();
    // 7 original + 9 new = 16
    expect(engine.registeredValidators.length).toBe(16);
  });

  it("validates a fully hardened Deployment with zero errors", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED),
    );
    expect(report.hasErrors).toBe(false);
  });

  it("flags a bare Deployment for security hardening issues", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_BARE),
    );
    // Missing: health-probes, run-as-non-root, no-privilege-escalation, read-only-root-fs
    expect(report.hasErrors).toBe(true);
    const errors = report.results.filter((r) => !r.passed && r.severity === "error");
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("flags legacy Ingress resource", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/ingress.yaml", INGRESS_YAML),
    );
    expect(report.hasErrors).toBe(true);
    const ingressError = report.results.find(
      (r) => !r.passed && r.message.includes("Ingress"),
    );
    expect(ingressError).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateAndFixArtifacts — post-generation injection
// ---------------------------------------------------------------------------

describe("validateAndFixArtifacts (post-generation injection)", () => {
  it("auto-fixes artifacts in the store and returns reports", () => {
    const store = new InMemoryArtifactStore();
    // Put a bare deployment that will trigger auto-fixes
    const deploymentWithHostNet = DEPLOYMENT_BARE.replace(
      "    spec:\n      containers:",
      "    spec:\n      hostNetwork: true\n      containers:",
    );
    store.put("k8s/deployment.yaml", deploymentWithHostNet, { language: "yaml" });
    store.put("k8s/service.yaml", SERVICE_YAML, { language: "yaml" });

    const reports = validateAndFixArtifacts(store);

    // Should have 2 reports (one per artifact)
    expect(reports).toHaveLength(2);

    // The deployment should have been auto-fixed
    const fixedDeployment = store.get("k8s/deployment.yaml");
    expect(fixedDeployment).not.toBeNull();
    expect(fixedDeployment!.content).toContain("hostNetwork: false");
    expect(fixedDeployment!.content).toContain("runAsNonRoot: true");

    // Metadata should record which fixes were applied
    expect(fixedDeployment!.metadata?.autoFixesApplied).toBeDefined();
    const fixes = fixedDeployment!.metadata!.autoFixesApplied as string[];
    expect(fixes).toContain("run-as-non-root");
    expect(fixes).toContain("no-host-networking");
  });

  it("leaves compliant artifacts unchanged", () => {
    const store = new InMemoryArtifactStore();
    store.put("k8s/deployment.yaml", DEPLOYMENT_FULLY_HARDENED, { language: "yaml" });

    const reports = validateAndFixArtifacts(store);

    expect(reports).toHaveLength(1);
    const fixedDeployment = store.get("k8s/deployment.yaml");
    expect(fixedDeployment!.content).toBe(DEPLOYMENT_FULLY_HARDENED);
    // No autoFixesApplied metadata since nothing was fixed
    expect(fixedDeployment!.metadata?.autoFixesApplied).toBeUndefined();
  });

  it("works with an empty store", () => {
    const store = new InMemoryArtifactStore();
    const reports = validateAndFixArtifacts(store);
    expect(reports).toHaveLength(0);
  });

  it("handles multiple artifacts including non-K8s files", () => {
    const store = new InMemoryArtifactStore();
    store.put("k8s/deployment.yaml", DEPLOYMENT_BARE, { language: "yaml" });
    store.put("Dockerfile", DOCKERFILE, { language: "dockerfile" });
    store.put("k8s/service.yaml", SERVICE_YAML, { language: "yaml" });

    const reports = validateAndFixArtifacts(store);
    expect(reports).toHaveLength(3);

    // Dockerfile should not be modified
    const dockerfile = store.get("Dockerfile");
    expect(dockerfile!.content).toBe(DOCKERFILE);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("validator edge cases", () => {
  it("handles empty artifact content gracefully", () => {
    const artifact = makeArtifact("empty.yaml", "");
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(artifact);
    // Should not throw — all validators return info/skip
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.hasErrors).toBe(false);
  });

  it("handles multi-container deployments", () => {
    const multiContainer = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  template:
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: app
          image: myregistry.azurecr.io/app:v1.0.0
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
        - name: sidecar
          image: myregistry.azurecr.io/sidecar:v2.0.0
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "100m"
              memory: "128Mi"
`;
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", multiContainer),
    );
    // Should pass most checks (resource limits ✓, probes on first container ✓, security ✓)
    const errors = report.results.filter((r) => !r.passed && r.severity === "error");
    // At most namespace-set might flag (no namespace on metadata)
    expect(errors.length).toBeLessThanOrEqual(2);
  });

  it("handles placeholders in image fields", () => {
    const withPlaceholder = DEPLOYMENT_FULLY_HARDENED.replace(
      "myregistry.azurecr.io/my-app:v1.0.0",
      "<IMAGE_PLACEHOLDER>",
    );
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", withPlaceholder),
    );
    // Placeholder should not trigger no-latest-tag
    const latestResult = report.results.find(
      (r) => r.message.includes(":latest") || r.message.includes("version tag"),
    );
    expect(latestResult?.passed ?? true).toBe(true);
  });
});
