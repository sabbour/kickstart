# Prompt Architecture Guide

Kickstart uses a three-layer prompt architecture to compose system prompts for the LLM. Each layer has a distinct responsibility and can be modified independently.

> **Related docs:** [API Reference](./api-reference.md) for how prompts reach the LLM · [MCP Server](./mcp-server.md) for how the MCP tools compose prompts

**Source:** [`packages/core/src/prompts/system-prompt.ts`](../packages/core/src/prompts/system-prompt.ts)

---

## Three-Layer Architecture

```
┌────────────────────────────────────────┐
│  Layer 1: Azure Skills (future)        │  Bundled domain knowledge, loaded per-phase
│  ← NOT YET IMPLEMENTED                │
├────────────────────────────────────────┤
│  Layer 2: Kickstart System Prompt      │  WHO Kickstart is, HOW it behaves
│  ← system-prompt.ts                   │  Core persona, rules, safeguards
├────────────────────────────────────────┤
│  Layer 3: Phase-Specific Prompt        │  WHAT to do in the current phase
│  ← phases.ts                          │  Narrow, per-phase instructions
└────────────────────────────────────────┘
```

The final system prompt sent to the LLM is the concatenation of Layer 2 + Layer 3, with runtime context injected via template variable interpolation.

---

## Layer 1: Azure Skills (Future)

**Status:** Not yet implemented.

Layer 1 will provide bundled domain knowledge from Azure Skills — pre-built knowledge packs about Azure services, pricing, best practices, and configuration. These will be loaded dynamically based on which phase is active and what services the user's app needs.

For now, the LLM relies on its training data for Azure-specific knowledge, augmented by the structured rules in Layer 2.

---

## Layer 2: System Prompt (Persona + Rules)

The core persona prompt that wraps around everything. It defines WHO Kickstart is and HOW it behaves, regardless of which phase is active.

**Source:** `KICKSTART_SYSTEM_PROMPT` constant in [`system-prompt.ts`](../packages/core/src/prompts/system-prompt.ts)

### Persona

```
You are **Kickstart**, a friendly and encouraging AI guide that helps developers
deploy their applications to a scalable app platform on Azure.
```

Key persona traits:
- Conversational, confident, never condescending
- Target user: developer with an app, no cloud deployment experience
- Makes deployment feel approachable — "like pairing with a knowledgeable friend"

### Core Rules

The system prompt encodes 6 core rules:

| # | Rule | Effect |
|---|------|--------|
| 1 | **ONE concept per turn** | Never present more than one decision point per response |
| 2 | **Frame AKS as app platform** | Say "your app's cloud environment" — never "managed Kubernetes" |
| 3 | **Progressive disclosure** | Start simple, reveal complexity only when needed |
| 4 | **K8s is an implementation detail** | Zero K8s terms in Discover/Design/Generate; guarded in Review; open in Deploy |
| 5 | **Always suggest the happy path** | Smart defaults over choices |
| 6 | **Never ask what you can infer** | If they say "Node.js Express" → infer port 3000, `npm start`, standard Dockerfile |

### K8s Terminology Rules by Phase

| Phase | K8s Terms Allowed? | Instead Say |
|-------|-------------------|-------------|
| Discover | ❌ Never | — |
| Design | ❌ Never | "services your app needs" |
| Generate | ❌ In conversation, ✅ in generated code | "deployment files" not "K8s manifests" |
| Review | ⚠️ Guarded | "health checks" not "probes", "auto-scaling" not "HPA" |
| Handoff | ❌ Focus on GitHub | — |
| Deploy | ✅ If user asks | "Your app runs on AKS Automatic, Azure's managed Kubernetes platform" |

### MCP Tool Delegation

The system prompt explicitly defines what Kickstart owns vs. delegates:

**Kickstart owns:**
- Conversation flow and phase transitions
- Code generation (Dockerfiles, deployment files, CI/CD workflows)
- Validation against deployment safeguards
- Architecture planning and cost estimation

**Delegated to other MCP servers:**
- Azure operations → Azure MCP Server
- AKS/cluster operations → AKS MCP Server
- GitHub operations → GitHub MCP Server

---

## Layer 3: Phase-Specific Prompts

Each phase has its own prompt template that provides narrow, focused instructions for what the LLM should do in that phase.

**Source:** `PHASE_DEFINITIONS` in [`packages/core/src/engine/phases.ts`](../packages/core/src/engine/phases.ts)

### Phase Prompts

#### Discover

**Goal:** Learn about the user's application.

```
You are in the DISCOVER phase. Your only goal is to learn about the user's application.

ONE question at a time. Ask about:
- What the application does (brief description)
- What language/runtime it uses
- Whether they have existing code (repo URL, local project, or starting fresh)

RULES:
- Do NOT mention Kubernetes, AKS, clusters, pods, or any infrastructure concepts.
- Do NOT ask about Azure resources, subscriptions, or regions.
- Focus entirely on the APPLICATION.
```

**Template variables:** `{{knownInfo}}`

**Exit conditions:** `appName` defined, `runtime` identified, basic description provided

---

