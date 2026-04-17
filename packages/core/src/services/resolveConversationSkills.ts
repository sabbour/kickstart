/**
 * @module @kickstart/core/services/resolveConversationSkills
 *
 * Per-turn dynamic skill injection for the Kickstart conversation engine.
 *
 * Pattern modelled after adaptive-ui's `resolvePackSkills`: detect the domain
 * of the current user message via keyword matching, then inject a compact,
 * targeted knowledge block as a one-time user message rather than baking it
 * into the static system prompt. This saves 500-1000 tokens per subsequent
 * turn and ensures the LLM gets the *right* knowledge at the *right* moment.
 *
 * Usage in the converse handler:
 *   const { domainKnowledge, currentState } = resolveConversationSkills(
 *     body.message,
 *     currentPhase,
 *     sessionContext,
 *   );
 *   if (domainKnowledge) {
 *     messages.push({ role: "user", content: domainKnowledge });
 *   }
 *   // Append currentState to the final user message so the LLM has a live
 *   // snapshot without relying on conversation history alone.
 */

import {
  AKS_PATTERNS,
  AUTH_PATTERNS,
  CICD_PATTERNS,
  DATABASE_RELATIONAL_PATTERNS,
  DOCKER_PATTERNS,
} from "../engine/skill-vocabulary.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Serialisable session snapshot — only non-sensitive keys. */
export interface ConversationSkillsContext {
  /** Current FSM phase, e.g. "discover" | "design" | "generate" */
  phase: string;
  /** Collected app definition fields (partial) */
  appDefinition?: {
    runtime?: string;
    appType?: string;
    name?: string;
    databaseType?: string;
    needsIngress?: boolean;
    resourceTier?: string;
  };
  /** Filenames generated so far in this session */
  filesGenerated?: string[];
}

/** Result returned by resolveConversationSkills. */
export interface ConversationSkillsResult {
  /**
   * Targeted domain knowledge for THIS request.
   * Inject as a user message immediately before the real user message.
   * null when no relevant domain matched — omit the injection entirely.
   */
  domainKnowledge: string | null;
  /**
   * Compact snapshot of the current session state.
   * Append to the real user message as a structured context block so the LLM
   * has ground truth for what is already established without re-scanning history.
   */
  currentState: string;
}

// ---------------------------------------------------------------------------
// Domain detection — keyword groups
// ---------------------------------------------------------------------------

type Domain =
  | "stack-node"
  | "stack-python"
  | "stack-dotnet"
  | "stack-java"
  | "stack-go"
  | "infra-docker"
  | "infra-aks"
  | "infra-cicd"
  | "auth"
  | "data-relational"
  | "data-nosql"
  | "data-cache"
  | "data-queue"
  | "component-form"
  | "component-table"
  | "component-chart";

