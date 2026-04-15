import type { DemoResponse, A2uiMsg, A2uiComponent } from '../types';
import type { VirtualFileSystem } from './virtual-fs';

const CATALOG_ID = 'kickstart';

function surface(surfaceId: string, components: A2uiComponent[]): A2uiMsg[] {
  return [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: CATALOG_ID } },
    { version: 'v0.9', updateComponents: { surfaceId, components } },
  ];
}

const WELCOME: DemoResponse = {
  text: "Welcome to **Kickstart**! I help you deploy apps to AKS Automatic — fast, opinionated, and without the Kubernetes complexity.\n\nPick a track to get started, or just describe what you want to build.",
  phase: 'discover',
  model: 'gpt-5.3-chat',
  typingDelay: 1200,
  a2uiMessages: surface('welcome-surface', [
    { id: 'root', component: 'Column', children: ['title-text', 'radio-group'] },
    { id: 'title-text', component: 'Text', text: 'Choose your path', variant: 'subtitle1' },
    { id: 'radio-group', component: 'RadioGroup',
      options: [
        { id: 'web-app', label: 'Web App or API', description: 'Ship a web frontend, REST API, or microservice with CI/CD and a production URL.', recommended: true },
        { id: 'agentic', label: 'AI Agent', description: 'Deploy an AI agent that calls tools, retrieves knowledge, and reasons over data.' },
        { id: 'data-pipeline', label: 'Data Pipeline', description: 'Process streaming or batch data with auto-scaling workers and managed storage.' },
      ],
      value: '',
      action: { event: { name: 'select-track', data: { track: 'web-app' } } },
    },
  ]),
};

const ARCHITECTURE: DemoResponse = {
  text: "Great choice! I'll set you up with a modern stack optimized for AKS Automatic. Here's the architecture I'm proposing — you can adjust anything before we start generating.",
  phase: 'design',
  model: 'gpt-5.3-chat',
  typingDelay: 1800,
  a2uiMessages: surface('arch-surface', [
    { id: 'root', component: 'Column', children: ['arch-tabs', 'actions-row'], gap: 'medium' },
    { id: 'arch-tabs', component: 'Tabs', children: ['tab-arch', 'tab-cost', 'tab-included'] },

    // Tab 1: Architecture diagram
    { id: 'tab-arch', component: 'Column', children: ['arch-diagram'], label: 'Architecture' },
    { id: 'arch-diagram', component: 'ArchitectureDiagram',
      title: 'Proposed Architecture',
      description: 'AKS Automatic with a grouped namespace, managed services, and registry-backed icons.',
      diagram: `graph TD
  User(("User")) -->|HTTPS| GW["Gateway API<br/>approuting-istio"]

  subgraph CI["GitHub Actions"]
    GHA["GitHub Actions<br/>build + push"]
  end

  subgraph Azure["Azure Services"]
    ACR["%%icon:azure/acr%%ACR<br/>webappacr<br/>web-app:latest"]
    DB["%%icon:azure/cosmos-db%%Cosmos DB<br/>serverless"]
    KV["%%icon:azure/key-vault%%Key Vault<br/>app secrets"]
  end

  subgraph AKS["%%icon:azure/aks%%AKS Automatic"]
    subgraph NS["%%icon:k8s/ns%%namespace: web-app"]
      Route["HTTPRoute<br/>/ → api"]
      SVC["%%icon:k8s/svc%%Service<br/>api"]
      DEP["%%icon:k8s/deploy%%Deployment<br/>Node.js + Express<br/>(2-10 replicas)"]
      SA["%%icon:k8s/sa%%ServiceAccount<br/>workload identity"]
      HPA["%%icon:k8s/hpa%%HPA<br/>cpu 70%"]
      GW --> Route --> SVC --> DEP
      DEP --> SA
      HPA -.-> DEP
    end
  end

  ACR -.->|image pull| DEP
  DEP --> DB
  DEP -->|Workload Identity| KV
  GHA -.->|build and push| ACR`,
    },

    // Tab 2: Cost Estimate
    { id: 'tab-cost', component: 'Column', children: ['cost-est'], label: 'Cost Estimate' },
    { id: 'cost-est', component: 'CostEstimate', title: 'Estimated Monthly Cost',
      currency: 'USD',
      total: 129,
      resources: [
        { name: 'AKS Automatic', sku: 'Standard', monthlyEstimate: 72 },
        { name: 'Container Registry', sku: 'Basic', monthlyEstimate: 5 },
        { name: 'Cosmos DB', sku: 'Serverless', monthlyEstimate: 25 },
        { name: 'Key Vault', sku: 'Standard', monthlyEstimate: 5 },
        { name: 'Application Gateway', sku: 'Standard v2', monthlyEstimate: 22 },
      ],
    },

    // Tab 3: What's Included
    { id: 'tab-included', component: 'Column', children: ['included-card'], label: "What's Included" },
    { id: 'included-card', component: 'Card', child: 'included-md' },
    { id: 'included-md', component: 'Markdown', content: '### Included by default\n\n- **Auto-scaling** — 2–10 replicas based on CPU utilization\n- **Health checks** — liveness and readiness probes on all containers\n- **Zero-downtime deploys** — rolling updates via GitHub Actions\n- **Workload Identity** — no secrets in code; Key Vault for all credentials\n- **Resource limits** — CPU and memory limits prevent noisy-neighbour issues' },

    // Actions
    { id: 'actions-row', component: 'Row', children: ['approve-btn', 'modify-btn'], gap: 'small' },
    { id: 'approve-btn', component: 'Button', label: "Looks good, let's build it", variant: 'primary',
      action: { event: { name: 'approve-arch' } } },
    { id: 'modify-btn', component: 'Button', label: 'I want to change something', variant: 'outlined',
      action: { event: { name: 'modify-arch' } } },
  ]),
};

