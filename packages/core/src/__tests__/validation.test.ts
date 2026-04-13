/**
 * @module @kickstart/core/__tests__/validation
 *
 * Comprehensive tests for the client-side artifact validation system.
 * Covers each validator, the ValidationEngine, and the default engine factory.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Artifact } from "../artifacts/types.js";
import {
  ValidationEngine,
  createDefaultValidationEngine,
  resourceLimitsValidator,
  noLatestTagValidator,
  healthProbesValidator,
  noPrivilegedValidator,
  namespaceSetValidator,
  replicaCountValidator,
  imagePullPolicyValidator,
  ALL_RULES,
} from "../validation/index.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeArtifact(path: string, content: string): Artifact {
  const now = new Date();
  return { path, content, language: "yaml", createdAt: now, updatedAt: now };
}

const DEPLOYMENT_WITH_ALL_GOOD = `apiVersion: apps/v1
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
        version: v1.0.0
    spec:
      automountServiceAccountToken: false
      securityContext:
        runAsNonRoot: true
      containers:
        - name: my-app
          image: myregistry.azurecr.io/my-app:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 3000
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop:
                - ALL
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
              port: 3000
            initialDelaySeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
`;

const DEPLOYMENT_MINIMAL_BAD = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:latest
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

const DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "server.js"]
`;

// ---------------------------------------------------------------------------
// ValidationEngine
// ---------------------------------------------------------------------------

describe("ValidationEngine", () => {
  let engine: ValidationEngine;

  beforeEach(() => {
    engine = new ValidationEngine();
  });

  it("starts with no registered validators", () => {
    expect(engine.registeredValidators).toHaveLength(0);
  });

  it("register adds a validator", () => {
    engine.register(resourceLimitsValidator);
    expect(engine.registeredValidators).toHaveLength(1);
    expect(engine.registeredValidators[0].name).toBe("resource-limits");
  });

  it("register is idempotent — duplicate names are ignored", () => {
    engine.register(resourceLimitsValidator);
    engine.register(resourceLimitsValidator);
    expect(engine.registeredValidators).toHaveLength(1);
  });

  it("unregister removes a validator by name", () => {
    engine.register(resourceLimitsValidator);
    engine.register(noLatestTagValidator);
    engine.unregister("resource-limits");
    expect(engine.registeredValidators).toHaveLength(1);
    expect(engine.registeredValidators[0].name).toBe("no-latest-tag");
  });

  it("unregister is a no-op for unknown names", () => {
    engine.register(resourceLimitsValidator);
    expect(() => engine.unregister("nonexistent")).not.toThrow();
    expect(engine.registeredValidators).toHaveLength(1);
  });

  it("registeredValidators is a snapshot (immutable reference)", () => {
    engine.register(resourceLimitsValidator);
    const snap1 = engine.registeredValidators;
    engine.register(noLatestTagValidator);
    expect(snap1).toHaveLength(1); // original snapshot not mutated
  });

  it("validateArtifact returns one result per validator", () => {
    engine.register(resourceLimitsValidator);
    engine.register(noLatestTagValidator);
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(report.results).toHaveLength(2);
  });

  it("validateArtifact sets artifact path in report", () => {
    engine.register(resourceLimitsValidator);
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(report.artifact).toBe("k8s/deployment.yaml");
  });

  it("validateArtifact hasErrors is true when any error fails", () => {
    engine.register(resourceLimitsValidator);
    const artifact = makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD);
    const report = engine.validateArtifact(artifact);
    expect(report.hasErrors).toBe(true);
  });

  it("validateArtifact hasErrors is false when all pass", () => {
    engine.register(resourceLimitsValidator);
    const artifact = makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD);
    const report = engine.validateArtifact(artifact);
    expect(report.hasErrors).toBe(false);
  });

  it("validateArtifact hasWarnings tracks warning-severity failures", () => {
    engine.register(replicaCountValidator);
    const artifact = makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD);
    const report = engine.validateArtifact(artifact);
    expect(report.hasWarnings).toBe(true);
    expect(report.hasErrors).toBe(false);
  });

  it("validateAll returns one report per artifact", () => {
    engine.register(resourceLimitsValidator);
    const artifacts = [
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    ];
    const reports = engine.validateAll(artifacts);
    expect(reports).toHaveLength(2);
    expect(reports[0].artifact).toBe("k8s/deployment.yaml");
    expect(reports[1].artifact).toBe("k8s/service.yaml");
  });

  it("validateAll with empty array returns empty array", () => {
    engine.register(resourceLimitsValidator);
    expect(engine.validateAll([])).toHaveLength(0);
  });

  it("validateAll with no validators returns empty results per artifact", () => {
    const artifacts = [makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD)];
    const reports = engine.validateAll(artifacts);
    expect(reports[0].results).toHaveLength(0);
    expect(reports[0].hasErrors).toBe(false);
    expect(reports[0].hasWarnings).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createDefaultValidationEngine
// ---------------------------------------------------------------------------

describe("createDefaultValidationEngine", () => {
  it("registers all validators from ALL_RULES", () => {
    const engine = createDefaultValidationEngine();
    const names = engine.registeredValidators.map((v) => v.name);
    expect(names).toContain("resource-limits");
    expect(names).toContain("no-latest-tag");
    expect(names).toContain("health-probes");
    expect(names).toContain("no-privileged");
    expect(names).toContain("namespace-set");
    expect(names).toContain("replica-count");
    expect(names).toContain("image-pull-policy");
    expect(engine.registeredValidators).toHaveLength(ALL_RULES.length);
  });

  it("each call returns a fresh independent engine", () => {
    const a = createDefaultValidationEngine();
    const b = createDefaultValidationEngine();
    a.unregister("resource-limits");
    expect(b.registeredValidators.map((v) => v.name)).toContain("resource-limits");
  });
});

// ---------------------------------------------------------------------------
// resource-limits validator
// ---------------------------------------------------------------------------

describe("resourceLimitsValidator", () => {
  it("passes for Deployment with full resource block", () => {
    const result = resourceLimitsValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
  });

  it("fails for Deployment with no resources block", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.0
`;
    const result = resourceLimitsValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.fix).toBeDefined();
  });

  it("fails for Deployment with requests but no limits", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.0
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
`;
    const result = resourceLimitsValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("skips (passes) for a Service manifest", () => {
    const result = resourceLimitsValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("skips (passes) for a Dockerfile", () => {
    const result = resourceLimitsValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("result includes a fix hint on failure", () => {
    const result = resourceLimitsValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(result.fix).toBeTruthy();
    expect(typeof result.fix).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// no-latest-tag validator
// ---------------------------------------------------------------------------

describe("noLatestTagValidator", () => {
  it("passes for pinned version tags", () => {
    const content = `spec:
  containers:
    - image: myregistry.azurecr.io/my-app:v1.2.3`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("fails for explicit :latest tag", () => {
    const content = `spec:
  containers:
    - image: myapp:latest`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("myapp:latest");
  });

  it("fails for untagged image (implicit latest)", () => {
    const content = `spec:
  containers:
    - image: myregistry.azurecr.io/myapp`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("passes for image pinned with SHA digest", () => {
    const content = `spec:
  containers:
    - image: myapp@sha256:abc123def456`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("passes for <IMAGE_PLACEHOLDER> (generator placeholder)", () => {
    const content = `spec:
  containers:
    - image: <IMAGE_PLACEHOLDER>`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("skips (passes) for Dockerfile (no image: fields)", () => {
    const result = noLatestTagValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("reports all violating images in the message", () => {
    const content = `spec:
  containers:
    - image: app1:latest
    - image: app2:latest`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("app1:latest");
    expect(result.message).toContain("app2:latest");
  });

  it("passes for semver tag without v prefix", () => {
    const content = `spec:
  containers:
    - image: nginx:1.25.3`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("includes a fix hint on failure", () => {
    const content = `spec:
  containers:
    - image: myapp:latest`;
    const result = noLatestTagValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.fix).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// health-probes validator
// ---------------------------------------------------------------------------

describe("healthProbesValidator", () => {
  it("passes when both probes are defined", () => {
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when both probes are missing", () => {
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("both");
  });

  it("fails when only livenessProbe is missing", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
`;
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("livenessProbe");
  });

  it("fails when only readinessProbe is missing", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
`;
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("readinessProbe");
  });

  it("skips (passes) for a Service manifest", () => {
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("includes a fix hint on failure", () => {
    const result = healthProbesValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(result.fix).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// no-privileged validator
// ---------------------------------------------------------------------------

describe("noPrivilegedValidator", () => {
  it("passes for Deployment without privileged containers", () => {
    const result = noPrivilegedValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when privileged: true is set", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          securityContext:
            privileged: true
`;
    const result = noPrivilegedValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.fix).toBeDefined();
  });

  it("passes when privileged: false is set", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          securityContext:
            privileged: false
`;
    const result = noPrivilegedValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("skips (passes) for a Dockerfile", () => {
    const result = noPrivilegedValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("applies to non-Deployment K8s resources with containers", () => {
    const content = `apiVersion: v1
kind: Pod
metadata:
  name: privileged-pod
spec:
  containers:
    - name: container
      securityContext:
        privileged: true
`;
    const result = noPrivilegedValidator.validate(
      makeArtifact("pod.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });
});

// ---------------------------------------------------------------------------
// namespace-set validator
// ---------------------------------------------------------------------------

describe("namespaceSetValidator", () => {
  it("passes when a non-default namespace is specified", () => {
    const result = namespaceSetValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain("my-app");
  });

  it("fails when namespace is missing from metadata", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
`;
    const result = namespaceSetValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.fix).toBeDefined();
  });

  it("fails when namespace is 'default'", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
spec:
  replicas: 1
`;
    const result = namespaceSetValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
    expect(result.message).toContain("default");
  });

  it("passes for Service with non-default namespace", () => {
    const result = namespaceSetValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
  });

  it("skips (passes) for a Dockerfile", () => {
    const result = namespaceSetValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });
});

// ---------------------------------------------------------------------------
// replica-count validator
// ---------------------------------------------------------------------------

describe("replicaCountValidator", () => {
  it("passes for replicas: 2", () => {
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain("2");
  });

  it("fails (warning) for replicas: 1", () => {
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
  });

  it("fails (warning) when replicas is not specified", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  selector:
    matchLabels:
      app: my-app
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.0
`;
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("default");
  });

  it("passes for replicas: 3", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: my-app
`;
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
    expect(result.message).toContain("3");
  });

  it("skips (passes) for a Service", () => {
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("includes a fix hint on failure", () => {
    const result = replicaCountValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(result.fix).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// image-pull-policy validator
// ---------------------------------------------------------------------------

describe("imagePullPolicyValidator", () => {
  it("passes for imagePullPolicy: IfNotPresent", () => {
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(result.passed).toBe(true);
  });

  it("fails (warning) for imagePullPolicy: Always with pinned image", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.2.3
          imagePullPolicy: Always
`;
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.fix).toBeDefined();
  });

  it("passes for imagePullPolicy: Always with :latest image (expected)", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:latest
          imagePullPolicy: Always
`;
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    // Always with :latest is expected, so not a violation of this specific rule
    expect(result.passed).toBe(true);
  });

  it("passes for imagePullPolicy: Never", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.0
          imagePullPolicy: Never
`;
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when imagePullPolicy is not set (uses K8s default)", () => {
    const content = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
spec:
  template:
    spec:
      containers:
        - name: my-app
          image: myapp:v1.0
`;
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/deployment.yaml", content),
    );
    expect(result.passed).toBe(true);
  });

  it("skips (passes) for a Service", () => {
    const result = imagePullPolicyValidator.validate(
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("skips (passes) for a Dockerfile", () => {
    const result = imagePullPolicyValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Full-stack integration: default engine on a well-formed Deployment
// ---------------------------------------------------------------------------

describe("default engine — full deployment validation", () => {
  it("all validators pass on a fully-compliant Deployment", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
    );
    expect(report.hasErrors).toBe(false);
    expect(report.hasWarnings).toBe(false);
    expect(report.results).toHaveLength(ALL_RULES.length);
    expect(report.results.every((r) => r.passed)).toBe(true);
  });

  it("errors and warnings are detected on a minimal bad Deployment", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_MINIMAL_BAD),
    );
    expect(report.hasErrors).toBe(true);
    expect(report.hasWarnings).toBe(true);
  });

  it("non-K8s artifact (Dockerfile) passes all validators cleanly", () => {
    const engine = createDefaultValidationEngine();
    const report = engine.validateArtifact(makeArtifact("Dockerfile", DOCKERFILE));
    expect(report.hasErrors).toBe(false);
    expect(report.hasWarnings).toBe(false);
    expect(report.results.every((r) => r.passed)).toBe(true);
  });

  it("validateAll returns reports for multiple artifacts", () => {
    const engine = createDefaultValidationEngine();
    const artifacts = [
      makeArtifact("k8s/deployment.yaml", DEPLOYMENT_WITH_ALL_GOOD),
      makeArtifact("k8s/service.yaml", SERVICE_YAML),
      makeArtifact("Dockerfile", DOCKERFILE),
    ];
    const reports = engine.validateAll(artifacts);
    expect(reports).toHaveLength(3);
    expect(reports.every((r) => !r.hasErrors)).toBe(true);
  });
});