#### Design

**Goal:** Figure out what services the app needs.

```
You are in the DESIGN phase. The user has described their app. Now figure out the services it needs.

ONE question at a time. Ask about:
- Database? (PostgreSQL, MySQL, MongoDB, or none)
- Cache? (Redis or none)
- Object storage? (Blob storage or none)
- Message queue? (Service Bus, Event Hubs, or none)
- AI/LLM features? (Azure OpenAI or none)
- Public URL?
```

**Template variables:** `{{knownInfo}}`

**Exit conditions:** Services list confirmed, architecture diagram accepted

**Key components used:** `ArchitectureDiagram`, `AppOverview`

---

#### Generate

**Goal:** Produce all deployment artifacts.

```
You are in the GENERATE phase. Produce all deployment artifacts for the user's app.

Generate:
1. Dockerfile
2. Deployment manifests (present as "deployment files")
3. GitHub Actions workflow
4. Service connection configs
```

**Template variables:** `{{appDefinition}}`, `{{services}}`

**Exit conditions:** Deployment files generated, CI/CD workflow generated

**Key components used:** `CodeBlock`, `DeploymentProgress`

---

#### Review

**Goal:** Validate generated artifacts and present cost estimate.

```
You are in the REVIEW phase. Walk the user through what was generated and validate it.

Present:
1. Architecture diagram recap
2. Cost estimate — break down by service, show monthly total
3. Deployment best practices automatically applied
4. Any warnings or issues
```

**Template variables:** `{{appDefinition}}`, `{{artifacts}}`, `{{costContext}}`

**Exit conditions:** User approved the plan, cost estimate acknowledged

**Key components used:** `ArchitectureDiagram`, `CostEstimate`, `AppOverview`

---

#### Handoff

**Goal:** Get code into GitHub and ready to develop.

```
You are in the HANDOFF phase. Get the user's generated code into a GitHub repo.

Steps:
1. Create a new repo or push to existing (RepoPicker)
2. Push all generated files
3. Show Codespaces/vscode.dev link (CodespaceLink)
4. Explain: "push → deploy automatically via GitHub Actions"
```

**Template variables:** `{{appContext}}`, `{{repoInfo}}`

**Exit conditions:** Repo created/selected, code pushed, codespace link provided

**Key components used:** `RepoPicker`, `CodespaceLink`, `HandoffCard`

---

#### Deploy

**Goal:** Optional live deployment to Azure.

```
You are in the DEPLOY phase. This is OPTIONAL — the user can deploy now or come back later.

If deploying:
1. Confirm Azure subscription and region (ResourcePicker)
2. Trigger GitHub Actions workflow
3. Show deployment progress and workflow status
4. Show public URL and next steps
```

**Template variables:** `{{appContext}}`, `{{deploymentConfig}}`

**Exit conditions:** Deployment initiated or skipped

**Key components used:** `ResourcePicker`, `DeploymentProgress`, `WorkflowStatus`

---

## Deployment Safeguards (DS001–DS013)

Thirteen rules automatically validated against generated Kubernetes manifests. Violations are presented as "deployment improvements" — never as "Kubernetes violations."

**Source:** `DEPLOYMENT_SAFEGUARDS` array in [`system-prompt.ts`](../packages/core/src/prompts/system-prompt.ts)

| ID | Rule | Description | Severity | Auto-Fix |
|----|------|-------------|----------|----------|
| DS001 | `resource-limits-required` | Every container must define `resources.requests` AND `resources.limits` for CPU and memory | error | ✅ |
| DS002 | `health-probes-required` | Every container must define `livenessProbe` and `readinessProbe` | error | ✅ |
| DS003 | `run-as-non-root` | `securityContext.runAsNonRoot` must be `true` on all pods | error | ✅ |
| DS004 | `no-privilege-escalation` | `securityContext.allowPrivilegeEscalation` must be `false` on all containers | error | ✅ |
| DS005 | `no-host-networking` | `hostNetwork`, `hostPID`, and `hostIPC` must be `false` or unset | error | ✅ |
| DS006 | `no-latest-image-tag` | Container images must not use `:latest` — pin to a specific version or digest | error | ❌ |
| DS007 | `read-only-root-filesystem` | `readOnlyRootFilesystem` should be `true` where the application permits | warning | ✅ |
| DS008 | `gateway-api-for-ingress` | Use Gateway API (`HTTPRoute`) for ingress, not the legacy `Ingress` resource | error | ✅ |
| DS009 | `workload-identity-required` | Azure access must use Workload Identity, not stored credentials | error | ❌ |
| DS010 | `acr-with-acrpull` | Container images must be pulled from ACR with `AcrPull` role binding, not image pull secrets | error | ❌ |
| DS011 | `resource-quotas-production` | Production-tier deployments must define `ResourceQuota` | warning | ✅ |
| DS012 | `network-policies-production` | Production-tier deployments must define `NetworkPolicy` | warning | ✅ |
| DS013 | `pod-disruption-budget-production` | Production-tier deployments must define `PodDisruptionBudget` | warning | ✅ |

