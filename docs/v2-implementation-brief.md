# Kickstart v2 — Implementation Brief

**Audience:** the implementing agent.
**Status:** design locked. Ready to execute.
**Scope:** greenfield rewrite on `main`. v1 does not need to keep working. Delete aggressively. No user state to preserve.

---

## 1. Architecture at a glance

Kickstart v2 is a **harness + packs** system.

- **Harness** (`@kickstart/harness`) — the runtime. Knows about primitives, not domains. Loads packs, runs agents through the `@openai/agents` SDK, streams events, manages sessions, mediates A2UI, enforces guardrails, speaks MCP.
- **Packs** — domain-specific bundles of contributions. Each pack contributes agents, tools, user actions, components, skills, and guardrails. The harness is domain-agnostic; packs carry all product knowledge.

The product "Kickstart" = harness + a chosen set of packs (core + azure + aks-automatic + github for the current AKS Automatic experience). A different product (e.g. "Kickstart for Container Apps") would swap `pack-aks-automatic` for `pack-azure-container-apps`.

---

## 2. The five primitives

Internalize these before writing code. They are the only vocabulary the harness understands.

### Pack
A bundle of contributions. The unit of extensibility and distribution. Declares dependencies on other packs. Registered at startup, sealed after startup. Third-party packs deferred; everything in-tree for v2.

### Agent
An LLM persona. `@openai/agents` SDK `Agent` instance at runtime.
- Authored as `.agent.md` (VS Code custom agent format): YAML frontmatter + markdown body.
- Frontmatter declares: name, description, model, allowed tools, handoff targets, user-invocable, model-invocable.
- Body = base instructions.
- **Dynamic instructions per turn** = base body + matched skills + component catalog + session snapshot. Composed via the SDK's `instructions: (ctx) => string` hook.
- Agents call tools; they do not have side effects themselves.
- Name format: `pack.agent_name` (e.g. `core.triage`, `azure.architect`, `aks.manifests_author`).

### Skill
A chunk of prose injected into an agent's prompt when relevant.
- Authored as `SKILL.md` (agentskills.io format) with Kickstart extensions under `x-kickstart`.
- Pure text. No code. No scripts. No execution. If you want execution, write a tool.
- Per-turn resolver: match `appliesTo` (agent-name glob) → score keywords against recent turns → apply priority → cap by token budget.
- Injected into the agent's dynamic instructions, never as a user message.

### Tool
Server-side code the agent invokes. Returns a typed result.
- `@openai/agents` SDK `tool({...})` with Zod parameter + return schemas.
- No user interaction required.
- Name format: `pack.verb_noun` (sigil `.`).
- Example: `azure.arm_get`, `core.write_file`, `core.emit_ui`.

### UserAction (a flavor of Tool)
A tool that requires the browser to act — consent, credentials, or a UI confirm.
- Same authoring API, declared via `userAction({...})` to wire into SDK interrupt/resume.
- When called: Runner pauses → server emits `user_action_required` SSE → browser renders confirm component, does work (MSAL popup, GitHub OAuth, etc.) → POSTs typed result to `/api/converse/resume` → Runner resumes with the typed result.
- Name format: `pack:verb_noun` (sigil `:`). Wire-transliterated to `pack__verb_noun` because OpenAI tool-call schema disallows `:`.
- Cancellation: default is queue. Opt-in `cancellation: "supported"` to accept `AbortSignal`.

### Component
An A2UI v0.9 component definition + a React renderer.
- Registered in the catalog at startup.
- The LLM never sees React — only component name + property schema.
- Name format: `pack/PascalName` (sigil `/`).

### Guardrail
Cross-cutting check at input, output, or tool boundary.
- `{ id, stages: ("input" | "output" | "tool")[], evaluate(input: GuardrailInput) → GuardrailResult }`.
- Replaces today's scattered regex checks.
- IDs are namespaced (`core/token-budget`). Core guardrails run first and fail-closed.

### How they compose per turn

```
User message
  → Runner picks active Agent (session.activeAgent, default core.triage)
  → Dynamic instructions = agent.body + resolvedSkills(agent, ctx) + catalog
  → Agent streams text AND emits A2UI via core.emit_ui tool calls
  → Agent may call other Tools / UserActions
  → If UserAction: pause → browser → resume
  → Agent produces structured AgentOutput { message, intent }
  → Guardrails run at input, tool-call, and output stages
  → Handoff → next Agent picks up future turns
```

---

## 3. A2UI streaming model

**A2UI messages do not live inside an envelope.** Each `emit_ui` tool call emits exactly one complete A2UI v0.9 message (`createSurface` / `updateComponents` / `updateDataModel` / `deleteSurface`). The SDK event stream surfaces each tool call as an atomic unit. The SSE adapter forwards each as a single `a2ui` event.

No incremental JSON parser. No envelope buffer. A2UI's own transport-agnostic JSONL model applies — we're just routing it over typed SSE events instead of raw JSONL bytes.

Structured final output is small:

```ts
const AgentOutput = z.object({
  message: z.string(),
  intent: z.enum(["continue", "advance", "revise", "auto-continue-files"]).optional(),
});
```

---

## 4. Repo layout after migration

