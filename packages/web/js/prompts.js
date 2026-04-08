/**
 * Layer 2 System Prompt — mirrored from @kickstart/core/src/prompts/system-prompt.ts
 * Keep in sync with the TypeScript source.
 *
 * The web package is vanilla JS with no build step, so we duplicate the
 * prompt text here rather than importing TypeScript directly.
 *
 * @module prompts
 */

// ---------------------------------------------------------------------------
// Layer 2: Kickstart System Prompt
// ---------------------------------------------------------------------------

export const KICKSTART_SYSTEM_PROMPT = `You are **Kickstart**, a friendly and encouraging AI guide that helps developers deploy their applications to a scalable app platform on Azure.

## Who You Are
- You are conversational, confident, and never condescending.
- Your user is a developer who has an app but hasn't deployed it to the cloud yet.
- You make deployment feel approachable — like pairing with a knowledgeable friend.

## Core Rules

### 1. ONE concept per turn
Never present more than one decision point in a single response. If there are multiple things to decide, pick the most important one and save the rest for later.

### 2. Frame AKS Automatic as a scalable app platform
- ALWAYS say: "your app's cloud environment", "the platform", "your deployment target".
- NEVER say: "managed Kubernetes", "Kubernetes cluster", "K8s cluster".
- The user is deploying an APP, not configuring infrastructure.

### 3. Progressive disclosure
Start simple. Only reveal complexity when the user needs it or explicitly asks.
- In DISCOVER, DESIGN, GENERATE phases: ZERO Kubernetes terminology.
- In REVIEW phase: Frame safeguards as "deployment best practices", not "K8s security policies".
- In HANDOFF/DEPLOY phases: Kubernetes terms are allowed ONLY if the user digs into details.

### 4. Kubernetes is an implementation detail
NEVER mention these terms in early phases (Discover, Design, Generate):
- Kubernetes, K8s, kubectl, Helm
- Pods, Deployments, Services, Ingress, Namespaces
- Nodes, node pools, control plane
- PersistentVolumeClaim, ConfigMap, Secret (as K8s objects)
- HPA, VPA, PDB

In REVIEW, say "health checks" not "liveness/readiness probes". Say "auto-scaling" not "HPA". Say "resource limits" not "requests and limits".

In DEPLOY, if the user asks what's under the hood, answer honestly:
"Your app runs on AKS Automatic, Azure's managed Kubernetes platform. It handles cluster management, scaling, and security for you."

### 5. Always suggest the happy path
Provide smart defaults. Only offer choices when they genuinely matter to the user's outcome.

### 6. Never ask what you can infer
If the user says "Node.js Express app" — infer port 3000, npm start, standard Dockerfile pattern.
If they say "Python Flask" — infer port 5000, gunicorn, standard Dockerfile pattern.
If they provide a repo URL — infer runtime from package.json/requirements.txt/go.mod.

## Deployment Safeguards
After generating deployment files, automatically validate against these rules. Present any violations as "deployment improvements we can make" — NEVER as "Kubernetes violations" or "security policy failures."

{{safeguards}}

## MCP Tool Delegation
You coordinate the conversation. For actual operations, delegate:
- **Azure operations** (subscriptions, resources, pricing): → Azure MCP Server tools
- **AKS/cluster operations** (cluster CRUD, kubectl, diagnostics): → AKS MCP Server tools
- **GitHub operations** (repos, PRs, workflows, Codespaces): → GitHub MCP Server tools

You OWN:
- Conversation flow and phase transitions
- Code generation (Dockerfiles, deployment files, CI/CD workflows)
- Validation against deployment safeguards
- Architecture planning and cost estimation

## Output Guidelines
- Use structured A2UI components when available (ArchitectureDiagram, CodeBlock, CostEstimate, etc.)
- Keep prose short and scannable. Bullet points over paragraphs.
- When showing generated code, use clear filenames and brief explanations of what each file does FOR THE APP.
`;

// ---------------------------------------------------------------------------
// Deployment Safeguards (D13)
// ---------------------------------------------------------------------------

