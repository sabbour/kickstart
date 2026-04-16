/**
 * @module @kickstart/core/__tests__/resolveConversationSkills.test
 *
 * Unit tests for the per-turn dynamic skill injection resolver.
 */

import { describe, it, expect } from "vitest";
import {
  resolveConversationSkills,
} from "../services/resolveConversationSkills.js";

// ---------------------------------------------------------------------------
// currentState formatting
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — currentState", () => {
  it("always includes phase", () => {
    const { currentState } = resolveConversationSkills("hello", "discover", { phase: "discover" });
    expect(currentState).toContain("[Current session context]");
    expect(currentState).toContain("Phase: discover");
  });

  it("includes appDefinition fields when present", () => {
    const { currentState } = resolveConversationSkills("hello", "design", {
      phase: "design",
      appDefinition: { runtime: "nodejs", appType: "web-api", name: "my-app", databaseType: "postgres", needsIngress: true, resourceTier: "standard" },
    });
    expect(currentState).toContain("App name: my-app");
    expect(currentState).toContain("App type: web-api");
    expect(currentState).toContain("Runtime: nodejs");
    expect(currentState).toContain("Database: postgres");
    expect(currentState).toContain("Public URL: yes");
    expect(currentState).toContain("Resource tier: standard");
  });

  it("omits empty appDefinition fields gracefully", () => {
    const { currentState } = resolveConversationSkills("hello", "discover", { phase: "discover", appDefinition: {} });
    expect(currentState).not.toContain("App name");
    expect(currentState).not.toContain("Runtime");
  });

  it("lists generated files when present", () => {
    const { currentState } = resolveConversationSkills("generate files", "generate", {
      phase: "generate",
      filesGenerated: ["Dockerfile", "deployment.yaml"],
    });
    expect(currentState).toContain("Files generated: Dockerfile, deployment.yaml");
  });
});

// ---------------------------------------------------------------------------
// Domain detection — stack keywords
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — stack domain detection", () => {
  it("detects Node.js keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("how do I add a nodejs health endpoint", "discover", { phase: "discover" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: Node.js]");
  });

  it("detects Python keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("my FastAPI app needs a health check", "discover", { phase: "discover" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: Python]");
  });

  it("detects .NET keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("I'm building an ASP.NET app", "discover", { phase: "discover" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: .NET]");
  });

  it("detects Java keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("Spring Boot app with Maven", "discover", { phase: "discover" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: Java / Spring]");
  });

  it("returns null when no domain matches in generic message", () => {
    // Generic message with no keywords and no appDefinition runtime
    const { domainKnowledge } = resolveConversationSkills("what should I build?", "discover", { phase: "discover" });
    expect(domainKnowledge).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Domain detection — infrastructure keywords
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — infra domain detection", () => {
  it("detects Docker keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("help me write a Dockerfile", "design", { phase: "design" });
    expect(domainKnowledge).toContain("[Domain knowledge: Dockerfile best practices]");
  });

  it("detects AKS keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("how does Workload Identity work on AKS?", "design", { phase: "design" });
    expect(domainKnowledge).toContain("[Domain knowledge: AKS Automatic deployment]");
  });

  it("detects CI/CD keywords", () => {
    const { domainKnowledge } = resolveConversationSkills("set up GitHub Actions pipeline", "generate", { phase: "generate" });
    expect(domainKnowledge).toContain("[Domain knowledge: GitHub Actions CI/CD for AKS]");
  });
});

// ---------------------------------------------------------------------------
// Domain detection — data keywords
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — data domain detection", () => {
  it("detects PostgreSQL keyword", () => {
    const { domainKnowledge } = resolveConversationSkills("how do I connect to PostgreSQL?", "generate", { phase: "generate" });
    expect(domainKnowledge).toContain("[Domain knowledge: Relational database on Azure]");
  });

  it("detects Redis keyword", () => {
    const { domainKnowledge } = resolveConversationSkills("add a Redis cache layer", "generate", { phase: "generate" });
    expect(domainKnowledge).toContain("[Domain knowledge: Redis on Azure]");
  });

  it("detects Service Bus keyword", () => {
    const { domainKnowledge } = resolveConversationSkills("using Service Bus for async messaging", "design", { phase: "design" });
    expect(domainKnowledge).toContain("[Domain knowledge: Messaging on Azure]");
  });
});

// ---------------------------------------------------------------------------
// Phase-based automatic injection
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — phase-based injection", () => {
  it("always injects AKS and Docker knowledge in generate phase", () => {
    const { domainKnowledge } = resolveConversationSkills("generate files", "generate", { phase: "generate" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: AKS Automatic deployment]");
    expect(domainKnowledge).toContain("[Domain knowledge: Dockerfile best practices]");
  });

  it("always injects CI/CD knowledge in handoff phase", () => {
    const { domainKnowledge } = resolveConversationSkills("push to GitHub", "handoff", { phase: "handoff" });
    expect(domainKnowledge).toContain("[Domain knowledge: GitHub Actions CI/CD for AKS]");
  });

  it("always injects infra + cicd knowledge in deploy phase", () => {
    const { domainKnowledge } = resolveConversationSkills("deploy now", "deploy", { phase: "deploy" });
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: AKS Automatic deployment]");
    expect(domainKnowledge).toContain("[Domain knowledge: GitHub Actions CI/CD for AKS]");
  });
});

// ---------------------------------------------------------------------------
// Runtime-based injection from sessionContext
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — runtime from sessionContext", () => {
  it("injects Node.js knowledge when runtime is nodejs even for generic message", () => {
    const { domainKnowledge } = resolveConversationSkills("generate files", "design", {
      phase: "design",
      appDefinition: { runtime: "nodejs" },
    });
    expect(domainKnowledge).toContain("[Domain knowledge: Node.js]");
  });

  it("injects Python knowledge when runtime contains python", () => {
    const { domainKnowledge } = resolveConversationSkills("what's next?", "design", {
      phase: "design",
      appDefinition: { runtime: "python" },
    });
    expect(domainKnowledge).toContain("[Domain knowledge: Python]");
  });
});

// ---------------------------------------------------------------------------
// Multi-domain: multiple snippets combined
// ---------------------------------------------------------------------------

describe("resolveConversationSkills — multi-domain injection", () => {
  it("combines multiple domain snippets in one block", () => {
    const { domainKnowledge } = resolveConversationSkills(
      "Node.js app with PostgreSQL database",
      "design",
      { phase: "design" },
    );
    expect(domainKnowledge).not.toBeNull();
    expect(domainKnowledge).toContain("[Domain knowledge: Node.js]");
    expect(domainKnowledge).toContain("[Domain knowledge: Relational database on Azure]");
  });
});