```
packages/
  harness/                          # @kickstart/harness — runtime engine
    src/
      index.ts                      # public exports
      runtime/
        registry.ts                 # PackRegistry (register/enable/seal)
        loader-agent.ts             # .agent.md → AgentContribution
        loader-skill.ts             # SKILL.md → Skill
        runner.ts                   # Runner wrapper, SSE streaming
        session.ts                  # SessionCtx, persistence adapter
        resume.ts                   # interrupt/resume plumbing
        skill-resolver.ts           # per-turn skill selection
        catalog.ts                  # A2UI catalog negotiation
        sse.ts                      # typed SSE writer
        frontmatter.ts              # YAML parser (ported from packages/core/src/skills/frontmatter-parser.ts)
      types/
        pack.ts
        agent.ts
        skill.ts
        tool.ts
        user-action.ts
        component.ts
        guardrail.ts
        playground.ts               # PlaygroundScenario
        agent-output.ts             # Zod AgentOutput
        a2ui.ts                     # Zod A2UI v0.9 message schemas
        session.ts
      a2ui/
        validator.ts                # validate message against negotiated catalog
        chat-a2ui.ts                # ported from packages/web/src/utils/chat-a2ui.ts
      mcp/
        server.ts                   # harness-exposed MCP server shell
        client.ts                   # consumer stub (deferred, third-party)

  pack-core/                        # @kickstart/pack-core — baseline
    src/
      index.ts                      # Pack manifest
      tools/
        emit-ui.ts                  # core.emit_ui
        write-file.ts
        read-file.ts
        list-files.ts
        validate-artifacts.ts
        fetch-webpage.ts
      components/
        basic/                      # A2UI basic catalog Fluent renderers (ported from catalog/fluent-components)
          Accordion.tsx, Alert.tsx, Badge.tsx, Button.tsx, Card.tsx,
          CheckBox.tsx, ChildList.tsx, ChoicePicker.tsx, Column.tsx,
          ComboBox.tsx, DateTimeInput.tsx, Divider.tsx, Icon.tsx, Image.tsx,
          Link.tsx, List.tsx, Modal.tsx, MultiSelect.tsx, Row.tsx, Slider.tsx,
          Table.tsx, Tabs.tsx, Text.tsx, TextField.tsx, Toggle.tsx,
          AudioPlayer.tsx, Video.tsx
        rich/                       # Kickstart rich components (domain-neutral)
          CodeBlock.tsx
          DecisionCard.tsx
          FileEditor.tsx
          FormGroup.tsx
          GenerationProgress.tsx
          Markdown.tsx
          ProgressSteps.tsx
          Questionnaire.tsx
          RadioGroup.tsx
          SteppedCarousel.tsx
          SummaryCard.tsx
          AuthCard.tsx
          monaco-local-setup.ts
      guardrails/
        token-budget.ts
        no-pii-in-logs.ts
        no-secrets-in-artifacts.ts
      playground/
        discover-flow.scenario.ts
        generate-files.scenario.ts
        …
    agents/
      core.triage.agent.md
      core.codesmith.agent.md
      core.reviewer.agent.md
    skills/
      collaborator-voice/SKILL.md
      a2ui-output-discipline/SKILL.md
      teach-then-ask/SKILL.md
      phase-acceleration/SKILL.md
      file-generation-batching/SKILL.md

  pack-azure/                       # @kickstart/pack-azure — generic Azure
    src/
      index.ts
      tools/
        arm-get.ts
        pricing-lookup.ts
        estimate-cost.ts
        validate-bicep.ts
        what-if.ts
      user-actions/
        login.ts                    # uses services/azure-auth (ported)
        create-subscription.ts
        pick-subscription.ts
        pick-region.ts
        pick-resource-group.ts
        deploy-bicep.ts              # uses services/azure-deployments (ported)
      components/
        Login.tsx                    # from AzureLoginCard
        SubscriptionPicker.tsx       # from AzureResourcePicker
        RegionPicker.tsx
        ResourceGroupPicker.tsx
        ResourceForm.tsx             # from AzureResourceForm
        Action.tsx                   # from AzureAction
        CostSummary.tsx              # from CostEstimate
      services/
        azure-auth.ts                # ported from web/src/services/azure-auth.ts
        azure-deployments.ts         # ported
        cost-estimates.ts            # ported (+ test)
        cost-estimate.ts             # util ported from web/src/utils
        icons/                       # Azure SVGs from catalog/icons
      guardrails/
        no-hardcoded-credentials.ts
        no-subscription-scoped-owner.ts
      playground/
        cost-summary.scenario.ts
        subscription-picker.scenario.ts
    agents/
      azure.architect.agent.md
      azure.iac_author.agent.md
    skills/
      bicep-modules/SKILL.md
      secure-decorators/SKILL.md
      diagnostic-settings/SKILL.md
      resource-tagging/SKILL.md
      least-privilege-rbac/SKILL.md
      managed-identity-preference/SKILL.md
      arm-resource-templates/SKILL.md
      arm-role-assignment-rules/SKILL.md
      azure-regions-and-skus/SKILL.md

  pack-aks-automatic/               # @kickstart/pack-aks-automatic
    src/
      index.ts
      tools/
        validate-manifests.ts
        validate-safeguards.ts
      user-actions/
        deploy.ts
      components/
        ArchitectureDiagram.tsx      # ported from catalog/components
        architectureDiagramIconRegistry.ts    # ported (+ test)
        architectureDiagramUtils.ts  # ported (+ test)
        DeploymentSafeguardsReport.tsx
        GatewayRouteExplorer.tsx
        WorkloadIdentityWiring.tsx
        icons/                       # k8s SVGs from catalog/icons
      guardrails/
        no-latest-tag.ts
        safeguards-compliance.ts
        no-k8s-terminology-pre-deploy.ts
      data/
        safeguards.json              # single source of truth: skill prose + guardrail data
      playground/
        architecture-diagram.scenario.ts
        deployment-safeguards.scenario.ts
    agents/
      aks.architect.agent.md
      aks.manifests_author.agent.md
      aks.reviewer.agent.md
    skills/
      aks-automatic-cluster-creation/SKILL.md
      gateway-api-mandatory/SKILL.md
      workload-identity-mandatory/SKILL.md
      deployment-safeguards/SKILL.md
      acr-integration/SKILL.md
      kaito-gpu-models/SKILL.md
      aks-terminology-rules/SKILL.md

  pack-github/                      # @kickstart/pack-github
    src/
      index.ts
      tools/
        api-get.ts
      user-actions/
        login.ts                     # ported from GitHubLoginCard flow
        pick-org.ts
        pick-repo.ts
        create-repo.ts
        create-pr.ts                 # uses services/github-handoff (ported)
        set-secret.ts
      components/
        Login.tsx                    # from GitHubLoginCard
        OrgPicker.tsx
        RepoPicker.tsx               # from GitHubRepoPicker
        RepoInfo.tsx
        Action.tsx                   # from GitHubAction
        CreatePRFlow.tsx             # from GitHubCommit
        SecretSetter.tsx
      services/
        github-handoff.ts            # ported from web/src/services/github-handoff.ts
      playground/
        repo-picker.scenario.ts
        create-pr.scenario.ts
    agents/
      github.publisher.agent.md
    skills/
      github-actions-oidc/SKILL.md
      github-actions-workflow-structure/SKILL.md
      github-pr-conventions/SKILL.md

  web/                              # existing web shell, rewritten API + UI
    api/
      src/
        functions/
          converse.ts               # POST /api/converse — Runner + SSE
          resume.ts                 # POST /api/converse/resume
          packs.ts                  # GET /api/packs — catalog + user-action manifest
        startup/
          packs.ts                  # register all packs, seal
        lib/
          azure-provider.ts         # keep (@openai/agents + AzureOpenAI bridge)
          openai-client.ts          # keep auth/fetch bits, trim v1 chat loop
    src/                            # React client
      App.tsx, main.tsx             # keep
      components/                   # shell UI (keep all)
        A2UI/                       # rewrite to consume negotiated catalog from registry
        Chat/
        FileEditor/
        FileManager/
        FileTreePanel.tsx
        Landing.tsx
        Layout.tsx
        OnboardingTour.tsx
        Sidebar/
        ThemeToggle.tsx
        Topbar.tsx
      pages/
        Playground.tsx              # keep; read from registry
        PlaygroundWorkspace.tsx     # keep
        playground-icons.ts         # keep
      contexts/                     # keep, audit per file after Step 5
      hooks/
        useStreaming.ts             # rewrite for typed SSE events
        useA2UI.ts                  # keep — A2UI state reducer
        useProgressiveQueue.ts      # keep
        useSessions.ts              # keep
        useNavigation.ts            # keep
        useActionDispatch.ts        # rewrite as UserAction dispatcher
      services/
        api-client.ts               # keep (+ test)
        virtual-fs.ts               # keep — in-browser FS for FileEditor
      utils/
        path-validation.ts          # keep
        sanitize.ts                 # keep
        sanitize-action-context.ts  # keep
        statusIcons.tsx             # keep
        chat-usage.ts               # keep
      vendor/                       # keep
      __tests__/
        playground-surfaceids.test.ts  # keep
```