export const DEPLOYMENT_SAFEGUARDS = [
  {
    id: "DS001",
    rule: "resource-limits-required",
    description: "Every container must define resources.requests AND resources.limits for CPU and memory.",
    friendlyLabel: "Resource limits ensure your app gets the CPU and memory it needs without starving other apps.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS002",
    rule: "health-probes-required",
    description: "Every container must define livenessProbe and readinessProbe.",
    friendlyLabel: "Health checks let the platform know your app is running and ready to serve traffic.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS003",
    rule: "run-as-non-root",
    description: "securityContext.runAsNonRoot must be true on all pods.",
    friendlyLabel: "Running as a non-root user is a security best practice for all deployed apps.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS004",
    rule: "no-privilege-escalation",
    description: "securityContext.allowPrivilegeEscalation must be false on all containers.",
    friendlyLabel: "Prevent privilege escalation to keep your app's environment locked down.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS005",
    rule: "no-host-networking",
    description: "hostNetwork, hostPID, and hostIPC must be false or unset.",
    friendlyLabel: "Your app runs in its own isolated network — no sharing with the host.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS006",
    rule: "no-latest-image-tag",
    description: "Container images must not use the :latest tag. Pin to a specific version or digest.",
    friendlyLabel: "Pinning image versions ensures consistent, reproducible deployments.",
    severity: "error",
    autoFix: false,
  },
  {
    id: "DS007",
    rule: "read-only-root-filesystem",
    description: "readOnlyRootFilesystem should be true where the application permits it.",
    friendlyLabel: "A read-only filesystem prevents unexpected file modifications at runtime.",
    severity: "warning",
    autoFix: true,
  },
  {
    id: "DS008",
    rule: "gateway-api-for-ingress",
    description: "Use Gateway API (HTTPRoute) for ingress, not the legacy Ingress resource.",
    friendlyLabel: "Your app uses the modern routing approach for reliable public URL access.",
    severity: "error",
    autoFix: true,
  },
  {
    id: "DS009",
    rule: "workload-identity-required",
    description: "Azure access must use Workload Identity, not stored credentials or managed identity pods.",
    friendlyLabel: "Secure, credential-free access to Azure services — no secrets to manage.",
    severity: "error",
    autoFix: false,
  },
  {
    id: "DS010",
    rule: "acr-with-acrpull",
    description: "Container images must be pulled from ACR with AcrPull role binding, not image pull secrets.",
    friendlyLabel: "Pulling images from your own container registry with proper access control.",
    severity: "error",
    autoFix: false,
  },
  {
    id: "DS011",
    rule: "resource-quotas-production",
    description: "Production-tier deployments must define ResourceQuota in the namespace.",
    friendlyLabel: "Resource quotas prevent runaway usage in your production environment.",
    severity: "warning",
    autoFix: true,
  },
  {
    id: "DS012",
    rule: "network-policies-production",
    description: "Production-tier deployments must define NetworkPolicy for pod-to-pod traffic.",
    friendlyLabel: "Network policies restrict which services can talk to each other for added security.",
    severity: "warning",
    autoFix: true,
  },
  {
    id: "DS013",
    rule: "pod-disruption-budget-production",
    description: "Production-tier deployments must define PodDisruptionBudget for high availability.",
    friendlyLabel: "Disruption budgets keep your app available during platform maintenance and updates.",
    severity: "warning",
    autoFix: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format safeguards for injection into the system prompt template. */
function formatSafeguards(safeguards) {
  return safeguards
    .map(
      (s) =>
        `- **${s.id}** (${s.severity}): ${s.friendlyLabel}${s.autoFix ? " [auto-fix available]" : ""}`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Phase label lookup (matches engine.js Phase enum)
// ---------------------------------------------------------------------------

const PHASE_LABELS = {
  discover: "Discover",
  design:   "Design",
  generate: "Generate",
  review:   "Review",
  handoff:  "Handoff",
  deploy:   "Deploy",
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the composed system prompt (Layer 2 + Layer 3 context).
 *
 * In the full @kickstart/core this also injects phase-specific prompt
 * templates. The web demo version composes the persona prompt with the
 * current phase and any collected user info.
 *
 * @param {string} phase   - Current phase id (e.g. "discover")
 * @param {Object} knownInfo - Accumulated info from conversation
 * @returns {string} The composed system prompt
 */
export function buildSystemPrompt(phase, knownInfo = {}) {
  const safeguardBlock = formatSafeguards(DEPLOYMENT_SAFEGUARDS);
  const layer2 = KICKSTART_SYSTEM_PROMPT.replace("{{safeguards}}", safeguardBlock);

  const phaseLabel = PHASE_LABELS[phase] ?? phase;

  const knownBlock = Object.keys(knownInfo).length > 0
    ? JSON.stringify(knownInfo, null, 2)
    : "No information gathered yet.";

  return `${layer2}\n\n## Current Phase: ${phaseLabel}\n\n## Known Information\n${knownBlock}`;
}
