/**
 * @module @kickstart/core/engine/copilot-skills-registry
 *
 * CopilotSkillsRegistry — catalogs publicly available Copilot extension
 * skills (e.g. "GitHub Copilot for Azure") so the LLM can suggest them
 * when the conversation touches a relevant domain.
 *
 * These are NOT the same as IntegrationKit skills (internal domain
 * knowledge). Copilot skills are external extensions the user can invoke
 * in their IDE or enable in their environment. The registry only provides
 * awareness — no actual invocation happens here.
 *
 * Security: skill metadata is static, first-party data. No user input is
 * stored in the registry. The generated prompt text contains only
 * pre-defined strings — no injection vectors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A publicly available Copilot extension skill. */
export interface CopilotSkill {
  /** Unique identifier, e.g. "copilot-azure-aks" */
  id: string;
  /** Human-readable name shown in suggestions */
  name: string;
  /** Short description of what this skill does */
  description: string;
  /** Keywords that trigger this skill suggestion when found in conversation */
  triggerKeywords: string[];
  /** URL to the skill's documentation or marketplace page */
  documentationUrl: string;
  /** The Copilot extension that provides this skill */
  extensionName: string;
  /** Optional icon hint for UI rendering */
  icon?: string;
}

/** Result of resolving copilot skills against conversation context. */
export interface ResolvedCopilotSkills {
  /** Skills matched by keyword analysis */
  matched: CopilotSkill[];
  /** Formatted prompt section ready for system prompt injection */
  promptSection: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Registry of publicly available Copilot extension skills.
 *
 * Thread-safe for reads (immutable after construction in practice).
 * Skills are registered at startup and queried per-conversation-turn.
 */
export class CopilotSkillsRegistry {
  private readonly skills = new Map<string, CopilotSkill>();

  /** Register a skill. Overwrites if the ID already exists. */
  register(skill: CopilotSkill): void {
    this.skills.set(skill.id, skill);
  }

  /** Register multiple skills at once. */
  registerAll(skills: CopilotSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
  }

  /** Unregister a skill by ID. */
  unregister(id: string): boolean {
    return this.skills.delete(id);
  }

  /** Get a skill by ID. */
  get(id: string): CopilotSkill | undefined {
    return this.skills.get(id);
  }

  /** Get all registered skills. */
  getAll(): CopilotSkill[] {
    return Array.from(this.skills.values());
  }

  /** Number of registered skills. */
  get size(): number {
    return this.skills.size;
  }

  /** Remove all registered skills. */
  clear(): void {
    this.skills.clear();
  }

  /**
   * Resolve which Copilot skills are relevant to the current conversation
   * by scanning conversation history for trigger keywords.
   *
   * Returns matched skills and a formatted prompt section for injection
   * into the system prompt.
   */
  resolve(conversationHistory?: string[]): ResolvedCopilotSkills {
    if (!conversationHistory || conversationHistory.length === 0) {
      return { matched: [], promptSection: "" };
    }

    const combined = conversationHistory.join(" ").toLowerCase();
    const matched: CopilotSkill[] = [];

    for (const skill of this.skills.values()) {
      const hit = skill.triggerKeywords.some((kw) =>
        combined.includes(kw.toLowerCase()),
      );
      if (hit) {
        matched.push(skill);
      }
    }

    return {
      matched,
      promptSection: formatCopilotSkillsPrompt(matched),
    };
  }
}

// ---------------------------------------------------------------------------
// Prompt formatting
// ---------------------------------------------------------------------------

/**
 * Format matched Copilot skills into a system prompt section.
 *
 * The prompt instructs the LLM to mention the relevant Copilot extension
 * when the conversation topic matches — giving users actionable guidance
 * without the LLM attempting to invoke the extension itself.
 */
export function formatCopilotSkillsPrompt(skills: CopilotSkill[]): string {
  if (skills.length === 0) return "";

  const entries = skills
    .map(
      (s) =>
        `- **${s.name}** (${s.extensionName}): ${s.description}\n  Docs: ${s.documentationUrl}`,
    )
    .join("\n");

  return [
    "## Copilot Extensions",
    "",
    "The following Copilot extensions can help the user with their current scenario.",
    "When the conversation touches these domains, mention the relevant extension",
    "and suggest the user invoke it (e.g. `@azure` in their IDE) for deeper assistance.",
    "Do NOT attempt to invoke these extensions yourself — just make the user aware.",
    "",
    entries,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Default registry with Azure skills
// ---------------------------------------------------------------------------

/** Pre-configured Azure Copilot skills. */
export const AZURE_COPILOT_SKILLS: CopilotSkill[] = [
  {
    id: "copilot-azure-aks",
    name: "Azure Kubernetes Service",
    description:
      "Deploy, manage, and troubleshoot AKS clusters. Get help with kubectl commands, scaling, networking, and cluster diagnostics.",
    triggerKeywords: [
      "aks",
      "kubernetes",
      "kubectl",
      "cluster",
      "helm",
      "k8s",
      "container orchestration",
      "node pool",
      "ingress controller",
    ],
    documentationUrl:
      "https://learn.microsoft.com/en-us/azure/aks/copilot",
    extensionName: "GitHub Copilot for Azure",
    icon: "aks",
  },
  {
    id: "copilot-azure-app-service",
    name: "Azure App Service",
    description:
      "Deploy and manage web apps, REST APIs, and backends. Get help with deployment slots, scaling, custom domains, and diagnostics.",
    triggerKeywords: [
      "app service",
      "web app",
      "webapp",
      "deployment slot",
      "app service plan",
      "paas",
    ],
    documentationUrl:
      "https://learn.microsoft.com/en-us/azure/app-service/copilot",
    extensionName: "GitHub Copilot for Azure",
    icon: "app-service",
  },
  {
    id: "copilot-azure-functions",
    name: "Azure Functions",
    description:
      "Build and deploy serverless functions. Get help with triggers, bindings, Durable Functions, and function app configuration.",
    triggerKeywords: [
      "azure functions",
      "serverless",
      "function app",
      "durable functions",
      "trigger",
      "bindings",
      "consumption plan",
    ],
    documentationUrl:
      "https://learn.microsoft.com/en-us/azure/azure-functions/copilot",
    extensionName: "GitHub Copilot for Azure",
    icon: "functions",
  },
  {
    id: "copilot-azure-container-apps",
    name: "Azure Container Apps",
    description:
      "Deploy and manage containerized microservices. Get help with Dapr integration, scaling rules, revisions, and ingress configuration.",
    triggerKeywords: [
      "container apps",
      "container app",
      "aca",
      "dapr",
      "microservices",
      "revision",
      "containerized",
    ],
    documentationUrl:
      "https://learn.microsoft.com/en-us/azure/container-apps/copilot",
    extensionName: "GitHub Copilot for Azure",
    icon: "container-apps",
  },
  {
    id: "copilot-azure-sql",
    name: "Azure SQL",
    description:
      "Manage Azure SQL databases and query optimization. Get help with performance tuning, security configuration, and migration strategies.",
    triggerKeywords: [
      "azure sql",
      "sql database",
      "sql server",
      "azure database",
      "sql managed instance",
      "database migration",
    ],
    documentationUrl:
      "https://learn.microsoft.com/en-us/azure/azure-sql/copilot/copilot-azure-sql-overview",
    extensionName: "GitHub Copilot for Azure",
    icon: "sql",
  },
];

/** Default registry pre-loaded with Azure Copilot skills. */
export const defaultCopilotSkillsRegistry = new CopilotSkillsRegistry();
defaultCopilotSkillsRegistry.registerAll(AZURE_COPILOT_SKILLS);