const DESIGN_DETAIL: DemoResponse = {
  text: "Here's the detailed architecture breakdown. I've chosen components that optimize for developer experience and production readiness on AKS Automatic.",
  phase: 'design',
  model: 'gpt-5.3-chat',
  typingDelay: 1500,
  a2uiMessages: surface('detail-surface', [
    { id: 'root', component: 'Column', children: ['tabs'] },
    { id: 'tabs', component: 'Tabs', children: ['tab-arch', 'tab-services', 'tab-network'] },
    // Architecture tab
    { id: 'tab-arch', component: 'Column', children: ['arch-h', 'svc-list'], label: 'Architecture' },
    { id: 'arch-h', component: 'Text', text: 'Service Map', variant: 'subtitle1' },
    { id: 'svc-list', component: 'List', children: ['svc-fe', 'svc-api', 'svc-db', 'svc-cache'], variant: 'unordered' },
    { id: 'svc-fe', component: 'Text', text: '**web-frontend** — React SPA served by Nginx, port 80' },
    { id: 'svc-api', component: 'Text', text: '**api-server** — Express.js REST API, port 3000' },
    { id: 'svc-db', component: 'Text', text: '**cosmos-db** — Managed Azure Cosmos DB (NoSQL), auto-scaled' },
    { id: 'svc-cache', component: 'Text', text: '**redis-cache** — Azure Cache for Redis, session storage' },
    // Services tab
    { id: 'tab-services', component: 'Column', children: ['svc-h', 'svc-cards-row'], label: 'Services' },
    { id: 'svc-h', component: 'Text', text: 'Azure Services', variant: 'subtitle1' },
    { id: 'svc-cards-row', component: 'Column', children: ['svc-aks-card', 'svc-acr-card', 'svc-kv-card'] },
    { id: 'svc-aks-card', component: 'Card', child: 'svc-aks-inner' },
    { id: 'svc-aks-inner', component: 'Column', children: ['aks-name', 'aks-desc'] },
    { id: 'aks-name', component: 'Text', text: 'AKS Automatic', variant: 'subtitle2' },
    { id: 'aks-desc', component: 'Text', text: 'Managed Kubernetes with auto-scaling, auto-upgrades, and built-in monitoring. No node management needed.', variant: 'body2' },
    { id: 'svc-acr-card', component: 'Card', child: 'svc-acr-inner' },
    { id: 'svc-acr-inner', component: 'Column', children: ['acr-name', 'acr-desc'] },
    { id: 'acr-name', component: 'Text', text: 'Azure Container Registry', variant: 'subtitle2' },
    { id: 'acr-desc', component: 'Text', text: 'Private Docker registry for your container images. Integrated with AKS for seamless deployments.', variant: 'body2' },
    { id: 'svc-kv-card', component: 'Card', child: 'svc-kv-inner' },
    { id: 'svc-kv-inner', component: 'Column', children: ['kv-name', 'kv-desc'] },
    { id: 'kv-name', component: 'Text', text: 'Azure Key Vault', variant: 'subtitle2' },
    { id: 'kv-desc', component: 'Text', text: 'Secure secrets management. Connection strings and API keys are never stored in code.', variant: 'body2' },
    // Networking tab
    { id: 'tab-network', component: 'Column', children: ['net-h', 'net-desc', 'net-list'], label: 'Networking' },
    { id: 'net-h', component: 'Text', text: 'Network Topology', variant: 'subtitle1' },
    { id: 'net-desc', component: 'Text', text: 'All traffic flows through an Azure Application Gateway with Web Application Firewall (WAF) enabled.', variant: 'body2' },
    { id: 'net-list', component: 'List', children: ['net-1', 'net-2', 'net-3'], variant: 'unordered' },
    { id: 'net-1', component: 'Text', text: 'TLS termination at the gateway — HTTPS everywhere' },
    { id: 'net-2', component: 'Text', text: 'Internal service mesh via AKS Automatic (Istio-based)' },
    { id: 'net-3', component: 'Text', text: 'Private endpoints for database and cache — no public access' },
  ]),
};

