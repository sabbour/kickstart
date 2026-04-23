---
sidebar_position: 3
---

# Packs, Skills & Actions

Kickstart uses a modular **packs architecture** to organize agents, skills, tools, components, and user actions. Learn how packs work and what's available.

## What are Packs?

A **pack** is a self-contained module that contributes:
- **Agents** — AI personas that handle specific domains (e.g., Azure Architect, AKS Reviewer)
- **Skills** — knowledge rules that agents use to make decisions
- **Tools** — programmatic actions agents can execute (e.g., deploy resources, check pricing)
- **User Actions** — interactive steps in the UI (e.g., "Select subscription", "Review deployment")
- **Components** — React UI elements that render pack-specific content
- **Guardrails** — safety rules that block unsafe operations before tools execute

Packs are the **product knowledge layer** — they carry domain expertise independently from the runtime harness.

## Built-in Packs

### Core Pack

**Package:** `@kickstart/pack-core`  
**Enabled:** Always (required)  
**Purpose:** Foundation agents and cross-domain tools

The core pack provides:
- **Triage Agent** — Analyzes user input and routes to the right domain agent
- **System Agent** — Handles system operations and fallback logic
- **Skills:**
  - `core.emit_ui` — Render UI components to the user
  - `core.get_project_overview` — Summarize the current project
  - `core.write_file` — Create or update files
  - `core.update_file` — Modify existing files
  - `core.read_files` — Read file contents
  - `core.list_files` — List directory contents
  - `core.run_command` — Execute shell commands (with safety guardrails)
- **User Actions:**
  - File editor, code review approval, command execution
- **Components:**
  - Chat message rendering, file diffs, command output display

**When to use:** The core pack is always active. It provides the foundational tools all other packs depend on.

### Azure Pack

**Package:** `@kickstart/pack-azure`  
**Enabled:** By default (disable with `KICKSTART_PACKS`)  
**Purpose:** Azure infrastructure and cloud deployment

The Azure pack equips agents with Azure-specific knowledge and operations:
- **Agents:**
  - `azure.architect` — Designs Azure resource architectures and deployments
  - `azure.ops` — Manages Azure resources and monitors deployments
- **Skills:**
  - `azure.deployment_review` — Review and validate deployments
  - `azure.cost_estimation` — Estimate Azure resource costs
  - `azure.networking_fundamentals` — Design secure networking
  - `azure.arm_basics` — Understand Azure Resource Manager (ARM) templates and Bicep
  - `azure.security_hardening` — Apply security best practices
  - `azure.monitoring_basics` — Set up monitoring and alerts
  - `azure.identity` — Configure authentication and authorization
- **Tools:**
  - `azure.arm_get` — Retrieve ARM template definitions
  - `azure.arm_deploy_resource` — Deploy individual resources
  - `azure.arm_update_resource` — Update resource configurations
  - `azure.arm_delete_resource` — Delete resources
  - `azure.pricing_lookup` — Look up resource pricing
  - `azure.estimate_cost` — Estimate total deployment costs
  - `azure.validate_bicep` — Validate Bicep template syntax
  - `azure.what_if` — Preview deployment changes
- **User Actions:**
  - Subscription selection, resource group creation, resource deployment
- **Components:**
  - Azure resource cards, cost estimation panels, deployment status
  - Subscription selector, location picker, Bicep editor
- **Guardrails:**
  - Prevent privileged operations without authorization
  - Block hardcoded credentials in templates
  - Require subscription scope for certain operations

**When to use:** Enable for deployments targeting Azure infrastructure. Disable if you're only using GitHub actions or other non-Azure platforms.

### GitHub Pack

**Package:** `@kickstart/pack-github`  
**Enabled:** By default (disable with `KICKSTART_PACKS`)  
**Purpose:** GitHub repository and CI/CD operations

The GitHub pack enables repository management and GitHub Actions workflows:
- **Agents:**
  - `github.developer` — Manages code changes and pull requests