**Severity levels:**
- **error** — blocks deployment; must be fixed before proceeding
- **warning** — suggests improvement; deployment can proceed

**User-facing language:** Safeguards use `friendlyLabel` (never K8s jargon) in the system prompt:

```typescript
{
  id: "DS002",
  rule: "health-probes-required",
  description: "Every container must define livenessProbe and readinessProbe.",
  friendlyLabel: "Health checks let the platform know your app is running and ready to serve traffic.",
  severity: "error",
  autoFix: true,
}
```

The system prompt injects these as:
```
- **DS002** (error): Health checks let the platform know your app is running and ready to serve traffic. [auto-fix available]
```

---

## How `buildSystemPrompt()` Works

The `buildSystemPrompt()` function composes the final system prompt by merging Layer 2 + Layer 3 with runtime context.

```typescript
export function buildSystemPrompt(context: SystemPromptContext): string {
  const phaseDefinition = getPhaseDefinition(context.phase);

  // Assemble template variables
  const vars: Record<string, string> = {
    safeguards: formatSafeguards(DEPLOYMENT_SAFEGUARDS),
    ...(context.templateVars ?? {}),
  };

  // Serialize app info
  if (context.appDefinition) {
    vars["knownInfo"] = Object.entries(context.appDefinition)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");
    vars["appDefinition"] = JSON.stringify(context.appDefinition, null, 2);
  }

  if (context.azureContext) vars["azureContext"] = JSON.stringify(context.azureContext, null, 2);
  if (context.githubContext) vars["repoInfo"] = JSON.stringify(context.githubContext, null, 2);

  // Compose: Layer 2 + Layer 3
  const layer2 = interpolate(KICKSTART_SYSTEM_PROMPT, vars);
  const layer3 = interpolate(phaseDefinition.promptTemplate, vars);

  return [layer2, `## Current Phase: ${phaseDefinition.label}`, phaseDefinition.description, "", layer3].join("\n\n");
}
```

### Input: `SystemPromptContext`

```typescript
interface SystemPromptContext {
  phase: Phase;                              // Determines which Layer 3 prompt to use
  appDefinition?: Partial<AppDefinition>;    // What we know about the user's app
  azureContext?: Partial<AzureContext>;       // Azure subscription/region info
  githubContext?: Partial<GitHubContext>;     // GitHub repo info
  templateVars?: Record<string, string>;     // Additional custom variables
}
```

### Template Variable Interpolation

The `interpolate()` function replaces `{{key}}` placeholders with values from the context:

```typescript
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] ?? "";
  });
}
```

**Built-in variables:**

| Variable | Source | Description |
|----------|--------|-------------|
| `{{safeguards}}` | `DEPLOYMENT_SAFEGUARDS` | Formatted list of all 13 safeguards |
| `{{knownInfo}}` | `context.appDefinition` | Bullet list of known app properties |
| `{{appDefinition}}` | `context.appDefinition` | Full JSON serialization |
| `{{azureContext}}` | `context.azureContext` | Azure subscription/region JSON |
| `{{repoInfo}}` | `context.githubContext` | GitHub repo context JSON |
| `{{services}}` | Phase-specific | Service requirements (set via `templateVars`) |
| `{{artifacts}}` | Phase-specific | Generated artifact references |
| `{{costContext}}` | Phase-specific | Cost estimation context |
| `{{appContext}}` | Phase-specific | General app context for later phases |
| `{{deploymentConfig}}` | Phase-specific | Deployment configuration |

Unknown placeholders are replaced with an empty string.

### Output Structure

The final prompt concatenates:

```
[Layer 2: System Prompt with {{safeguards}} interpolated]

## Current Phase: {label}

{description}

[Layer 3: Phase-specific prompt with {{knownInfo}}, {{appDefinition}}, etc. interpolated]
```

---

## Modifying Prompts Without Breaking the Flow

### Safe changes

- **Edit persona text** in `KICKSTART_SYSTEM_PROMPT` — won't affect phase logic
- **Add/remove safeguards** in `DEPLOYMENT_SAFEGUARDS` — automatically picked up by `{{safeguards}}`
- **Tweak phase prompt wording** in `PHASE_DEFINITIONS` — stays within the phase boundary
- **Add template variables** via `context.templateVars` — no code changes needed in `buildSystemPrompt()`

### Risky changes

- **Changing `{{key}}` names** — must update all phase templates that reference them
- **Removing a phase** from `PHASE_DEFINITIONS` — breaks the FSM (`phases.ts`, `types.ts`, and all MCP tool handlers)
- **Changing K8s terminology rules** — may conflict with phase-specific overrides in Layer 3

### Testing prompt changes

The prompt system is pure TypeScript with no side effects. Test with:

```typescript
import { buildSystemPrompt, Phase } from "@kickstart/core";

const prompt = buildSystemPrompt({
  phase: Phase.Discover,
  appDefinition: { name: "my-app", runtime: "node" },
});

console.log(prompt);
// Verify: no K8s terms in Discover phase, knownInfo populated, etc.
```

Run existing tests:
```bash
npm test  # vitest run from repo root
```