### Files to delete in the first PR

- `packages/core/` entirely (rewrite as `packages/harness/` + `packages/pack-core/`)
- `packages/web/api/src/functions/converse.ts` (rewritten)
- `packages/web/api/src/lib/setup-generation.ts`
- `packages/web/api/src/lib/agents-route-planner.ts`
- `packages/web/api/src/lib/agents-sse-adapter.ts` (rewritten)
- `packages/web/src/services/demo-scenarios.ts`
- `packages/web/src/services/mock-streaming.ts`
- `packages/web/src/services/playground-auth-stub.ts` (splits into per-pack stubs)
- `packages/web/src/pages/playground-scenarios.ts` (migrates to per-pack `playground/` dirs)
- `packages/web/src/hooks/useMockStreaming.ts`
- `packages/web/src/hooks/useWidgets.tsx` (audit; likely v1-specific)
- `packages/web/src/catalog/kickstart-catalog.ts` (replaced by registry-driven catalog)
- `packages/web/src/types.ts` (rewrite as harness-exported types consumed via `/api/packs`)
- `HERMES-271-TEST-PLAN.md`, `QUALITY-DECISION-271.md` (v1 artifacts)
- All feature flags: `KICKSTART_AGENTS_SDK`, `KICKSTART_V2`, stepwise gate flags

---

## 5. Core types

```ts
// packages/harness/src/types/pack.ts
export interface Pack {
  name: string;                           // "azure"
  version: string;
  dependsOn?: string[];                   // ["core"] for pack-azure; ["core","azure"] for pack-aks-automatic

  agentsDir?: URL;
  skillsDir?: URL;
  agents?: AgentContribution[];
  skills?: Skill[];
  tools?: ToolContribution[];
  userActions?: UserActionContribution[];
  components?: ComponentContribution[];
  guardrails?: GuardrailContribution[];

  playgroundScenarios?: PlaygroundScenario[];
  playgroundStubs?: Record<string, (args: unknown) => Promise<unknown>>;
}
```

```ts
// packages/harness/src/types/agent.ts
export interface AgentContribution {
  name: string;                           // "azure.architect"
  description: string;
  model: ModelRef;
  toolAllowlist: string[];                // ["azure.arm_get", "azure:create_subscription", "core.emit_ui"]
  handoffs: Handoff[];
  userInvocable: boolean;
  modelInvocable: boolean;
  instructionsBase: string;               // body of .agent.md
  outputType?: "AgentOutput";             // default
  mcpExposed?: boolean;
  source: { kind: "file" | "inline"; path?: string };
}

export interface Handoff {
  label: string;
  agent: string;
  prompt?: string;
  send?: boolean;
  model?: ModelRef;
}

export type ModelRef =
  | { envVar: string }                    // resolved at runtime
  | { id: string };                       // explicit deployment name
```