const FILE_GENERATION: DemoResponse = {
  text: "I'm generating your project files. Each file is production-ready with best practices baked in.",
  phase: 'generate',
  model: 'gpt-5.3-chat',
  typingDelay: 2000,
  a2uiMessages: surface('files-surface', [
    { id: 'root', component: 'Column', children: ['files-title', 'file-cards'], gap: 'small' },
    { id: 'files-title', component: 'Text', text: 'Generated Files', variant: 'h2' },
    // Dockerfile
    { id: 'file-cards', component: 'Column', children: ['fc1', 'fc2', 'fc3', 'fc4', 'fc5'], gap: 'small' },
    { id: 'fc1', component: 'Card', child: 'fc1-col' },
    { id: 'fc1-col', component: 'Column', children: ['fc1-name', 'fc1-desc'] },
    { id: 'fc1-name', component: 'Text', text: 'Dockerfile', variant: 'subtitle2' },
    { id: 'fc1-desc', component: 'Text', text: 'Multi-stage build: Node.js builder → Nginx runtime. Optimized layers, non-root user, health check endpoint.', variant: 'body2' },
    // K8s manifests
    { id: 'fc2', component: 'Card', child: 'fc2-col' },
    { id: 'fc2-col', component: 'Column', children: ['fc2-name', 'fc2-desc'] },
    { id: 'fc2-name', component: 'Text', text: 'deployment.yaml', variant: 'subtitle2' },
    { id: 'fc2-desc', component: 'Text', text: 'Kubernetes Deployment + Service + Ingress. 2 replicas, resource limits, readiness/liveness probes, auto-scaling to 10 pods.', variant: 'body2' },
    // CI/CD
    { id: 'fc3', component: 'Card', child: 'fc3-col' },
    { id: 'fc3-col', component: 'Column', children: ['fc3-name', 'fc3-desc'] },
    { id: 'fc3-name', component: 'Text', text: '.github/workflows/deploy.yml', variant: 'subtitle2' },
    { id: 'fc3-desc', component: 'Text', text: 'GitHub Actions pipeline: build → test → push to ACR → deploy to AKS. Staging + production environments with approval gates.', variant: 'body2' },
    // Bicep
    { id: 'fc4', component: 'Card', child: 'fc4-col' },
    { id: 'fc4-col', component: 'Column', children: ['fc4-name', 'fc4-desc'] },
    { id: 'fc4-name', component: 'Text', text: 'infra/main.bicep', variant: 'subtitle2' },
    { id: 'fc4-desc', component: 'Text', text: 'Azure Infrastructure as Code: AKS Automatic cluster, ACR, Cosmos DB, Key Vault, and Application Gateway — all in one template.', variant: 'body2' },
    // Config
    { id: 'fc5', component: 'Card', child: 'fc5-col' },
    { id: 'fc5-col', component: 'Column', children: ['fc5-name', 'fc5-desc'] },
    { id: 'fc5-name', component: 'Text', text: '.env.template', variant: 'subtitle2' },
    { id: 'fc5-desc', component: 'Text', text: 'Environment variable template with all required secrets documented. Never commit actual values — those go in Key Vault.', variant: 'body2' },
  ]),
};