const DOMAIN_PATTERNS: Array<{ domain: Domain; patterns: readonly RegExp[] }> = [
  {
    domain: "stack-node",
    patterns: [/\bnode(\.?js)?\b/i, /\btypescript\b/i, /\bexpress\b/i, /\bnestjs\b/i, /\bnpm\b/i],
  },
  {
    domain: "stack-python",
    patterns: [/\bpython\b/i, /\bfastapi\b/i, /\bflask\b/i, /\bdjango\b/i, /\bpip\b/i, /\buvicorn\b/i],
  },
  {
    domain: "stack-dotnet",
    patterns: [/\b\.net\b/i, /\bc#\b/i, /\basp\.?net\b/i, /\bdotnet\b/i, /\bnuget\b/i],
  },
  {
    domain: "stack-java",
    patterns: [/\bjava\b/i, /\bspring\b/i, /\bmaven\b/i, /\bgradle\b/i, /\bquarkus\b/i],
  },
  {
    domain: "stack-go",
    patterns: [/\bgolang\b/i, /\b\bgo\b.*\bapp\b/i, /\bgo mod\b/i, /\bgin\b/i, /\becho\b.*\bgo\b/i],
  },
  {
    domain: "infra-docker",
    patterns: DOCKER_PATTERNS,
  },
  {
    domain: "infra-aks",
    patterns: AKS_PATTERNS,
  },
  {
    domain: "infra-cicd",
    patterns: CICD_PATTERNS,
  },
  {
    domain: "auth",
    patterns: AUTH_PATTERNS,
  },
  {
    domain: "data-relational",
    patterns: DATABASE_RELATIONAL_PATTERNS,
  },
  {
    domain: "data-nosql",
    patterns: [/\bmongodb?\b/i, /\bcosmos\b/i, /\bnosql\b/i, /\bdocument db\b/i],
  },
  {
    domain: "data-cache",
    patterns: [/\bredis\b/i, /\bcache\b/i, /\bsession store\b/i, /\bmemcached\b/i],
  },
  {
    domain: "data-queue",
    patterns: [/\bservice bus\b/i, /\bqueue\b/i, /\bmessage\b.*\bbroker\b/i, /\bevent hub\b/i, /\brabbitmq\b/i, /\bkafka\b/i],
  },
  {
    domain: "component-form",
    patterns: [/\bform\b/i, /\binput\b/i, /\bvalidat(e|ion)\b/i, /\bsubmit\b/i],
  },
  {
    domain: "component-table",
    patterns: [/\btable\b/i, /\bgrid\b/i, /\blist.*view\b/i, /\bdata.*grid\b/i],
  },
  {
    domain: "component-chart",
    patterns: [/\bchart\b/i, /\bgraph\b/i, /\bvisuali(z|s)ation\b/i, /\bmetrics?\b/i, /\bdashboard\b/i],
  },
];

// ---------------------------------------------------------------------------
// Knowledge snippets — one per domain, kept SHORT (50-150 tokens)
// ---------------------------------------------------------------------------

const DOMAIN_KNOWLEDGE: Record<Domain, string> = {
  "stack-node": `[Domain knowledge: Node.js]
- Use multi-stage Dockerfile: build stage (node:20-alpine, npm ci, npm run build), runtime stage (node:20-alpine, non-root user, COPY dist).
- Health endpoint: GET /health returns 200 { status: "ok" }. Mount at readiness + liveness probe path.
- Graceful shutdown: listen for SIGTERM, drain active connections before process.exit(0).
- Environment config: use process.env, never hardcode. Validate required vars at startup and fail fast.`,

  "stack-python": `[Domain knowledge: Python]
- Use multi-stage Dockerfile: build stage (python:3.12-slim, pip install --no-cache-dir), runtime stage (non-root user, COPY only app code).
- Health endpoint: GET /health returns 200 {"status": "ok"}. Required for readiness probe.
- Use gunicorn + uvicorn workers for production: CMD ["gunicorn", "-k", "uvicorn.workers.UvicornWorker", "main:app"].
- Secrets via environment variables only. Never import .env files in container images.`,

  "stack-dotnet": `[Domain knowledge: .NET]
- Multi-stage Dockerfile: sdk image for build (dotnet publish -c Release), aspnet runtime image for final stage.
- Health endpoint: app.MapHealthChecks("/health"). Use AddHealthChecks() in services.
- Use IConfiguration for config binding. Never hardcode connection strings — use managed identity + Key Vault references.
- Use ASPNETCORE_URLS=http://+:8080 rather than 443 inside the container.`,

  "stack-java": `[Domain knowledge: Java / Spring]
- Multi-stage Dockerfile: maven or gradle build stage, then eclipse-temurin:21-jre runtime stage.
- Health endpoint: Spring Actuator /actuator/health. Add spring-boot-starter-actuator to pom.xml.
- JVM tuning: set -XX:MaxRAMPercentage=75.0 to stay within container memory limits.
- Secrets: use Spring Cloud Azure + Key Vault references, not application.properties values.`,

  "stack-go": `[Domain knowledge: Go]
- Multi-stage Dockerfile: golang:1.22-alpine build stage (CGO_ENABLED=0 go build), scratch or distroless final stage.
- Health endpoint: GET /healthz returns 200 "ok". Minimal handler with no external dependencies.
- Use context propagation for cancellation. Respect ctx.Done() in long-running operations.
- Build with -ldflags="-s -w" to strip debug symbols and reduce binary size.`,

  "infra-docker": `[Domain knowledge: Dockerfile best practices]
- Always pin base image tags (node:20.14-alpine, not node:20-alpine or node:latest).
- Multi-stage: separate build and runtime stages. Only copy compiled output into the final stage.
- Non-root user: RUN addgroup + adduser before COPY, switch with USER before CMD.
- COPY package*.json before COPY . — this caches the dependency layer when only app code changes.`,

  "infra-aks": `[Domain knowledge: AKS Automatic deployment]
- AKS Automatic SKU: tier Standard. Do NOT set dnsPrefix, networkProfile, or nodeResourceGroup.
- Workload Identity: use User-Assigned Managed Identity + Federated Credential. Never connection strings.
- Gateway API (mandatory): GatewayClass "approuting-istio". Always Gateway + HTTPRoute. Never legacy Ingress.
- Always generate: HPA (min 2, max 10, CPU 70%), PDB (minAvailable 1), resource requests+limits.`,

  "infra-cicd": `[Domain knowledge: GitHub Actions CI/CD for AKS]
- Build and push to ACR: use docker/build-push-action with the commit SHA as the image tag.
- Login to ACR: use azure/docker-login with AZURE_CREDENTIALS secret.
- Deploy step: kubectl apply -f k8s/ or helm upgrade --install. Set KUBECONFIG from secret.
- Use on: push: branches: [main] for auto-deploy. Add a manual workflow_dispatch trigger too.`,

  "auth": `[Domain knowledge: Azure authentication patterns]
- Workload Identity: pod ServiceAccount with azure.workload.identity/client-id annotation. No secrets needed.
- GitHub OAuth: device flow for CLI. Web flow for browser apps. Store token server-side, never in localStorage.
- MSAL for Azure: use @azure/identity DefaultAzureCredential in code — works both locally and in AKS via Workload Identity.
- Never store bearer tokens or connection strings in environment variables inside the container image.`,

  "data-relational": `[Domain knowledge: Relational database on Azure]
- Azure Database for PostgreSQL Flexible Server: use Managed Identity + passwordless connection (azure_ad_admin).
- Connection via Workload Identity: get access token from IMDS, pass as password to the PostgreSQL driver.
- Always use a connection pool (pg-pool for Node, SQLAlchemy pool for Python) — avoid per-request connections.
- SSL required: set sslmode=require. The server cert is trusted by default in Azure.`,

  "data-nosql": `[Domain knowledge: NoSQL on Azure]
- Azure Cosmos DB: use DefaultAzureCredential for auth (no connection strings). Role: Cosmos DB Built-in Data Contributor.
- MongoDB API: same Cosmos DB endpoint, Mongo driver compatible. Use @azure/cosmos or native Mongo client.
- Partition key design is the most important scaling decision — choose a key with high cardinality and even write distribution.`,

  "data-cache": `[Domain knowledge: Redis on Azure]
- Azure Cache for Redis: use Managed Identity via azure/identity + StackExchange.Redis or ioredis with token auth.
- Connection string format: {host}:{port},password={token},ssl=True,abortConnect=False
- Set appropriate TTLs. Use EXPIRE or EXPIREAT — never store session data without an expiry.
- Redis is not a primary store. Design for cache misses: always have a fallback read path.`,

  "data-queue": `[Domain knowledge: Messaging on Azure]
- Azure Service Bus: use DefaultAzureCredential (no SAS tokens). Role: Azure Service Bus Data Sender/Receiver.
- Dead letter queue (DLQ): always configure maxDeliveryCount and handle DLQ messages with an alert.
- Idempotency: messages may be delivered more than once. Use messageId deduplication or idempotent handlers.
- Sessions: use session-enabled queues for ordered processing of related messages.`,

  "component-form": `[Domain knowledge: Form components]
- Use TextField for free-form input. Use ChoicePicker or RadioGroup for enumerated choices. Never ask for typed selection in plain text.
- Validate client-side with immediate feedback. Validate server-side before persisting — both are required.
- Group related fields in a Card. Use a primary Button for the submit action. Use Alert for validation errors (never inline text).`,

  "component-table": `[Domain knowledge: Table components]
- Use Table component for tabular data — never Markdown tables in the message field.
- For large datasets, include pagination or a ComboBox for filtering.
- Prefer SummaryCard for 3-7 discrete key-value facts. Use Table only when rows are variable and the schema is uniform.`,

  "component-chart": `[Domain knowledge: Metrics and charts]
- CostEstimate for cost breakdowns. GenerationProgress for multi-step tracking.
- For operational metrics, use a DecisionCard with key numbers inline — avoid rendering external chart libraries.
- Keep data visualisation components self-contained: include the data in the component payload, not as a separate API call.`,
};

// ---------------------------------------------------------------------------
// Current state formatter
// ---------------------------------------------------------------------------

/**
 * Build a compact, human-readable snapshot of what the session knows so far.
 * Injected into every user message so the LLM has ground truth without
 * re-scanning conversation history.
 */
function formatCurrentState(phase: string, ctx: ConversationSkillsContext): string {
  const lines: string[] = ["[Current session context]"];

  lines.push(`Phase: ${phase}`);

  const def = ctx.appDefinition ?? {};
  if (def.name) lines.push(`App name: ${def.name}`);
  if (def.appType) lines.push(`App type: ${def.appType}`);
  if (def.runtime) lines.push(`Runtime: ${def.runtime}`);
  if (def.databaseType) lines.push(`Database: ${def.databaseType}`);
  if (def.needsIngress !== undefined) lines.push(`Public URL: ${def.needsIngress ? "yes" : "no"}`);
  if (def.resourceTier) lines.push(`Resource tier: ${def.resourceTier}`);

  if (ctx.filesGenerated?.length) {
    lines.push(`Files generated: ${ctx.filesGenerated.join(", ")}`);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Detect which domains the current user message touches, then return:
 * - `domainKnowledge`: a targeted multi-domain knowledge block to inject as a
 *   user message before the real user message (null if no match).
 * - `currentState`: a compact session snapshot to append to the real user
 *   message, giving the LLM ground truth for what is already established.
 *
 * @param userMessage   The raw text of the user's current message.
 * @param phase         The current conversation phase (FSM state).
 * @param sessionContext Non-sensitive session state fields.
 */
export function resolveConversationSkills(
  userMessage: string,
  phase: string,
  sessionContext: ConversationSkillsContext,
): ConversationSkillsResult {
  const currentState = formatCurrentState(phase, sessionContext);

  // Detect which domains the message touches
  const matchedDomains = new Set<Domain>();

  // Also check appDefinition runtime so we always inject stack knowledge
  // even when the user asks something general like "generate files"
  const runtimeDomain = runtimeToDomain(sessionContext.appDefinition?.runtime);
  if (runtimeDomain) {
    matchedDomains.add(runtimeDomain);
  }

  const textToScan = userMessage.toLowerCase();
  for (const { domain, patterns } of DOMAIN_PATTERNS) {
    if (patterns.some((p) => p.test(textToScan))) {
      matchedDomains.add(domain);
    }
  }

  // Phase-specific domain injection — always include infrastructure knowledge
  // during Generate and Deploy phases regardless of message content
  if (phase === "generate" || phase === "deploy") {
    matchedDomains.add("infra-aks");
    matchedDomains.add("infra-docker");
  }
  if (phase === "handoff" || phase === "deploy") {
    matchedDomains.add("infra-cicd");
  }

  if (matchedDomains.size === 0) {
    return { domainKnowledge: null, currentState };
  }

  const snippets = [...matchedDomains]
    .map((d) => DOMAIN_KNOWLEDGE[d])
    .filter(Boolean)
    .join("\n\n");

  const domainKnowledge =
    `The following domain knowledge is relevant to this request. ` +
    `Use it as authoritative guidance for this turn:\n\n${snippets}`;

  return { domainKnowledge, currentState };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runtimeToDomain(runtime?: string): Domain | null {
  if (!runtime) return null;
  const r = runtime.toLowerCase();
  if (r.includes("node") || r.includes("typescript") || r.includes("javascript")) return "stack-node";
  if (r.includes("python")) return "stack-python";
  if (r.includes("dotnet") || r.includes(".net") || r.includes("csharp") || r.includes("c#")) return "stack-dotnet";
  if (r.includes("java")) return "stack-java";
  if (r.includes("go")) return "stack-go";
  return null;
}