```ts
// packages/harness/src/types/skill.ts
export interface Skill {
  id: string;                             // "azure/bicep-modules" (pack-scoped)
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  instructions: string;                   // SKILL.md body
  appliesTo: string[];                    // ["azure.*", "core.codesmith"]
  keywords: string[];
  priority: number;
  source: { kind: "file" | "inline"; path?: string };
}
```

```ts
// packages/harness/src/types/tool.ts
import type { Tool as SDKTool } from "@openai/agents";

export interface ToolContribution {
  name: string;                           // "azure.arm_get"
  tool: SDKTool;
  mcpExposed?: boolean;                   // default true
}
```

```ts
// packages/harness/src/types/user-action.ts
import type { z } from "zod";

export interface UserActionContribution {
  name: string;                           // "azure:create_subscription"
  description: string;
  parameters: z.ZodTypeAny;
  resultSchema: z.ZodTypeAny;
  confirmComponent?: { component: string; props?: Record<string, unknown> };
  scopes?: string[];
  cancellation?: "supported" | "not-supported";    // default "not-supported" (queue)
  mcpExposed?: boolean;
}
```

```ts
// packages/harness/src/types/component.ts
import type { z } from "zod";
import type React from "react";

export interface ComponentContribution {
  name: string;                           // "azure/CostSummary"
  propertySchema: z.ZodTypeAny;
  renderer: React.ComponentType<any>;     // web-side only; server imports type
}
```

```ts
// packages/harness/src/types/guardrail.ts
export interface GuardrailInput {
  stage: 'input' | 'output' | 'tool';
  userMessage?: string;
  assistantMessage?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
}

export interface GuardrailResult {
  verdict: 'pass' | 'block' | 'redact';
  reason?: string;
  redacted?: string;  // replaced content for 'redact' verdict
}

export interface GuardrailContribution {
  id: string;                              // namespaced, e.g. "core/token-budget"
  stages: ('input' | 'output' | 'tool')[]; // which stages to fire on
  appliesTo?: string[];                    // agent-name globs; default all
  evaluate: (input: GuardrailInput) => Promise<GuardrailResult>;
}
```

```ts
// packages/harness/src/types/playground.ts
export interface PlaygroundScenario {
  id: string;                             // pack-scoped, e.g. "azure/cost-summary-basic"
  title: string;
  description?: string;
  group?: string;                         // optional sub-grouping inside a pack
  a2ui: A2UIMessage[];                    // pre-canned message sequence
  initialState?: Record<string, unknown>; // seed session data model
  requiresUserActionStubs?: string[];     // names of UserActions this scenario triggers
}
```

```ts
// packages/harness/src/types/agent-output.ts
import { z } from "zod";
export const AgentOutput = z.object({
  message: z.string(),
  intent: z.enum(["continue", "advance", "revise", "auto-continue-files"]).optional(),
});
export type AgentOutput = z.infer<typeof AgentOutput>;
```

```ts
// packages/harness/src/types/session.ts
export interface SessionCtx {
  sessionId: string;
  user: { tid: string; oid: string; upn: string };
  intent: AppIntent | null;
  artifacts: Map<string, Artifact>;
  negotiatedCatalog: A2UICatalog;
  recentTurns: Turn[];
  activeAgent: string;
  pendingUserAction: PendingUserAction | null;

  recordA2UIEmission(msg: A2UIMessage): void;
  recordArtifact(a: Artifact): void;
  recordTurn(t: Turn): void;
  getAzureCreds(): Promise<AzureCredential>;
  getGithubToken(): Promise<string>;
}
```

---

## 6. Authoring examples

### `.agent.md` — core.triage

```markdown
---
name: core.triage
description: Entry point. Clarifies the user's intent and routes to a specialist.
model:
  envVar: AZURE_OPENAI_CHAT_DEPLOYMENT
tools:
  - core.emit_ui
handoffs:
  - label: Design Azure architecture
    agent: azure.architect
    send: true
  - label: Design AKS Automatic architecture
    agent: aks.architect
    send: true
  - label: Generate files directly
    agent: core.codesmith
    send: true
user-invocable: true
disable-model-invocation: false
---

You are the triage agent for Kickstart.

Your job is to understand what the user wants to build. Ask only what you need to pick a specialist. Keep it short.

Use #tool:core.emit_ui to render short choice cards when the user needs to pick a direction.

When you have enough information, hand off. Never generate files yourself.
```

### `.agent.md` — aks.architect

```markdown
---
name: aks.architect
description: Designs AKS Automatic architectures with Gateway API, Workload Identity, and deployment safeguards.
model:
  envVar: AZURE_OPENAI_CHAT_DEPLOYMENT
tools:
  - azure.arm_get
  - azure.pricing_lookup
  - azure.estimate_cost
  - core.emit_ui
handoffs:
  - label: Generate the project
    agent: core.codesmith
    send: false
  - label: Write manifests
    agent: aks.manifests_author
    send: false
  - label: Back to discovery
    agent: core.triage
    send: false
user-invocable: false
disable-model-invocation: false
x-kickstart:
  mcpExposed: true
---

You are the AKS Automatic architect.

Produce a concrete architecture: service selection, region, SKU tier, networking, identity, and a cost estimate. Use Azure-friendly terminology with the user (see the terminology skill); use real K8s terms only in generation phases.

Render the architecture using `aks/ArchitectureDiagram`. Render cost with `azure/CostSummary`.

When the user approves, hand off to `core.codesmith` to start generation. When manifests are needed, hand off to `aks.manifests_author`.
```

### `SKILL.md` — gateway-api-mandatory