const REVIEW_EXPANDED: DemoResponse = {
  text: "I've completed the deployment review. Architecture, cost estimates, and best-practice checks are all below — expand each tab for details. When you're satisfied, hit **Approve** to proceed.",
  phase: 'review',
  model: 'gpt-5.3-chat',
  typingDelay: 1800,
  a2uiMessages: surface('review-surface', [
    { id: 'root', component: 'Column', children: ['rev-title', 'rev-tabs', 'rev-divider', 'rev-actions'], gap: 'medium' },
    { id: 'rev-title', component: 'Text', text: 'Deployment Review', variant: 'h2' },
    { id: 'rev-tabs', component: 'Tabs', children: ['tab-arch', 'tab-cost', 'tab-bp', 'tab-warn'] },

    // Tab 1: Architecture recap
    { id: 'tab-arch', component: 'Column', children: ['arch-diagram'], label: 'Architecture' },
    { id: 'arch-diagram', component: 'ArchitectureDiagram', title: 'System Architecture',
      description: 'Grouped runtime view with AKS Automatic, namespace boundaries, and managed dependencies.',
      diagram: `graph LR
  User-->|HTTPS|GW[Gateway API<br/>approuting-istio]

  subgraph ci["GitHub Actions"]
    GHA["GitHub Actions<br/>build + push"]
  end

  subgraph azure["Azure Services"]
    ACR["%%icon:azure/acr%%ACR<br/>webappacr<br/>web-app:sha"]
    Cosmos["%%icon:azure/cosmos-db%%Cosmos DB<br/>serverless"]
    Redis["%%icon:azure/redis%%Redis Cache<br/>C0"]
    KV["%%icon:azure/key-vault%%Key Vault<br/>runtime secrets"]
  end

  subgraph aks["%%icon:azure/aks%%AKS Automatic"]
    subgraph ns["%%icon:k8s/ns%%namespace: web-app"]
      Route["HTTPRoute<br/>/ → web"]
      SVC["%%icon:k8s/svc%%Service<br/>web"]
      DEP["%%icon:k8s/deploy%%Deployment<br/>web-frontend<br/>3 replicas"]
      SA["%%icon:k8s/sa%%ServiceAccount<br/>workload identity"]
      HPA["%%icon:k8s/hpa%%HPA<br/>requests/sec"]
      GW --> Route --> SVC --> DEP
      DEP --> SA
      HPA -.-> DEP
    end
  end

  ACR -.->|image pull| DEP
  DEP --> Cosmos
  DEP --> Redis
  DEP -->|Workload Identity| KV
  GHA -.->|build and push| ACR`,
    },

    // Tab 2: Cost Estimate
    { id: 'tab-cost', component: 'Column', children: ['cost-est'], label: 'Cost Estimate' },
    { id: 'cost-est', component: 'CostEstimate', title: 'Estimated Monthly Cost',
      currency: 'USD',
      total: 140,
      resources: [
        { name: 'AKS Automatic', sku: 'Standard', monthlyEstimate: 72 },
        { name: 'Container Registry', sku: 'Basic', monthlyEstimate: 5 },
        { name: 'Cosmos DB', sku: 'Serverless', monthlyEstimate: 25 },
        { name: 'Cache for Redis', sku: 'Basic C0', monthlyEstimate: 16 },
        { name: 'Application Gateway', sku: 'Standard v2', monthlyEstimate: 22 },
      ],
    },

    // Tab 3: Best Practices
    { id: 'tab-bp', component: 'Column', children: ['bp-card'], label: 'Best Practices' },
    { id: 'bp-card', component: 'Card', child: 'bp-inner' },
    { id: 'bp-inner', component: 'Column', children: ['bp-accordion'], gap: 'small' },
    { id: 'bp-accordion', component: 'Accordion', sections: [
      { id: 'bp-health', title: 'Health Checks', badge: { text: 'Passing', variant: 'success' },
        content: 'Liveness and readiness probes configured on all containers. HTTP health endpoint at `/healthz` responds in <50ms.' },
      { id: 'bp-scale', title: 'Auto-scaling', badge: { text: 'Configured', variant: 'success' },
        content: 'Horizontal Pod Autoscaler set to 2–10 replicas based on CPU utilization (70% target). AKS node auto-provisioning enabled.' },
      { id: 'bp-limits', title: 'Resource Limits', badge: { text: 'Set', variant: 'success' },
        content: 'CPU: 100m request / 500m limit. Memory: 128Mi request / 256Mi limit. Prevents noisy-neighbour issues in shared cluster.' },
      { id: 'bp-secure', title: 'Secure Defaults', badge: { text: 'Enforced', variant: 'success' },
        content: 'Non-root container user. Secrets in Key Vault (not env vars). TLS termination at Application Gateway. Network policies restrict pod-to-pod traffic.' },
    ] },

    // Tab 4: Warnings
    { id: 'tab-warn', component: 'Column', children: ['warn-card'], label: 'Warnings' },
    { id: 'warn-card', component: 'Card', child: 'warn-inner' },
    { id: 'warn-inner', component: 'Column', children: ['warn-list'], gap: 'small' },
    { id: 'warn-list', component: 'List', children: ['warn-1', 'warn-2'], variant: 'unordered' },
    { id: 'warn-1', component: 'Row', children: ['w1-badge', 'w1-text'], gap: 'small' },
    { id: 'w1-badge', component: 'Badge', text: 'Info', variant: 'warning' },
    { id: 'w1-text', component: 'Text', text: 'Consider adding a CDN for static assets to reduce latency for global users.' },
    { id: 'warn-2', component: 'Row', children: ['w2-badge', 'w2-text'], gap: 'small' },
    { id: 'w2-badge', component: 'Badge', text: 'Info', variant: 'warning' },
    { id: 'w2-text', component: 'Text', text: 'Redis password rotation is not configured — consider enabling Azure Key Vault integration.' },

    // Actions
    { id: 'rev-divider', component: 'Divider' },
    { id: 'rev-actions', component: 'Row', children: ['approve-btn', 'modify-btn'], gap: 'small' },
    { id: 'approve-btn', component: 'Button', label: 'Approve and continue', variant: 'primary',
      action: { event: { name: 'approve-review' } } },
    { id: 'modify-btn', component: 'Button', label: 'Change something', variant: 'outlined',
      action: { event: { name: 'modify-review' } } },
  ]),
};