- **Skills:**
  - `github.repository_context` — Understand repository structure
  - `github.code_review` — Review and comment on code
  - `github.ci_cd_automation` — Set up GitHub Actions workflows
- **Tools:**
  - `github.api_get` — Query repository data via GitHub API
  - `github.api_post` — Create issues, PRs, commits
  - `github.api_patch` — Update issues, PRs, comments
  - `github.api_delete` — Delete branches, workflows, releases
- **User Actions:**
  - Pull request approval, commit push, issue creation
- **Components:**
  - PR diff viewer, commit message editor, action status display

**When to use:** Enable for GitHub-hosted repositories. Required if you want agents to manage repository operations.

### AKS Automatic Pack

**Package:** `@kickstart/pack-aks-automatic`  
**Enabled:** By default (disable with `KICKSTART_PACKS`)  
**Purpose:** AKS Automatic cluster management and Kubernetes deployment

The AKS Automatic pack brings Kubernetes expertise and cluster operations:
- **Agents:**
  - `aks-automatic.architect` — Designs AKS clusters and workload configurations
  - `aks-automatic.reviewer` — Reviews Kubernetes manifests for best practices
  - `aks-automatic.manifests_author` — Generates Kubernetes manifests
- **Skills:**
  - `aks_automatic.cluster_creation` — Create AKS Automatic clusters
  - `aks_automatic.deployment_safeguards` — Enforce safe deployment patterns
  - `aks_automatic.acr_integration` — Integrate Azure Container Registry
  - `aks_automatic.workload_identity` — Configure workload identity federation
  - `aks_automatic.gateway_api_mandatory` — Use Gateway API for routing
  - `aks_automatic.kaito_gpu_models` — Deploy GPU-backed AI models
  - `aks_automatic.terminology_rules` — Use correct Kubernetes terminology
- **Tools:**
  - `aks.manifest_validate` — Validate Kubernetes YAML
  - `aks.manifest_lint` — Check manifests for best practices
  - `aks.deploy_manifest` — Apply manifests to a cluster
- **User Actions:**
  - Cluster creation, manifest deployment, workload identity setup
- **Components:**
  - Cluster status panel, manifest editor, deployment warnings

**When to use:** Enable when targeting AKS Automatic as the deployment platform. Agents will understand Kubernetes patterns and AKS best practices.

## How Packs are Loaded

### Discovery

The harness automatically discovers packs from the `packages/` directory. A valid pack has:
1. A `src/index.ts` (or `src/index.js`) file
2. A `package.json` with name like `@kickstart/pack-*`
3. A `.pack.js` or `.pack.ts` export with a `Pack` object

### Registration

At startup, the registry reads each pack's `agentsDir` and `skillsDir` to load:
- `.agent.md` files (agents)
- `.SKILL.md` files (skills)

These files use a standardized format. See [Architecture → Skill Injection](../architecture/skill-injection.md) for details.

### Enabling/Disabling Packs

Set the `KICKSTART_PACKS` environment variable to a comma-separated list:

```bash
# Enable only core and Azure packs
KICKSTART_PACKS=core,azure

# Enable all packs (default)
KICKSTART_PACKS=core,azure,github,aks-automatic
```

If `KICKSTART_PACKS` is not set, all discovered packs are loaded.

### Server / client entrypoints

Each pack is shipped with **two subpath exports** to keep React renderers out of the server bundle:

| Subpath                           | What it exports                                                                 | Consumed by                          |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------ |
| `@aks-kickstart/pack-<name>`      | Default `Pack` object (tools, skills, agents, guardrails, user actions)         | Harness registry (Node)              |
| `@aks-kickstart/pack-<name>/server` (also `/server-manifest`) | React-free manifest: Zod schemas, tool handlers, guardrails    | Azure Functions / MCP server         |
| `@aks-kickstart/pack-<name>/client` | `registerClient(target)`, `clientComponents`, `previews` fixtures           | Web client bootstrap (`packages/web`) |

