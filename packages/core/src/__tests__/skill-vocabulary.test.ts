/**
 * @module @kickstart/core/__tests__/skill-vocabulary.test
 *
 * Tests for the shared skill-vocabulary module.
 *
 * Verifies that:
 *   - Vocabulary constants contain the expected canonical terms
 *   - Helper functions correctly detect domain terminology
 *   - Both Mechanism A (skill-resolver) and Mechanism B (resolveConversationSkills)
 *     react correctly to shared vocabulary terms
 */

import { describe, it, expect } from "vitest";
import {
  AKS_KEYWORDS,
  AKS_PATTERNS,
  AUTH_KEYWORDS,
  AUTH_PATTERNS,
  CICD_KEYWORDS,
  CICD_PATTERNS,
  DATABASE_KEYWORDS,
  DATABASE_RELATIONAL_PATTERNS,
  DOCKER_KEYWORDS,
  DOCKER_PATTERNS,
  isAKSRelated,
  isAuthRelated,
  isCICDRelated,
  isDatabaseRelated,
  isDockerRelated,
} from "../engine/skill-vocabulary.js";
import { Phase } from "../engine/types.js";
import { resolveSkills } from "../engine/skill-resolver.js";
import { resolveConversationSkills } from "../services/resolveConversationSkills.js";
import type { IntegrationKit } from "../kits/types.js";

function makeKit(name: string, overrides: Partial<IntegrationKit> = {}): IntegrationKit {
  return { name, description: `${name} kit`, tools: [], connectors: [], ...overrides };
}

// ---------------------------------------------------------------------------
// Vocabulary constants — structure checks
// ---------------------------------------------------------------------------

describe("skill-vocabulary — DOCKER constants", () => {
  it("DOCKER_KEYWORDS includes dockerfile", () => {
    expect(DOCKER_KEYWORDS).toContain("dockerfile");
  });
  it("DOCKER_PATTERNS match 'dockerfile'", () => {
    expect(DOCKER_PATTERNS.some((p) => p.test("write a Dockerfile"))).toBe(true);
  });
  it("DOCKER_PATTERNS match 'container'", () => {
    expect(DOCKER_PATTERNS.some((p) => p.test("container image"))).toBe(true);
  });
  it("isDockerRelated returns true for docker text", () => {
    expect(isDockerRelated("multi-stage Dockerfile")).toBe(true);
  });
  it("isDockerRelated returns false for unrelated text", () => {
    expect(isDockerRelated("spring boot REST endpoint")).toBe(false);
  });
});

describe("skill-vocabulary — AKS constants", () => {
  it("AKS_KEYWORDS includes manifest", () => {
    expect(AKS_KEYWORDS).toContain("manifest");
  });
  it("AKS_KEYWORDS includes aks", () => {
    expect(AKS_KEYWORDS).toContain("aks");
  });
  it("AKS_PATTERNS match 'manifest'", () => {
    expect(AKS_PATTERNS.some((p) => p.test("apply the manifest"))).toBe(true);
  });
  it("isAKSRelated returns true for helm", () => {
    expect(isAKSRelated("helm upgrade --install")).toBe(true);
  });
  it("isAKSRelated returns false for unrelated text", () => {
    expect(isAKSRelated("react component tree")).toBe(false);
  });
});

describe("skill-vocabulary — CICD constants", () => {
  it("CICD_KEYWORDS includes pipeline", () => {
    expect(CICD_KEYWORDS).toContain("pipeline");
  });
  it("CICD_KEYWORDS includes ci/cd", () => {
    expect(CICD_KEYWORDS).toContain("ci/cd");
  });
  it("CICD_PATTERNS match 'pipeline'", () => {
    expect(CICD_PATTERNS.some((p) => p.test("CI/CD pipeline"))).toBe(true);
  });
  it("isCICDRelated returns true for github actions", () => {
    expect(isCICDRelated("set up GitHub Actions workflow")).toBe(true);
  });
  it("isCICDRelated returns false for unrelated text", () => {
    expect(isCICDRelated("design a database schema")).toBe(false);
  });
});