const SESSION_COMPLETE: DemoResponse = {
  text: "Your deployment package is complete and ready to use. All files have been generated and validated against production best practices.",
  phase: 'review',
  model: 'gpt-5.3-chat',
  typingDelay: 1400,
  a2uiMessages: surface('complete-surface', [
    { id: 'root', component: 'Column', children: ['complete-title', 'complete-card', 'summary-card'], gap: 'medium' },
    { id: 'complete-title', component: 'Text', text: 'Session Complete', variant: 'subtitle1' },

    // Completion status card
    { id: 'complete-card', component: 'Card', child: 'complete-inner' },
    { id: 'complete-inner', component: 'Column', children: ['complete-header', 'complete-divider', 'complete-steps'], gap: 'small' },
    { id: 'complete-header', component: 'Row', children: ['done-badge', 'done-title'], gap: 'small' },
    { id: 'done-badge', component: 'Badge', text: 'Complete', variant: 'success' },
    { id: 'done-title', component: 'Text', text: 'Deployment package ready', variant: 'subtitle1' },
    { id: 'complete-divider', component: 'Divider' },
    { id: 'complete-steps', component: 'ProgressSteps', steps: [
      { id: 'discover', label: 'Discover', status: 'complete' },
      { id: 'design', label: 'Design', status: 'complete' },
      { id: 'generate', label: 'Generate', status: 'complete' },
      { id: 'review', label: 'Review', status: 'complete' },
    ] },

    // What was generated
    { id: 'summary-card', component: 'Card', child: 'summary-inner' },
    { id: 'summary-inner', component: 'Column', children: ['summary-title', 'summary-divider', 'summary-list', 'summary-divider2', 'summary-actions'], gap: 'small' },
    { id: 'summary-title', component: 'Text', text: 'What was generated', variant: 'subtitle1' },
    { id: 'summary-divider', component: 'Divider' },
    { id: 'summary-list', component: 'List', children: ['sf-1', 'sf-2', 'sf-3', 'sf-4', 'sf-5'], variant: 'unordered' },
    { id: 'sf-1', component: 'Text', text: '**Dockerfile** — multi-stage build, non-root user, health check' },
    { id: 'sf-2', component: 'Text', text: '**deployment.yaml** — AKS manifests, HPA, PDB, resource limits' },
    { id: 'sf-3', component: 'Text', text: '**.github/workflows/deploy.yml** — build, test, and deploy pipeline' },
    { id: 'sf-4', component: 'Text', text: '**infra/main.bicep** — AKS Automatic + ACR + backing services' },
    { id: 'sf-5', component: 'Text', text: '**.env.template** — secrets template (use Key Vault for real values)' },
    { id: 'summary-divider2', component: 'Divider' },
    { id: 'summary-actions', component: 'Row', children: ['download-btn', 'new-project-btn'], gap: 'small' },
    { id: 'download-btn', component: 'Button', label: 'Download files', variant: 'primary',
      action: { event: { name: 'client:download-project' } } },
    { id: 'new-project-btn', component: 'Button', label: 'Start a new project', variant: 'outlined',
      action: { event: { name: 'start-new-project' } } },
  ]),
};