The `./client` subpath is marked `sideEffects: false` so unused renderers tree-shake per route. `registerClient(target)` is an **explicit** registration — there are no import-time side effects — which matches the security contract for `core/*` renderers.

```ts
// packages/web/src/bootstrap/registerPackComponents.ts
import { registerClient as registerAzure } from '@aks-kickstart/pack-azure/client';

export function registerPackComponents(registry: ClientComponentRegistry) {
  const target = {
    register: (c: ComponentContribution) => registry.register(adaptPackComponent(c)),
  };
  registerAzure(target);
  // …registerAks, registerGithub
}
```

Each pack's `previews: Record<ComponentName, A2UIEnvelope>` export provides Playground preview fixtures for the **Components** tab. Fixtures are validated against the component's `propertySchema` via `component-previews.test.ts`.

### Scenarios (Ideas tab)

Packs can also contribute `scenarios: readonly PackScenario[]` — **curated scenario compositions** shown in the Playground's **Ideas** tab. Each scenario is a full A2UI v0.9 adjacency list that mixes 2–4 components (pack-contributed + `core/*` primitives) into a realistic end-to-end workflow:

```ts
// packages/pack-azure/src/client.ts
export const scenarios: readonly PackScenario[] = Object.freeze([
  {
    id: 'pick-region',
    title: 'Pick an Azure region',
    description: 'Region picker with a primary action button.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'selector', 'continue'] },
      { id: 'heading', component: 'Text', text: 'Choose a deployment region' },
      { id: 'selector', component: 'azure/LocationSelector', /* …props… */ },
      { id: 'continue', component: 'Button', child: 'continue-label' },
      { id: 'continue-label', component: 'Text', text: 'Continue' },
    ],
  },
  // …
]);
```

Scenarios are **static, build-time-trusted fixtures** — no runtime LLM synthesis, no user-supplied envelopes — so they inherit the same trust boundary as `previews`. They are aggregated in `packages/web/src/catalog/component-scenarios.ts` and validated against each component's `propertySchema` plus a registry-resolution + sanitizer guard (`component-scenarios.test.ts`), guaranteeing the Ideas tab renders deterministically from fixture input with zero `_ErrorComponent` placeholders.


## Skills

A **skill** is a set of rules or knowledge that an agent can apply. Skills are not executable — they guide agent reasoning.

### Core Skills Example

```markdown
# Triage

Analyze user input and route to the right agent.
- If input is about Azure resources → route to azure.architect
- If input is about Kubernetes → route to aks-automatic.architect
- If input is about GitHub → route to github.developer
- Otherwise → stay in triage and ask for clarification
```

### Azure Skills Example

```markdown
# Cost Estimation

When estimating costs:
- Check compute: VM size, region, reserved instances
- Check storage: redundancy level, access tier
- Check networking: data transfer, load balancing
- Use Azure Pricing API for current rates
- Always include a confidence range (±10%)
```

### How Agents Use Skills

Agents read skills from their skill directory at startup and apply them during reasoning:
1. **Agent loads skills** from its pack's `skillsDir`
2. **Harness injects skills** into agent system prompt
3. **Agent applies skills** when deciding how to respond or which tools to use
4. **Skills are not code** — they're plain text guidance that shapes agent behavior

## Tools

A **tool** is an executable action that an agent can invoke. Unlike skills, tools have code and execute immediately.

### Core Tools

| Tool | Input | Output |
|------|-------|--------|
| `core.emit_ui` | Component name, props | Renders component in UI |
| `core.read_file` | File path | File contents |
| `core.write_file` | Path, contents | File created/updated |
| `core.run_command` | Command string | stdout, stderr, exit code |

### Azure Tools

| Tool | Input | Output |
|------|-------|--------|
| `azure.arm_get` | Resource ID | ARM template |
| `azure.arm_deploy_resource` | Resource definition | Deployment status |
| `azure.pricing_lookup` | Resource type, region | Price per unit |
| `azure.validate_bicep` | Bicep template | Validation errors (if any) |

