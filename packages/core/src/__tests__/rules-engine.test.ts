/**
 * @module @kickstart/core/__tests__/rules-engine
 *
 * Tests for the RulesEngine layer (categorised filtering, AKS constraint
 * mapping, discovery APIs) and all 7 new validators (DS014–DS020).
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { Artifact } from "../artifacts/types.js";
import { InMemoryArtifactStore } from "../artifacts/in-memory.js";
import { RulesEngine } from "../validation/rules-engine.js";
import {
  createDefaultRulesEngine,
  createDefaultValidationEngine,
  ALL_RULES,
  validateAndFixArtifacts,
} from "../validation/index.js";
import { containerPortNamesValidator } from "../validation/validators/container-port-names.js";
import { dropAllCapabilitiesValidator } from "../validation/validators/drop-all-capabilities.js";
import { noHostPidValidator } from "../validation/validators/no-host-pid.js";
import { noHostIpcValidator } from "../validation/validators/no-host-ipc.js";
import { serviceAccountTokenValidator } from "../validation/validators/service-account-token.js";
import { labelRequirementsValidator } from "../validation/validators/label-requirements.js";
import { topologySpreadConstraintsValidator } from "../validation/validators/topology-spread-constraints.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeArtifact(path: string, content: string): Artifact {
  const now = new Date();
  return { path, content, language: "yaml", createdAt: now, updatedAt: now };
}

// A minimal Deployment for testing
const MINIMAL_DEPLOYMENT = `apiVersion: apps/v1
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
`;

// A fully hardened Deployment for DS014–DS020
const FULLY_HARDENED = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: my-app
  labels:
    app: my-app
    version: v1.0.0
spec:
  replicas: 3
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
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: my-app
      containers:
        - name: my-app
          image: myregistry.azurecr.io/my-app:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
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
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
          readinessProbe:
            httpGet:
              path: /readyz
              port: 3000
`;

// Dockerfile (non-applicable for all K8s validators)
const DOCKERFILE = `FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "index.js"]
`;

// ==========================================================================
// RulesEngine — core engine tests
// ==========================================================================
describe("RulesEngine — core", () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = new RulesEngine();
  });

  it("starts with zero rules", () => {
    expect(engine.rules).toHaveLength(0);
  });

  it("registers a rule", () => {
    engine.register(ALL_RULES[0]);
    expect(engine.rules).toHaveLength(1);
    expect(engine.rules[0].validator.name).toBe("resource-limits");
  });

  it("prevents duplicate registration (same validator name)", () => {
    engine.register(ALL_RULES[0]);
    engine.register(ALL_RULES[0]);
    expect(engine.rules).toHaveLength(1);
  });

  it("unregisters a rule by name", () => {
    engine.register(ALL_RULES[0]);
    engine.unregister("resource-limits");
    expect(engine.rules).toHaveLength(0);
  });

  it("unregister is a no-op for unknown names", () => {
    engine.unregister("does-not-exist");
    expect(engine.rules).toHaveLength(0);
  });

  it("exposes the inner ValidationEngine", () => {
    engine.register(ALL_RULES[0]);
    expect(engine.engine.registeredValidators).toHaveLength(1);
  });
});

// ==========================================================================
// RulesEngine — discovery APIs
// ==========================================================================
describe("RulesEngine — discovery", () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = createDefaultRulesEngine();
  });

  it("getByCategory('security') returns security rules", () => {
    const secRules = engine.getByCategory("security");
    expect(secRules.length).toBeGreaterThanOrEqual(7);
    for (const rule of secRules) {
      expect(rule.category).toBe("security");
    }
  });

  it("getByCategory('reliability') returns reliability rules", () => {
    const relRules = engine.getByCategory("reliability");
    expect(relRules.length).toBeGreaterThanOrEqual(4);
    for (const rule of relRules) {
      expect(rule.category).toBe("reliability");
    }
  });

  it("getByCategory('networking') returns networking rules", () => {
    const netRules = engine.getByCategory("networking");
    expect(netRules.length).toBeGreaterThanOrEqual(2);
  });

  it("getByCategory('best-practices') returns best-practices rules", () => {
    const bpRules = engine.getByCategory("best-practices");
    expect(bpRules.length).toBeGreaterThanOrEqual(4);
  });

  it("getByTag('container') finds container-scoped rules", () => {
    const containerRules = engine.getByTag("container");
    expect(containerRules.length).toBeGreaterThanOrEqual(5);
  });

  it("getByTag('security-context') finds security-context rules", () => {
    const scRules = engine.getByTag("security-context");
    expect(scRules.length).toBeGreaterThanOrEqual(5);
  });

  it("getByTag returns empty array for unknown tag", () => {
    expect(engine.getByTag("nonexistent-tag")).toHaveLength(0);
  });

  it("getAksConstraints() returns all AKS-mapped rules", () => {
    const aksRules = engine.getAksConstraints();
    expect(aksRules.length).toBeGreaterThanOrEqual(10);
    for (const rule of aksRules) {
      expect(rule.aksConstraint).toBeDefined();
    }
  });

  it("getAksConstraints('pod-security-standards') filters by family", () => {
    const pss = engine.getAksConstraints("pod-security-standards");
    expect(pss.length).toBeGreaterThanOrEqual(5);
    for (const rule of pss) {
      expect(rule.aksConstraint).toBe("pod-security-standards");
    }
  });

  it("getAksConstraints('workload-identity') returns WI rules", () => {
    const wi = engine.getAksConstraints("workload-identity");
    expect(wi.length).toBeGreaterThanOrEqual(2);
  });

  it("getAutoFixRules() returns rules with autoFix", () => {
    const fixRules = engine.getAutoFixRules();
    expect(fixRules.length).toBeGreaterThanOrEqual(7);
    for (const rule of fixRules) {
      expect(rule.autoFixAvailable).toBe(true);
    }
  });

  it("getRule() finds rule by validator name", () => {
    const rule = engine.getRule("resource-limits");
    expect(rule).toBeDefined();
    expect(rule!.category).toBe("reliability");
  });

  it("getRule() returns undefined for unknown name", () => {
    expect(engine.getRule("does-not-exist")).toBeUndefined();
  });
});

// ==========================================================================
// RulesEngine — summary
// ==========================================================================
describe("RulesEngine — summary", () => {
  it("getSummary() returns correct aggregate stats", () => {
    const engine = createDefaultRulesEngine();
    const summary = engine.getSummary();

    expect(summary.totalRules).toBe(23);
    expect(summary.byCategory.security).toBeGreaterThanOrEqual(7);
    expect(summary.byCategory.reliability).toBeGreaterThanOrEqual(4);
    expect(summary.byCategory.networking).toBeGreaterThanOrEqual(2);
    expect(summary.byCategory["best-practices"]).toBeGreaterThanOrEqual(4);
    expect(summary.withAutoFix).toBeGreaterThanOrEqual(7);
    expect(summary.withAksConstraint).toBeGreaterThanOrEqual(10);
  });
});

// ==========================================================================
// RulesEngine — categorised validation
// ==========================================================================
describe("RulesEngine — categorised validation", () => {
  let engine: RulesEngine;

  beforeEach(() => {
    engine = createDefaultRulesEngine();
  });

  it("validateWithCategories groups results by category", () => {
    const artifact = makeArtifact("k8s/deployment.yaml", FULLY_HARDENED);
    const report = engine.validateWithCategories(artifact);

    expect(report.resultsByCategory).toBeDefined();
    expect(report.resultsByCategory.security).toBeInstanceOf(Array);
    expect(report.resultsByCategory.reliability).toBeInstanceOf(Array);
    expect(report.resultsByCategory.networking).toBeInstanceOf(Array);
    expect(report.resultsByCategory["best-practices"]).toBeInstanceOf(Array);

    // Total results should equal sum of all categories
    const totalCategorised =
      report.resultsByCategory.security.length +
      report.resultsByCategory.reliability.length +
      report.resultsByCategory.networking.length +
      report.resultsByCategory["best-practices"].length;
    expect(report.results.length).toBe(totalCategorised);
  });

  it("validateWithCategories returns 23 results for a deployment", () => {
    const artifact = makeArtifact("k8s/deployment.yaml", FULLY_HARDENED);
    const report = engine.validateWithCategories(artifact);
    expect(report.results).toHaveLength(23);
  });

  it("non-deployment gets all-pass info results", () => {
    const artifact = makeArtifact("Dockerfile", DOCKERFILE);
    const report = engine.validateWithCategories(artifact);
    const failures = report.results.filter((r) => !r.passed);
    expect(failures).toHaveLength(0);
  });

  it("delegates applyAutoFixes to inner engine", () => {
    const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      hostPID: true
      containers:
        - name: test
          image: test:v1
`;
    const artifact = makeArtifact("k8s/deployment.yaml", deployment);
    const { content, appliedFixes } = engine.applyAutoFixes(artifact);
    // At least some auto-fixes should have been applied
    expect(appliedFixes.length).toBeGreaterThan(0);
    // hostPID should be removed by the auto-fix chain
    expect(content).not.toContain("hostPID: true");
  });
});

// ==========================================================================
// ALL_RULES registry
// ==========================================================================
describe("ALL_RULES registry", () => {
  it("has exactly 23 rules", () => {
    expect(ALL_RULES).toHaveLength(23);
  });

  it("all rules have unique validator names", () => {
    const names = ALL_RULES.map((r) => r.validator.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("all rules have a valid category", () => {
    for (const rule of ALL_RULES) {
      expect(["security", "reliability", "networking", "best-practices"]).toContain(
        rule.category,
      );
    }
  });

  it("all rules have at least one tag", () => {
    for (const rule of ALL_RULES) {
      expect(rule.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("autoFixAvailable matches presence of autoFix method", () => {
    for (const rule of ALL_RULES) {
      if (rule.autoFixAvailable) {
        expect(typeof rule.validator.autoFix).toBe("function");
      }
    }
  });
});

// ==========================================================================
// createDefaultValidationEngine — backward compat
// ==========================================================================
describe("createDefaultValidationEngine — backward compatibility", () => {
  it("registers all 23 validators", () => {
    const engine = createDefaultValidationEngine();
    expect(engine.registeredValidators).toHaveLength(23);
  });

  it("validateAndFixArtifacts works with 23 validators", () => {
    const store = new InMemoryArtifactStore();
    store.put("k8s/deployment.yaml", FULLY_HARDENED, { language: "yaml" });
    const reports = validateAndFixArtifacts(store);
    expect(reports).toHaveLength(1);
    expect(reports[0].results).toHaveLength(23);
  });
});

// ==========================================================================
// DS014 — container-port-names
// ==========================================================================
describe("DS014 — container-port-names", () => {
  it("skips non-Deployment artifacts", () => {
    const result = containerPortNamesValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("passes when all ports have names", () => {
    const result = containerPortNamesValidator.validate(
      makeArtifact("k8s/deployment.yaml", FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("warns when ports lack names", () => {
    const result = containerPortNamesValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.fix).toBeDefined();
  });

  it("skips deployment with no ports at all", () => {
    const noPorts = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker
spec:
  template:
    spec:
      containers:
        - name: worker
          image: worker:v1
`;
    const result = containerPortNamesValidator.validate(
      makeArtifact("k8s/deployment.yaml", noPorts),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });
});

// ==========================================================================
// DS015 — drop-all-capabilities
// ==========================================================================
describe("DS015 — drop-all-capabilities", () => {
  it("skips non-Deployment artifacts", () => {
    const result = dropAllCapabilitiesValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when capabilities.drop includes ALL", () => {
    const result = dropAllCapabilitiesValidator.validate(
      makeArtifact("k8s/deployment.yaml", FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when no capabilities.drop block", () => {
    const result = dropAllCapabilitiesValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("fails when drop list exists but no ALL", () => {
    const partial = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      containers:
        - name: test
          image: test:v1
          securityContext:
            capabilities:
              drop:
                - NET_RAW
`;
    const result = dropAllCapabilitiesValidator.validate(
      makeArtifact("k8s/deployment.yaml", partial),
    );
    expect(result.passed).toBe(false);
  });

  it("autoFix injects capabilities block after allowPrivilegeEscalation", () => {
    const input = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      containers:
        - name: test
          image: test:v1
          securityContext:
            allowPrivilegeEscalation: false
`;
    const fixed = dropAllCapabilitiesValidator.autoFix!(input);
    expect(fixed).not.toBeNull();
    expect(fixed).toContain("capabilities:");
    expect(fixed).toContain("drop:");
    expect(fixed).toContain("- ALL");
  });

  it("autoFix returns null when already compliant", () => {
    const fixed = dropAllCapabilitiesValidator.autoFix!(FULLY_HARDENED);
    expect(fixed).toBeNull();
  });

  it("autoFix returns null for non-Deployment", () => {
    const fixed = dropAllCapabilitiesValidator.autoFix!(DOCKERFILE);
    expect(fixed).toBeNull();
  });
});

// ==========================================================================
// DS016 — no-host-pid
// ==========================================================================
describe("DS016 — no-host-pid", () => {
  it("skips non-Deployment artifacts", () => {
    const result = noHostPidValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when hostPID is absent", () => {
    const result = noHostPidValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when hostPID is true", () => {
    const bad = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      hostPID: true
      containers:
        - name: test
          image: test:v1
`;
    const result = noHostPidValidator.validate(
      makeArtifact("k8s/deployment.yaml", bad),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("autoFix removes hostPID: true", () => {
    const bad = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      hostPID: true
      containers:
        - name: test
          image: test:v1
`;
    const fixed = noHostPidValidator.autoFix!(bad);
    expect(fixed).not.toBeNull();
    expect(fixed).not.toContain("hostPID");
  });

  it("autoFix returns null when already compliant", () => {
    const fixed = noHostPidValidator.autoFix!(MINIMAL_DEPLOYMENT);
    expect(fixed).toBeNull();
  });
});

// ==========================================================================
// DS017 — no-host-ipc
// ==========================================================================
describe("DS017 — no-host-ipc", () => {
  it("skips non-Deployment artifacts", () => {
    const result = noHostIpcValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when hostIPC is absent", () => {
    const result = noHostIpcValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(true);
  });

  it("fails when hostIPC is true", () => {
    const bad = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      hostIPC: true
      containers:
        - name: test
          image: test:v1
`;
    const result = noHostIpcValidator.validate(
      makeArtifact("k8s/deployment.yaml", bad),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("error");
  });

  it("autoFix removes hostIPC: true", () => {
    const bad = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  template:
    spec:
      hostIPC: true
      containers:
        - name: test
          image: test:v1
`;
    const fixed = noHostIpcValidator.autoFix!(bad);
    expect(fixed).not.toBeNull();
    expect(fixed).not.toContain("hostIPC");
  });

  it("autoFix returns null when already compliant", () => {
    const fixed = noHostIpcValidator.autoFix!(MINIMAL_DEPLOYMENT);
    expect(fixed).toBeNull();
  });
});

// ==========================================================================
// DS018 — service-account-token
// ==========================================================================
describe("DS018 — service-account-token", () => {
  it("skips non-Deployment artifacts", () => {
    const result = serviceAccountTokenValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when automountServiceAccountToken is false", () => {
    const result = serviceAccountTokenValidator.validate(
      makeArtifact("k8s/deployment.yaml", FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("warns when automountServiceAccountToken is not set", () => {
    const result = serviceAccountTokenValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
  });

  it("autoFix adds automountServiceAccountToken: false", () => {
    const fixed = serviceAccountTokenValidator.autoFix!(MINIMAL_DEPLOYMENT);
    expect(fixed).not.toBeNull();
    expect(fixed).toContain("automountServiceAccountToken: false");
  });

  it("autoFix returns null when already set", () => {
    const fixed = serviceAccountTokenValidator.autoFix!(FULLY_HARDENED);
    expect(fixed).toBeNull();
  });

  it("autoFix returns null for non-Deployment", () => {
    const fixed = serviceAccountTokenValidator.autoFix!(DOCKERFILE);
    expect(fixed).toBeNull();
  });
});

// ==========================================================================
// DS019 — label-requirements
// ==========================================================================
describe("DS019 — label-requirements", () => {
  it("skips non-Deployment artifacts", () => {
    const result = labelRequirementsValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("passes when app and version labels are present", () => {
    const result = labelRequirementsValidator.validate(
      makeArtifact("k8s/deployment.yaml", FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("warns when app label is missing", () => {
    const noApp = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
  labels:
    version: v1.0.0
spec:
  template:
    metadata:
      labels:
        version: v1.0.0
    spec:
      containers:
        - name: test
          image: test:v1
`;
    const result = labelRequirementsValidator.validate(
      makeArtifact("k8s/deployment.yaml", noApp),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("app");
  });

  it("warns when version label is missing", () => {
    const result = labelRequirementsValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(false);
    expect(result.message).toContain("version");
  });

  it("passes with app.kubernetes.io labels", () => {
    const k8sLabels = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
  labels:
    app.kubernetes.io/name: test
    app.kubernetes.io/version: v1.0.0
spec:
  template:
    metadata:
      labels:
        app.kubernetes.io/name: test
        app.kubernetes.io/version: v1.0.0
    spec:
      containers:
        - name: test
          image: test:v1
`;
    const result = labelRequirementsValidator.validate(
      makeArtifact("k8s/deployment.yaml", k8sLabels),
    );
    expect(result.passed).toBe(true);
  });
});

// ==========================================================================
// DS020 — topology-spread-constraints
// ==========================================================================
describe("DS020 — topology-spread-constraints", () => {
  it("skips non-Deployment artifacts", () => {
    const result = topologySpreadConstraintsValidator.validate(
      makeArtifact("Dockerfile", DOCKERFILE),
    );
    expect(result.passed).toBe(true);
  });

  it("skips low-replica deployments", () => {
    const result = topologySpreadConstraintsValidator.validate(
      makeArtifact("k8s/deployment.yaml", MINIMAL_DEPLOYMENT),
    );
    expect(result.passed).toBe(true);
    expect(result.severity).toBe("info");
  });

  it("passes production deployment with topology spread", () => {
    const result = topologySpreadConstraintsValidator.validate(
      makeArtifact("k8s/deployment.yaml", FULLY_HARDENED),
    );
    expect(result.passed).toBe(true);
  });

  it("warns production deployment without topology spread", () => {
    const prod = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: test
          image: test:v1
`;
    const result = topologySpreadConstraintsValidator.validate(
      makeArtifact("k8s/deployment.yaml", prod),
    );
    expect(result.passed).toBe(false);
    expect(result.severity).toBe("warning");
    expect(result.message).toContain("zone");
  });

  it("applies production heuristic at exactly 3 replicas", () => {
    const threeReplicas = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
spec:
  replicas: 3
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
      containers:
        - name: test
          image: test:v1
`;
    const result = topologySpreadConstraintsValidator.validate(
      makeArtifact("k8s/deployment.yaml", threeReplicas),
    );
    expect(result.passed).toBe(true);
  });
});

// ==========================================================================
// Integration — validateAndFixArtifacts with new validators
// ==========================================================================
describe("Integration — validateAndFixArtifacts with all 23 validators", () => {
  it("auto-fixes hostPID + hostIPC + service account token", () => {
    const store = new InMemoryArtifactStore();
    const bad = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: test
  namespace: test
spec:
  replicas: 2
  template:
    spec:
      hostPID: true
      hostIPC: true
      containers:
        - name: test
          image: myregistry.azurecr.io/test:v1.0.0
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: 3000
              name: http
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
          readinessProbe:
            httpGet:
              path: /readyz
              port: 3000
`;
    store.put("k8s/deployment.yaml", bad, { language: "yaml" });
    const reports = validateAndFixArtifacts(store);

    // Auto-fixes should have been applied
    const fixed = store.get("k8s/deployment.yaml")!;
    expect(fixed.content).not.toContain("hostPID: true");
    expect(fixed.content).not.toContain("hostIPC: true");
    expect(fixed.content).toContain("automountServiceAccountToken: false");
    expect(fixed.metadata?.autoFixesApplied).toBeDefined();
  });

  it("reports 23 results per Deployment artifact", () => {
    const store = new InMemoryArtifactStore();
    store.put("k8s/deployment.yaml", FULLY_HARDENED, { language: "yaml" });
    const reports = validateAndFixArtifacts(store);
    expect(reports[0].results).toHaveLength(23);
  });
});