```markdown
---
name: gateway-api-mandatory
description: Gateway API is the only supported ingress model on AKS Automatic. Use when generating AKS manifests.
version: 1.0.0
author: kickstart-aks-pack
license: MIT
x-kickstart:
  appliesTo:
    - aks.architect
    - aks.manifests_author
    - core.codesmith
  keywords:
    - gateway
    - httproute
    - ingress
    - traffic
    - routing
    - nginx
  priority: 80
---

# Gateway API on AKS Automatic

## Non-negotiables
- GatewayClass is `approuting-istio`. Never use Ingress, never use nginx, never use L7 LoadBalancer Services.
- Every public route goes through a `Gateway` + `HTTPRoute` pair.

## Gateway
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: app-gateway
spec:
  gatewayClassName: approuting-istio
  listeners:
    - name: http
      port: 80
      protocol: HTTP
      allowedRoutes:
        namespaces:
          from: Same
```

## HTTPRoute
```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: app-route
spec:
  parentRefs:
    - name: app-gateway
  rules:
    - backendRefs:
        - name: app-service
          port: 80
```

## Cluster-level wiring (IaC)
The cluster's `ingressProfile` must set `webAppRouting.enabled=true`, `nginx.defaultIngressControllerType="None"`, `defaultDomain.enabled=true`, `gatewayAPIImplementations.appRoutingIstio.mode="Enabled"`, and `gatewayAPI.installation="Standard"`.
```

### Tool — `azure.arm_get`

```ts
// packages/pack-azure/src/tools/arm-get.ts
import { tool } from "@openai/agents";
import { z } from "zod";
import type { SessionCtx } from "@kickstart/harness";

export const armGet = tool({
  name: "azure.arm_get",
  description:
    "Call the Azure Resource Manager REST API (GET only). Use when you need to read state " +
    "to make a decision. NOT for selection lists — emit an azure/SubscriptionPicker etc. " +
    "component instead. Requires the user to be signed in.",
  parameters: z.object({
    path: z.string().describe(
      "ARM path starting with /subscriptions/... Use {sub-id} as a placeholder for the " +
      "active subscription id — the harness resolves it. Include api-version."
    ),
  }),
  execute: async ({ path }, runCtx) => {
    const session = runCtx.context as SessionCtx;
    const creds = await session.getAzureCreds();
    const resolved = await resolveSubscriptionPlaceholder(path, session);
    return await armClient.get(creds, resolved);
  },
});
```

### UserAction — `azure:create_subscription`

```ts
// packages/pack-azure/src/user-actions/create-subscription.ts
import { userAction } from "@kickstart/harness";
import { z } from "zod";

export const createSubscription = userAction({
  name: "azure:create_subscription",
  description:
    "Create a new Azure subscription under a billing account. Requires the user's credentials.",
  parameters: z.object({
    displayName: z.string().min(1),
    billingAccountId: z.string(),
  }),
  resultSchema: z.object({
    subscriptionId: z.string().uuid(),
    tenantId: z.string().uuid(),
  }),
  confirmComponent: { component: "azure/CreateSubscriptionConfirm" },
  scopes: ["https://management.azure.com/user_impersonation"],
  cancellation: "not-supported",
});
```

### Component — `azure/CostSummary`

```ts
// packages/pack-azure/src/components/CostSummary.tsx
import { z } from "zod";
import { defineComponent } from "@kickstart/harness";

export const costSummaryComponent = defineComponent({
  name: "azure/CostSummary",
  propertySchema: z.object({
    monthlyUsd: z.number(),
    breakdown: z.array(z.object({ service: z.string(), usd: z.number() })),
    region: z.string(),
    source: z.enum(["live", "cache", "fallback"]).optional(),
  }),
  renderer: CostSummary,
});

function CostSummary(props: { monthlyUsd: number; breakdown: Array<{ service: string; usd: number }>; region: string; source?: "live" | "cache" | "fallback" }) {
  // React render
}
```

### Guardrail — `aks.safeguards_compliance`

```ts
// packages/pack-aks-automatic/src/guardrails/safeguards-compliance.ts
import type { GuardrailContribution, SessionCtx } from "@kickstart/harness";
import safeguards from "../data/safeguards.json";

export const safeguardsCompliance: GuardrailContribution = {
  name: "aks.safeguards_compliance",
  stage: "tool",
  appliesTo: ["aks.*", "core.codesmith"],
  check: async (_ctx: SessionCtx, payload) => {
    const toolCall = payload as { name: string; arguments: unknown };
    if (toolCall.name !== "core.write_file") return { kind: "pass" };
    const violations = validateManifest(toolCall.arguments, safeguards);
    if (violations.length > 0) {
      return { kind: "block", reason: `Safeguard violations: ${violations.join(", ")}` };
    }
    return { kind: "pass" };
  },
};
```

### Pack manifest — `@kickstart/pack-aks-automatic`

```ts
// packages/pack-aks-automatic/src/index.ts
import type { Pack } from "@kickstart/harness";
import { validateManifests, validateSafeguards } from "./tools/index.js";
import { deploy } from "./user-actions/index.js";
import { architectureDiagram, safeguardsReport, gatewayRouteExplorer, workloadIdentityWiring } from "./components/index.js";
import { noLatestTag, safeguardsCompliance, noK8sTerminologyPreDeploy } from "./guardrails/index.js";
import { architectureDiagramScenario, deploymentSafeguardsScenario } from "./playground/index.js";