### GitHub Tools

| Tool | Input | Output |
|------|-------|--------|
| `github.api_get` | Endpoint, query params | JSON response |
| `github.api_post` | Endpoint, data | Created resource |

### How to Find Available Tools

1. **In the UI:** Check the agent's system prompt or ask "What tools do you have?"
2. **In code:** Search for `export const toolName` in `packages/pack-*/src/tools/`
3. **In tests:** Review test fixtures in `packages/pack-*/src/__tests__/`

## User Actions

A **user action** is a checkpoint where the agent pauses and asks the user to decide. Examples:
- "Do you approve this deployment?"
- "Select which subscription to use"
- "Review and edit this manifest before applying"

User actions interrupt the agent run, store pending state in the session, and resume when the user responds.

### Core User Actions

- **Approve code review** — User reviews and approves code changes
- **Execute command** — User reviews and approves shell commands
- **Edit file** — User edits a generated or proposed file

### Azure User Actions

- **Select subscription** — Choose Azure subscription
- **Select resource group** — Choose or create resource group
- **Confirm deployment** — Review and approve ARM deployment
- **Select location** — Choose Azure region

### GitHub User Actions

- **Review pull request** — Review PR before merge
- **Confirm commit** — Confirm commit message and push

## Components

A **component** is a React UI element that packs can render. Components display data, accept input, or show status.

### Core Components

- **Chat message** — Render agent message with formatting
- **File diff** — Show code changes side-by-side
- **Command output** — Display shell command results
- **File editor** — Edit file contents with syntax highlighting

### Azure Components

- **Azure resource card** — Show resource details
- **Cost estimate panel** — Display cost breakdown
- **Subscription selector** — Dropdown to choose subscription
- **Bicep editor** — Edit Bicep templates with validation

### GitHub Components

- **PR diff viewer** — Show pull request changes
- **Commit message editor** — Compose commit messages
- **Action status** — Show GitHub Actions run status

## Guardrails

**Guardrails** are safety rules that run before a tool executes. If a guardrail blocks a tool, the agent is notified and cannot proceed.

### Core Guardrails

- **Sandbox file paths** — Prevent access outside project directory
- **Shell command validation** — Block dangerous shell commands
- **Rate limiting** — Prevent tool abuse

### Azure Guardrails

- **No hardcoded credentials** — Block secrets in templates
- **Privilege checks** — Require authorization for admin operations
- **Subscription scope enforcement** — Prevent cross-subscription access

### AKS Guardrails

- **Manifest validation** — Block invalid YAML
- **Security policies** — Enforce pod security standards
- **Resource quotas** — Respect cluster limits

## Discovery Commands

### List Available Packs

```bash
# Read package.json files to see all packs
ls -1 packages/pack-*/package.json | xargs grep '"name"'
```

Output:
```
"@kickstart/pack-core": true
"@kickstart/pack-azure": true
"@kickstart/pack-github": true
"@kickstart/pack-aks-automatic": true
```

### List Pack Agents

```bash
# Find all agents in a pack
find packages/pack-azure/src/agents -name "*.agent.md"
```

Output:
```
packages/pack-azure/src/agents/azure-architect.agent.md
packages/pack-azure/src/agents/azure-ops.agent.md
```

### List Pack Skills

```bash
# Find all skills in a pack
find packages/pack-azure/src/skills -name "*.SKILL.md"
```

Output:
```
packages/pack-azure/src/skills/deployment-review.SKILL.md
packages/pack-azure/src/skills/cost-estimation.SKILL.md
...
```

### List Pack Tools

```bash
# Find all tools in a pack
find packages/pack-azure/src/tools -name "*.ts" | head -20
```

## Next Steps

- **Learn more:** Read [Architecture → Skill Injection](../architecture/skill-injection.md) for implementation details
- **Extending:** See [Extending → Integration Kits](../extending/integration-kits.md) to create custom packs
- **Examples:** Check `.squad/teams.md` for agent personality examples