const CONFIGURE_FORM: DemoResponse = {
  text: "Let's configure your app. Fill in the details below — I'll handle the rest.",
  phase: 'generate',
  model: 'gpt-5.3-chat',
  typingDelay: 1500,
  a2uiMessages: surface('config-surface', [
    { id: 'root', component: 'Column', children: ['progress', 'form1', 'form2'] },
    { id: 'progress', component: 'ProgressSteps', steps: [
      { id: 'info', label: 'App Info', status: 'active' },
      { id: 'infra', label: 'Infrastructure', status: 'pending' },
      { id: 'cicd', label: 'CI/CD', status: 'pending' },
      { id: 'done', label: 'Review', status: 'pending' },
    ] },
    { id: 'form1', component: 'FormGroup', title: 'Application Details', step: 1, child: 'form1-inner' },
    { id: 'form1-inner', component: 'Column', children: ['app-name', 'app-region'] },
    { id: 'app-name', component: 'TextField', label: 'App Name', value: 'my-web-app', placeholder: 'Enter your app name' },
    { id: 'app-region', component: 'ChoicePicker', label: 'Region', options: [
      { id: 'eastus', label: 'East US' },
      { id: 'westus3', label: 'West US 3' },
      { id: 'westeurope', label: 'West Europe' },
    ], value: 'eastus' },
    { id: 'form2', component: 'FormGroup', title: 'Runtime', step: 2, child: 'form2-inner' },
    { id: 'form2-inner', component: 'Column', children: ['runtime-pick', 'continue-btn'] },
    { id: 'runtime-pick', component: 'RadioGroup', options: [
      { id: 'node', label: 'Node.js 20', description: 'JavaScript/TypeScript runtime', recommended: true },
      { id: 'python', label: 'Python 3.12', description: 'Great for APIs and data services' },
      { id: 'dotnet', label: '.NET 8', description: 'Enterprise-grade C# runtime' },
    ], value: '', action: { event: { name: 'select-runtime' } } },
    { id: 'continue-btn', component: 'Button', label: 'Continue →', variant: 'primary',
      action: { event: { name: 'continue-config' } } },
  ]),
};