describe("skill-vocabulary — AUTH constants", () => {
  it("AUTH_KEYWORDS includes oidc", () => {
    expect(AUTH_KEYWORDS).toContain("oidc");
  });
  it("AUTH_KEYWORDS includes credential", () => {
    expect(AUTH_KEYWORDS).toContain("credential");
  });
  it("AUTH_PATTERNS match 'managed identity'", () => {
    expect(AUTH_PATTERNS.some((p) => p.test("managed identity setup"))).toBe(true);
  });
  it("isAuthRelated returns true for jwt", () => {
    expect(isAuthRelated("validate a JWT token")).toBe(true);
  });
  it("isAuthRelated returns false for unrelated text", () => {
    expect(isAuthRelated("deploy the helm chart")).toBe(false);
  });
});

describe("skill-vocabulary — DATABASE constants", () => {
  it("DATABASE_KEYWORDS includes database", () => {
    expect(DATABASE_KEYWORDS).toContain("database");
  });
  it("DATABASE_RELATIONAL_PATTERNS match 'postgres'", () => {
    expect(DATABASE_RELATIONAL_PATTERNS.some((p) => p.test("connect to PostgreSQL"))).toBe(true);
  });
  it("isDatabaseRelated returns true for SQL", () => {
    expect(isDatabaseRelated("run a SQL query")).toBe(true);
  });
  it("isDatabaseRelated returns false for unrelated text", () => {
    expect(isDatabaseRelated("build a Dockerfile")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mechanism A (skill-resolver) uses shared vocabulary
// ---------------------------------------------------------------------------

describe("skill-vocabulary — Mechanism A uses shared keywords", () => {
  it("classifies kit prompt with 'dockerfile' to Generate phase", () => {
    const kit = makeKit("ci-kit", { prompts: ["Generate a dockerfile for your Node.js app"] });
    const result = resolveSkills(Phase.Generate, [kit]);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toContain("dockerfile");
  });

  it("classifies kit prompt with 'manifest' to Generate phase", () => {
    const kit = makeKit("k8s-kit", { prompts: ["Create a Kubernetes manifest for your deployment"] });
    const result = resolveSkills(Phase.Generate, [kit]);
    expect(result.prompts).toHaveLength(1);
  });

  it("classifies kit prompt with 'pipeline' to Generate phase", () => {
    const kit = makeKit("cicd-kit", { prompts: ["Set up your CI/CD pipeline with GitHub Actions"] });
    const result = resolveSkills(Phase.Generate, [kit]);
    expect(result.prompts).toHaveLength(1);
  });

  it("classifies kit prompt with 'database' to Design phase", () => {
    const kit = makeKit("db-kit", { prompts: ["Choose a database type for your application"] });
    const designResult = resolveSkills(Phase.Design, [kit]);
    expect(designResult.prompts).toHaveLength(1);
  });

  it("classifies kit prompt with 'aks' to Design phase", () => {
    const kit = makeKit("aks-kit", { prompts: ["Configure your AKS cluster settings and node pools"] });
    const designResult = resolveSkills(Phase.Design, [kit]);
    expect(designResult.prompts).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Mechanism B (resolveConversationSkills) uses shared vocabulary
// ---------------------------------------------------------------------------

describe("skill-vocabulary — Mechanism B uses shared patterns", () => {
  it("detects Docker domain via shared DOCKER_PATTERNS", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "help me write a Dockerfile",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: Dockerfile best practices]");
  });

  it("detects AKS domain via shared AKS_PATTERNS (manifest)", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "apply the kubernetes manifest",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).toContain("[Domain knowledge: AKS Automatic deployment]");
  });

  it("detects CI/CD domain via shared CICD_PATTERNS (pipeline)", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "set up a CI/CD pipeline",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).toContain("[Domain knowledge: GitHub Actions CI/CD for AKS]");
  });

  it("detects auth domain via shared AUTH_PATTERNS (managed identity)", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "configure managed identity for the pod",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).toContain("[Domain knowledge: Azure authentication patterns]");
  });

  it("detects database domain via shared DATABASE_RELATIONAL_PATTERNS", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "connect to a PostgreSQL database",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).toContain("[Domain knowledge: Relational database on Azure]");
  });
});