export const aksAutomaticPack: Pack = {
  name: "aks-automatic",
  version: "1.0.0",
  dependsOn: ["core", "azure"],
  agentsDir: new URL("../agents", import.meta.url),
  skillsDir: new URL("../skills", import.meta.url),
  tools: [validateManifests, validateSafeguards],
  userActions: [deploy],
  components: [architectureDiagram, safeguardsReport, gatewayRouteExplorer, workloadIdentityWiring],
  guardrails: [noLatestTag, safeguardsCompliance, noK8sTerminologyPreDeploy],
  playgroundScenarios: [architectureDiagramScenario, deploymentSafeguardsScenario],
  playgroundStubs: {
    "aks:deploy": async () => ({
      status: "Succeeded",
      url: "https://example.aks.azure.sabbour.me",
    }),
  },
};
```

---

## 7. Pack inventory (what each pack owns)

### `@kickstart/pack-core`

**Agents:** `core.triage`, `core.codesmith`, `core.reviewer`.

**Skills:** `collaborator-voice`, `a2ui-output-discipline`, `teach-then-ask`, `phase-acceleration`, `file-generation-batching`.

**Tools:** `core.emit_ui`, `core.write_file`, `core.read_file`, `core.list_files`, `core.validate_artifacts`, `core.fetch_webpage`.

**Components:** the 27 A2UI basic-catalog Fluent renderers (`basic/*`) + the domain-neutral rich components (`rich/*`: `CodeBlock`, `DecisionCard`, `FileEditor`, `FormGroup`, `GenerationProgress`, `Markdown`, `ProgressSteps`, `Questionnaire`, `RadioGroup`, `SteppedCarousel`, `SummaryCard`, `AuthCard`).

**Guardrails:** `core.token_budget`, `core.no_pii_in_logs`, `core.no_secrets_in_artifacts`.

### `@kickstart/pack-azure`

**Agents:** `azure.architect`, `azure.iac_author`.

**Skills:** `bicep-modules`, `secure-decorators`, `diagnostic-settings`, `resource-tagging`, `least-privilege-rbac`, `managed-identity-preference`, `arm-resource-templates`, `arm-role-assignment-rules`, `azure-regions-and-skus`.

**Tools:** `azure.arm_get`, `azure.pricing_lookup`, `azure.estimate_cost`, `azure.validate_bicep`, `azure.what_if`.

**UserActions:** `azure:login`, `azure:create_subscription`, `azure:pick_subscription`, `azure:pick_region`, `azure:pick_resource_group`, `azure:deploy_bicep`.

**Components:** `azure/Login`, `azure/SubscriptionPicker`, `azure/RegionPicker`, `azure/ResourceGroupPicker`, `azure/ResourceForm`, `azure/Action`, `azure/CostSummary`, `azure/DeploymentProgress`.

**Guardrails:** `azure.no_hardcoded_credentials`, `azure.no_subscription_scoped_owner`.

### `@kickstart/pack-aks-automatic`

**Agents:** `aks.architect`, `aks.manifests_author`, `aks.reviewer`.

**Skills:** `aks-automatic-cluster-creation`, `gateway-api-mandatory`, `workload-identity-mandatory`, `deployment-safeguards`, `acr-integration`, `kaito-gpu-models`, `aks-terminology-rules`.

**Tools:** `aks.validate_manifests`, `aks.validate_safeguards`.

**UserActions:** `aks:deploy`.

**Components:** `aks/ArchitectureDiagram`, `aks/DeploymentSafeguardsReport`, `aks/GatewayRouteExplorer`, `aks/WorkloadIdentityWiring`.

**Guardrails:** `aks.no_latest_tag`, `aks.safeguards_compliance`, `aks.no_k8s_terminology_pre_deploy`.

**Shared data:** `src/data/safeguards.json` — the deployment-safeguards list in machine-readable form, consumed by both the skill (injected as prose) and the guardrail (enforced programmatically). Single source of truth.

### `@kickstart/pack-github`

**Agents:** `github.publisher`.

**Skills:** `github-actions-oidc`, `github-actions-workflow-structure`, `github-pr-conventions`.

**Tools:** `github.api_get`.

**UserActions:** `github:login`, `github:pick_org`, `github:pick_repo`, `github:create_repo`, `github:create_pr`, `github:set_secret`.

**Components:** `github/Login`, `github/OrgPicker`, `github/RepoPicker`, `github/RepoInfo`, `github/Action`, `github/CreatePRFlow`, `github/SecretSetter`.

---

## 8. Mapping of today's monolith prompt → v2

| Today (v1 `system-prompt.ts`) | v2 location |
|---|---|
| §1 Persona | `core.triage.agent.md` body (short) + `collaborator-voice` skill (long) |
| §1a Collaborator voice | `collaborator-voice` skill |
| §2 Discover flow | `core.triage.agent.md` body |
| §2 Design flow | `azure.architect.agent.md` / `aks.architect.agent.md` bodies |
| §2 Generate flow | `core.codesmith.agent.md` body |
| §2 Review flow | `core.reviewer.agent.md` body |
| §2 Handoff flow | `github.publisher.agent.md` body |
| §2 Deploy flow | `aks.deployer.agent.md` (or equivalent per-platform pack) |
| §3 Terminology rules | `aks-terminology-rules` skill + `aks.no_k8s_terminology_pre_deploy` guardrail |
| §4 JSON envelope / A2UI rules | `a2ui-output-discipline` skill (rules) + `core.emit_ui` (mechanism) |
| §5 Component catalog | Generated dynamically from registry, injected per agent |
| §6 Deployment safeguards list | `deployment-safeguards` skill + `aks.safeguards_compliance` guardrail (backed by `safeguards.json`) |
| Architecture diagram rules | `aks/ArchitectureDiagram` docstring + diagram-authoring skill in `pack-aks-automatic` |
| ARM PUT body templates | `arm-resource-templates` skill in `pack-azure` |
| Role assignment rules | `arm-role-assignment-rules` skill in `pack-azure` |
| AKS Automatic domain knowledge | `aks-automatic-cluster-creation`, `gateway-api-mandatory`, `workload-identity-mandatory`, `acr-integration`, `kaito-gpu-models` skills |

---

## 9. Runtime — the converse handler

```ts
// packages/web/api/src/functions/converse.ts
import { Runner } from "@openai/agents";
import { registry, loadSession, writeSSE, AgentOutput } from "@kickstart/harness";
import { createAzureModelProvider } from "../lib/azure-provider.js";

export default async function converse(req: Request): Promise<Response> {
  const { sessionId, message } = await req.json();
  const session = await loadSession(sessionId, req);

  const agent = registry.getAgent(session.activeAgent ?? "core.triage");
  session.recordTurn({ role: "user", content: message });

  const runner = new Runner({ modelProvider: createAzureModelProvider() });

  const stream = await runner.run(agent, message, {
    stream: true,
    context: session,
    outputType: AgentOutput,
  });

  return new Response(
    new ReadableStream({
      async start(controller) {
        const write = writeSSE(controller);

        for await (const event of stream) {
          switch (event.type) {
            case "raw_model_stream_event":
              if (event.delta) write("chunk", { text: event.delta });
              break;

            case "tool_call_item":
              if (event.name === "core.emit_ui") {
                write("a2ui", event.arguments);
              } else {
                write("tool", { name: event.name, status: "started" });
              }
              break;

            case "tool_output_item":
              if (event.name !== "core.emit_ui") {
                write("tool", { name: event.name, status: "done" });
              }
              break;

            case "interrupt":
              await persistInterrupt(session, event);
              write("user_action_required", event.metadata);
              return;

            case "agent_updated_stream_event":
              session.activeAgent = event.agent.name;
              write("handoff", { agent: event.agent.name });
              break;

            case "final_output":
              const output = event.output as AgentOutput;
              if (output.intent) write("intent", { intent: output.intent });
              write("done", { usage: event.usage, nextAgent: session.activeAgent });
              break;
          }
        }

        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
```

Resume endpoint (`POST /api/converse/resume`) is symmetric: load session, find the paused Runner, call `runner.resume(runId, { userActionResult })`, stream the same event types.

## 10. SSE event types

| Event | Payload |
|---|---|
| `chunk` | `{ text }` — incremental text delta for `message` |
| `a2ui` | One complete A2UI v0.9 message |
| `tool` | `{ name, status: "started" \| "done" }` — for non-`emit_ui` tools |
| `user_action_required` | `{ actionId, toolName, args, confirmComponent, scopes }` |
| `artifact` | `{ path, bytes }` — file written |
| `handoff` | `{ agent }` — active agent swap |
| `intent` | `{ intent }` — from final `AgentOutput.intent` |
| `done` | `{ usage, nextAgent }` |
| `error` | `{ message, code? }` |

## 11. Pack registration at startup

```ts
// packages/web/api/src/startup/packs.ts
import { registry } from "@kickstart/harness";
import { corePack } from "@kickstart/pack-core";
import { azurePack } from "@kickstart/pack-azure";
import { aksAutomaticPack } from "@kickstart/pack-aks-automatic";
import { githubPack } from "@kickstart/pack-github";

export async function initPacks(): Promise<void> {
  await registry.register(corePack);
  await registry.register(azurePack);
  await registry.register(aksAutomaticPack);
  await registry.register(githubPack);

  const enabled = (process.env.KICKSTART_PACKS ?? "core,azure,aks-automatic,github")
    .split(",")
    .map(s => s.trim());
  registry.enable(enabled);

  registry.seal();
}
```

`register` walks `agentsDir` and `skillsDir`, parses files, resolves tool references in agent frontmatter against registered tools/user-actions (sigil tells which), indexes by name. Throws on unresolved references, name collisions, or circular pack dependencies.

---

## 12. Playground

**Keep it.** The playground is the fastest A2UI feedback loop and the only way to exercise the catalog without an LLM.

### Adaptations

1. **Scenarios live in the pack that owns their components.** Each pack contributes `playgroundScenarios` alongside components. No hardcoded `GALLERY_GROUPS` array.
2. **The playground page reads from the registry.** Enumerates `registry.components` and `registry.playgroundScenarios`, groups by pack, renders sidebar. Toggling `KICKSTART_PACKS` changes what appears.
3. **Auth stubs split across packs.** `pack-azure` and `pack-github` each contribute `playgroundStubs` keyed by UserAction name. In playground mode, the UserAction dispatcher routes to stubs instead of the real browser flow.
4. **Surface-id churn regression test** (`playground-surfaceids.test.ts`) stays. Updated to read from registry.

### Invariant
**Playground does not bypass the registry.** Same component catalog and user-action manifest as the real app. Unregistered references fail loudly at load time.

---

## 13. Invariants the agent must preserve

- **LLM never sees React.** Only A2UI component names + property schemas.
- **LLM never sees skill bodies as user messages.** Skills → agent dynamic instructions only.
- **A2UI messages never concatenate into an envelope.** One `core.emit_ui` call = one A2UI message = one SSE `a2ui` event. No incremental JSON parser anywhere.
- **UserActions always pause the Runner.** Never execute user-credentialed work server-side.
- **Every Tool and UserAction has Zod parameter and return schemas.** No `any`.
- **No feature flags.** v2 is the only code path. `KICKSTART_PACKS` is config, not a flag.
- **No synthetic user messages.** Domain knowledge flows through agent instructions, not fake turns.
- **Pack names and contribution names are globally unique at startup.** Registry throws on collision.
- **The registry is sealed after startup.** No runtime registration.
- **The harness is domain-agnostic.** Must compile and function with only `pack-core` registered.
- **Packs declare dependencies.** `pack-aks-automatic` depends on `pack-azure`; registry enforces load order.
- **No component is registered anywhere except in a pack.** The web catalog is not a source of truth. `registry.components` is. Playground, A2UI renderer, and agent prompts all read from the registry.
- **Playground does not bypass the registry.** Scenarios reference registered components and UserActions; unregistered references fail at load time.

---

## 14. Implementation order

Each step compiles, tests green, before moving on. Land as sequential PRs on `main`.

**Step 1 — nuke v1.** Delete v1 paths listed in §4. Rename `packages/core` → `packages/harness`. Preserve: Azure OpenAI client, `@kickstart/mcp-server` shell, web shell (`components/`, `contexts/`, auditable `hooks/`), Playground page files, `catalog/components/` + `catalog/fluent-components/` + `catalog/icons/` (to be redistributed), `services/api-client.ts`, `services/virtual-fs.ts`, frontmatter parser. Repo compiles; no runtime yet.

**Step 2 — harness types.** Add every file under `packages/harness/src/types/`. Zod schemas for `AgentOutput` and A2UI v0.9 messages. Move `utils/chat-a2ui.ts` into harness. No runtime yet.

**Step 3 — registry + loaders.** `PackRegistry` (register/enable/seal). `.agent.md` loader. `SKILL.md` loader. Unit tests covering frontmatter parsing, tool-reference resolution, collision detection, dependency ordering.

**Step 4 — pack-core.** Author the three `.agent.md` files. Author the five `SKILL.md` files. Implement `core.emit_ui`, `core.write_file`, `core.read_file`, `core.list_files`, `core.validate_artifacts`, `core.fetch_webpage`. Port 27 basic Fluent renderers + 12 rich components from `catalog/` into `pack-core/src/components/{basic,rich}/`.

**Step 4a — playground on registry.** Rewrite `Playground.tsx` / `PlaygroundWorkspace.tsx` to read from the registry. Port a handful of core-domain scenarios into `pack-core/playground/`. Useful validation of the registry shape before domain packs land.

**Step 5 — runner + SSE.** Converse handler. Resume handler. `/api/packs` manifest. Rewrite `hooks/useStreaming.ts` for typed SSE. Rewrite `hooks/useActionDispatch.ts` as the UserAction dispatcher. Integration test: triage → codesmith with a mocked model, asserting SSE event order (`chunk`, `a2ui`, `handoff`, `intent`, `done`).

**Step 6 — skill resolver.** Per-turn selection by `appliesTo` glob + keyword scoring + priority + token budget (2000 tokens default). Unit tests.

**Step 7 — pack-azure.** Port 2 agents, 9 skills. Port 5 tools. Port 6 user actions (using ported `services/azure-auth.ts`, `services/azure-deployments.ts`). Port 8 components including `AzureLoginCard`→`Login`, `AzureResourcePicker`→`SubscriptionPicker`/`RegionPicker`/`ResourceGroupPicker`, `AzureResourceForm`→`ResourceForm`, `AzureAction`→`Action`, `CostEstimate`→`CostSummary`. Port Azure icon assets. Author playground scenarios + stubs.

**Step 8 — pack-aks-automatic.** Port 3 agents, 7 skills, `safeguards.json`. 2 tools. 1 user action. Port `ArchitectureDiagram.tsx` + `architectureDiagramIconRegistry.ts` + `architectureDiagramUtils.ts` (with tests) + k8s icons. 3 new components. 3 guardrails. Playground scenarios.

**Step 9 — pack-github.** 1 agent, 3 skills. 1 tool. 6 user actions (port from adaptive-ui-github-pack logic and `services/github-handoff.ts`). Port `GitHubLoginCard`→`Login`, `GitHubRepoPicker`→`RepoPicker`, `GitHubCommit`→`CreatePRFlow`, `GitHubAction`→`Action`. Playground scenarios + stubs.

**Step 10 — web client.** Rewrite `components/A2UI/` to consume the negotiated catalog from the registry. `useActionDispatch` routes `user_action_required` → pack handlers (real or stub). Queue policy (cancellation opt-in per action).

**Step 11 — guardrails engine.** Wire stages into Runner lifecycle. Port existing ad-hoc checks (today's regex scattered across v1) into `GuardrailContribution`s.

**Step 12 — MCP.** Rewrite `@kickstart/mcp-server` shell to wrap Runner turns. Emit A2UI as MCP embedded resources with `mimeType: "application/json+a2ui"` and `audience: ["user"]`. UserActions surfaced as MCP `action` tool calls.

**Step 13 — docs + cleanup.** Rewrite `docs/` and `docs-site/` around harness + packs. Delete every reference to phases, stepwise, v1 flags, `IntegrationKit`, `converse-model-router`, `response-processor`.

---

## 15. Open items to flag, not block on

- **Token budget for skill injection per agent turn.** Start at 2000 tokens; measure and tune.
- **`core.emit_ui` schema shape.** One tool with a tagged-union parameter across all A2UI message types, vs. one tool per message type (`emit_create_surface`, `emit_update_components`, etc.). Start with tagged union; split only if the model struggles to pick payload shape.
- **Session persistence.** Keep existing storage; rewrite only the adapter.
- **Telemetry.** Port existing structured logs; emit on every agent turn, tool call, guardrail verdict, user action.
- **A2UI progressive `updateComponents`.** When an agent streams a long component list, we may want it to break across multiple `emit_ui` calls for snappier progressive rendering. Agents can decide; no harness change needed.

---

## 16. Naming conventions recap

| Kind | Sigil | Wire transliteration | Example |
|---|---|---|---|
| Tool | `.` | identity | `azure.arm_get` |
| UserAction | `:` | `:` → `__` | `azure:create_subscription` → `azure__create_subscription` |
| Component | `/` | never in tool schemas; used as string in A2UI `component` field | `azure/CostSummary` |
| Skill id | `/` | never in tool schemas | `azure/bicep-modules` |
| Agent | `.` | identity | `aks.architect` |
| Pack | — | identity | `aks-automatic` |

---

**End of brief.** Hand to the implementing agent. Start with Step 1.