const CODE_PREVIEW: DemoResponse = {
  text: "Here are the key files I generated for your app. Everything is production-ready with best practices baked in.",
  phase: 'generate',
  model: 'gpt-5.3-chat',
  typingDelay: 1800,
  a2uiMessages: surface('code-surface', [
    { id: 'root', component: 'Column', children: ['code-title', 'dockerfile-block', 'deployment-block'] },
    { id: 'code-title', component: 'Text', text: 'Generated Files', variant: 'h2' },
    { id: 'dockerfile-block', component: 'CodeBlock',
      filename: 'Dockerfile',
      language: 'dockerfile',
      code: `FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
HEALTHCHECK CMD wget -q --spider http://localhost/health || exit 1
USER nginx`,
    },
    { id: 'deployment-block', component: 'CodeBlock',
      filename: 'k8s/deployment.yaml',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-web-app
  labels:
    app: my-web-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-web-app
  template:
    spec:
      containers:
        - name: app
          image: myacr.azurecr.io/my-web-app:latest
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi`,
    },
  ]),
};

const SCENARIOS: { match: RegExp | null; response: DemoResponse }[] = [
  { match: /review|summary|ready|looks good|complete|done/i, response: REVIEW_EXPANDED },
  { match: /code|preview|dockerfile|yaml|file/i, response: CODE_PREVIEW },
  { match: /config|form|setup|step/i, response: CONFIGURE_FORM },
  { match: /generat|scaffold|create/i, response: FILE_GENERATION },
  { match: /detail|service|network|tab/i, response: DESIGN_DETAIL },
  { match: /architect|design|stack|build|movie|app|api|recipe|bot|match|dash|library|coach|workout|parking|study/i, response: ARCHITECTURE },
  { match: null, response: WELCOME },
];

const SESSION_TURN_KEY = 'kickstart-demo-turnCount';

function getTurnCount(): number {
  try {
    return parseInt(sessionStorage.getItem(SESSION_TURN_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setTurnCount(n: number): void {
  try {
    sessionStorage.setItem(SESSION_TURN_KEY, String(n));
  } catch { /* ignore — sessionStorage may be unavailable */ }
}

export function getDemoResponse(userMessage: string): DemoResponse {
  const turnCount = getTurnCount() + 1;
  setTurnCount(turnCount);

  // First turn always gets welcome
  if (turnCount === 1) {
    return WELCOME;
  }

  // Cycle through scenarios for subsequent turns
  const scenarioFlow = [ARCHITECTURE, DESIGN_DETAIL, CONFIGURE_FORM, CODE_PREVIEW, FILE_GENERATION, REVIEW_EXPANDED, SESSION_COMPLETE];
  
  // Check keyword matches first
  for (const scenario of SCENARIOS) {
    if (scenario.match && scenario.match.test(userMessage)) {
      return scenario.response;
    }
  }

  // Default: cycle through the flow
  return scenarioFlow[(turnCount - 2) % scenarioFlow.length];
}

export function resetDemoState(): void {
  setTurnCount(0);
}

// --- Demo file content for the Spark file-generation experience ---

const DEMO_FILES: { path: string; content: string; language: string }[] = [
  {
    path: 'Dockerfile',
    language: 'dockerfile',
    content: `FROM node:20-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# --- Production image ---
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
RUN addgroup --system app && adduser --system --ingroup app app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

EXPOSE 3000
USER app

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \\
  CMD node -e "fetch('http://localhost:3000/healthz').then(r=>{if(!r.ok)throw r})"

CMD ["node", "dist/index.js"]`,
  },
  {
    path: 'deployment.yaml',
    language: 'yaml',
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
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
          image: myacr.azurecr.io/my-app:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          env:
            - name: NODE_ENV
              value: production
            - name: COSMOS_CONNECTION
              valueFrom:
                secretKeyRef:
                  name: my-app-secrets
                  key: cosmos-connection`,
  },
  {
    path: 'service.yaml',
    language: 'yaml',
    content: `apiVersion: v1
kind: Service
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
  selector:
    app: my-app
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  annotations:
    kubernetes.io/ingress.class: webapprouting.kubernetes.azure.com
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - my-app.aksauto.io
      secretName: my-app-tls
  rules:
    - host: my-app.aksauto.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80`,
  },
  {
    path: '.github/workflows/deploy.yml',
    language: 'yaml',
    content: `name: Deploy to AKS

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

env:
  ACR_NAME: myacr
  AKS_CLUSTER: my-aks-cluster
  RESOURCE_GROUP: my-app-rg
  IMAGE_NAME: my-app

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Build & push to ACR
        run: |
          az acr build \\
            --registry \${{ env.ACR_NAME }} \\
            --image \${{ env.IMAGE_NAME }}:\${{ github.sha }} \\
            --image \${{ env.IMAGE_NAME }}:latest .

      - name: Set AKS context
        uses: azure/aks-set-context@v4
        with:
          resource-group: \${{ env.RESOURCE_GROUP }}
          cluster-name: \${{ env.AKS_CLUSTER }}

      - name: Deploy to AKS
        run: |
          kubectl set image deployment/my-app \\
            my-app=\${{ env.ACR_NAME }}.azurecr.io/\${{ env.IMAGE_NAME }}:\${{ github.sha }}
          kubectl rollout status deployment/my-app --timeout=120s`,
  },
  {
    path: 'src/index.ts',
    language: 'typescript',
    content: `import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'my-app',
    version: '1.0.0',
    message: 'Welcome to the API — deployed on AKS Automatic',
  });
});

// Example CRUD endpoint
app.get('/api/items', (_req, res) => {
  res.json([
    { id: '1', name: 'First item', createdAt: new Date().toISOString() },
    { id: '2', name: 'Second item', createdAt: new Date().toISOString() },
  ]);
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
  },
  {
    path: 'package.json',
    language: 'json',
    content: `{
  "name": "my-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0"
  }
}`,
  },
];

/**
 * Populate the VirtualFileSystem with demo files, simulating a staggered
 * generation effect. Each file appears as "generating" then flips to "complete".
 */
export function populateDemoFiles(fs: VirtualFileSystem): void {
  let i = 0;
  const interval = setInterval(() => {
    if (i >= DEMO_FILES.length) {
      clearInterval(interval);
      return;
    }
    const f = DEMO_FILES[i];
    // Brief generating flash, then complete
    fs.writeGenerating(f.path, f.content, f.language);
    setTimeout(() => {
      fs.write(f.path, f.content, f.language);
    }, 400);
    i++;
  }, 350);
}

/** Check whether the current demo turn is the file-generation phase. */
export function isDemoFileGenerationPhase(): boolean {
  return getTurnCount() >= 4; // FILE_GENERATION is the 3rd scenario (turn 4+)
}
