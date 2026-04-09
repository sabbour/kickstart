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
        { id: 'web-app', label: '🌐 Web App or API', description: 'Ship a web frontend, REST API, or microservice with CI/CD and a production URL.', recommended: true },
        { id: 'agentic', label: '🤖 AI Agent', description: 'Deploy an AI agent that calls tools, retrieves knowledge, and reasons over data.' },
        { id: 'data-pipeline', label: '📊 Data Pipeline', description: 'Process streaming or batch data with auto-scaling workers and managed storage.' },
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
    { id: 'root', component: 'Column', children: ['arch-card'] },
    { id: 'arch-card', component: 'Card', child: 'arch-inner' },
    { id: 'arch-inner', component: 'Column', children: ['arch-title', 'divider1', 'row1', 'row2', 'row3', 'row4', 'divider2', 'actions-row'], gap: 'small' },
    { id: 'arch-title', component: 'Text', text: 'Your Architecture', variant: 'h2' },
    { id: 'divider1', component: 'Divider' },
    // Row 1: Frontend
    { id: 'row1', component: 'Row', children: ['r1-label', 'r1-value'], gap: 'medium' },
    { id: 'r1-label', component: 'Text', text: '**Frontend**', variant: 'subtitle2' },
    { id: 'r1-value', component: 'Text', text: 'React 19 + TypeScript + Vite', variant: 'body2' },
    // Row 2: API
    { id: 'row2', component: 'Row', children: ['r2-label', 'r2-value'], gap: 'medium' },
    { id: 'r2-label', component: 'Text', text: '**Backend**', variant: 'subtitle2' },
    { id: 'r2-value', component: 'Text', text: 'Node.js + Express + TypeScript', variant: 'body2' },
    // Row 3: Database
    { id: 'row3', component: 'Row', children: ['r3-label', 'r3-value'], gap: 'medium' },
    { id: 'r3-label', component: 'Text', text: '**Database**', variant: 'subtitle2' },
    { id: 'r3-value', component: 'Text', text: 'Azure Cosmos DB (NoSQL)', variant: 'body2' },
    // Row 4: Hosting
    { id: 'row4', component: 'Row', children: ['r4-label', 'r4-value'], gap: 'medium' },
    { id: 'r4-label', component: 'Text', text: '**Hosting**', variant: 'subtitle2' },
    { id: 'r4-value', component: 'Text', text: 'AKS Automatic (zero-config Kubernetes)', variant: 'body2' },
    { id: 'divider2', component: 'Divider' },
    { id: 'actions-row', component: 'Row', children: ['approve-btn', 'modify-btn'], gap: 'small' },
    { id: 'approve-btn', component: 'Button', child: 'approve-text', variant: 'primary',
      action: { event: { name: 'approve-arch' } } },
    { id: 'approve-text', component: 'Text', text: "Looks good, let's build it" },
    { id: 'modify-btn', component: 'Button', child: 'modify-text', variant: 'outlined',
      action: { event: { name: 'modify-arch' } } },
    { id: 'modify-text', component: 'Text', text: 'I want to change something' },
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
    { id: 'fc1-name', component: 'Text', text: '📦 Dockerfile', variant: 'subtitle2' },
    { id: 'fc1-desc', component: 'Text', text: 'Multi-stage build: Node.js builder → Nginx runtime. Optimized layers, non-root user, health check endpoint.', variant: 'body2' },
    // K8s manifests
    { id: 'fc2', component: 'Card', child: 'fc2-col' },
    { id: 'fc2-col', component: 'Column', children: ['fc2-name', 'fc2-desc'] },
    { id: 'fc2-name', component: 'Text', text: '⎈ deployment.yaml', variant: 'subtitle2' },
    { id: 'fc2-desc', component: 'Text', text: 'Kubernetes Deployment + Service + Ingress. 2 replicas, resource limits, readiness/liveness probes, auto-scaling to 10 pods.', variant: 'body2' },
    // CI/CD
    { id: 'fc3', component: 'Card', child: 'fc3-col' },
    { id: 'fc3-col', component: 'Column', children: ['fc3-name', 'fc3-desc'] },
    { id: 'fc3-name', component: 'Text', text: '🔄 .github/workflows/deploy.yml', variant: 'subtitle2' },
    { id: 'fc3-desc', component: 'Text', text: 'GitHub Actions pipeline: build → test → push to ACR → deploy to AKS. Staging + production environments with approval gates.', variant: 'body2' },
    // Bicep
    { id: 'fc4', component: 'Card', child: 'fc4-col' },
    { id: 'fc4-col', component: 'Column', children: ['fc4-name', 'fc4-desc'] },
    { id: 'fc4-name', component: 'Text', text: '🏗️ infra/main.bicep', variant: 'subtitle2' },
    { id: 'fc4-desc', component: 'Text', text: 'Azure Infrastructure as Code: AKS Automatic cluster, ACR, Cosmos DB, Key Vault, and Application Gateway — all in one template.', variant: 'body2' },
    // Config
    { id: 'fc5', component: 'Card', child: 'fc5-col' },
    { id: 'fc5-col', component: 'Column', children: ['fc5-name', 'fc5-desc'] },
    { id: 'fc5-name', component: 'Text', text: '⚙️ .env.template', variant: 'subtitle2' },
    { id: 'fc5-desc', component: 'Text', text: 'Environment variable template with all required secrets documented. Never commit actual values — those go in Key Vault.', variant: 'body2' },
  ]),
};

const REVIEW: DemoResponse = {
  text: "Everything looks great! Here's your deployment summary. Review the details below and hit **Deploy** when you're ready.",
  phase: 'review',
  model: 'gpt-5.3-chat',
  typingDelay: 1400,
  a2uiMessages: surface('review-surface', [
    { id: 'root', component: 'Column', children: ['review-card'] },
    { id: 'review-card', component: 'Card', child: 'review-inner' },
    { id: 'review-inner', component: 'Column', children: ['rev-title', 'divider', 'picker', 'tf', 'deploy-row'], gap: 'medium' },
    { id: 'rev-title', component: 'Text', text: 'Deployment Configuration', variant: 'h2' },
    { id: 'divider', component: 'Divider' },
    { id: 'picker', component: 'ChoicePicker', label: 'Region', options: [
      { id: 'eastus', label: 'East US' },
      { id: 'westus3', label: 'West US 3' },
      { id: 'westeurope', label: 'West Europe' },
      { id: 'southeastasia', label: 'Southeast Asia' },
    ], value: 'eastus' },
    { id: 'tf', component: 'TextField', label: 'App Name', value: 'my-awesome-app', placeholder: 'Enter your app name' },
    { id: 'deploy-row', component: 'Row', children: ['deploy-btn', 'cancel-btn'], gap: 'small' },
    { id: 'deploy-btn', component: 'Button', child: 'deploy-text', variant: 'primary',
      action: { event: { name: 'deploy' } } },
    { id: 'deploy-text', component: 'Text', text: '🚀 Deploy to AKS' },
    { id: 'cancel-btn', component: 'Button', child: 'cancel-text', variant: 'outlined',
      action: { event: { name: 'cancel-deploy' } } },
    { id: 'cancel-text', component: 'Text', text: 'Go back' },
  ]),
};

const DEPLOY_SUCCESS: DemoResponse = {
  text: "🎉 **Deployment complete!** Your app is live. Here are your endpoints and next steps.",
  phase: 'deploy',
  model: 'gpt-5.3-chat',
  typingDelay: 2500,
  a2uiMessages: surface('deploy-surface', [
    { id: 'root', component: 'Column', children: ['progress', 'success-card', 'next-card'] },
    { id: 'progress', component: 'ProgressSteps', steps: [
      { id: 'build', label: 'Build', status: 'complete' },
      { id: 'push', label: 'Push to ACR', status: 'complete' },
      { id: 'deploy', label: 'Deploy to AKS', status: 'complete' },
      { id: 'verify', label: 'Health Check', status: 'complete' },
    ] },
    { id: 'success-card', component: 'Card', child: 'success-inner' },
    { id: 'success-inner', component: 'Column', children: ['check-title', 'divider1', 'endpoints'], gap: 'small' },
    { id: 'check-title', component: 'Text', text: '✅ Deployment Successful', variant: 'h2' },
    { id: 'divider1', component: 'Divider' },
    { id: 'endpoints', component: 'List', children: ['ep1', 'ep2', 'ep3'], variant: 'unordered' },
    { id: 'ep1', component: 'Text', text: '**App URL:** https://my-awesome-app.aksauto.io' },
    { id: 'ep2', component: 'Text', text: '**API Endpoint:** https://api.my-awesome-app.aksauto.io' },
    { id: 'ep3', component: 'Text', text: '**GitHub Repo:** github.com/you/my-awesome-app' },
    { id: 'next-card', component: 'Card', child: 'next-inner' },
    { id: 'next-inner', component: 'Column', children: ['next-title', 'next-list', 'codespace-btn'], gap: 'small' },
    { id: 'next-title', component: 'Text', text: 'Next Steps', variant: 'subtitle1' },
    { id: 'next-list', component: 'List', children: ['ns1', 'ns2', 'ns3'], variant: 'ordered' },
    { id: 'ns1', component: 'Text', text: 'Open in GitHub Codespaces to start coding' },
    { id: 'ns2', component: 'Text', text: 'Push a commit to trigger your CI/CD pipeline' },
    { id: 'ns3', component: 'Text', text: 'Add a custom domain in the Azure Portal' },
    { id: 'codespace-btn', component: 'Button', child: 'cs-text', variant: 'primary',
      action: { event: { name: 'open-codespace' } } },
    { id: 'cs-text', component: 'Text', text: '💻 Open in Codespaces' },
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
      { id: 'done', label: 'Deploy', status: 'pending' },
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
    { id: 'continue-btn', component: 'Button', child: 'continue-text', variant: 'primary',
      action: { event: { name: 'continue-config' } } },
    { id: 'continue-text', component: 'Text', text: 'Continue →' },
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
  { match: /deploy|ship|launch|go live/i, response: DEPLOY_SUCCESS },
  { match: /review|summary|ready|looks good/i, response: REVIEW },
  { match: /code|preview|dockerfile|yaml|file/i, response: CODE_PREVIEW },
  { match: /config|form|setup|step/i, response: CONFIGURE_FORM },
  { match: /generat|scaffold|create/i, response: FILE_GENERATION },
  { match: /detail|service|network|tab/i, response: DESIGN_DETAIL },
  { match: /architect|design|stack|build|movie|app|api|recipe|bot|match|dash|library|coach|workout|parking|study/i, response: ARCHITECTURE },
  { match: null, response: WELCOME },
];

let turnCount = 0;

export function getDemoResponse(userMessage: string): DemoResponse {
  turnCount++;

  // First turn always gets welcome
  if (turnCount === 1) {
    return WELCOME;
  }

  // Cycle through scenarios for subsequent turns
  const scenarioFlow = [ARCHITECTURE, DESIGN_DETAIL, CONFIGURE_FORM, CODE_PREVIEW, FILE_GENERATION, REVIEW, DEPLOY_SUCCESS];
  
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
  turnCount = 0;
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
  return turnCount >= 4; // FILE_GENERATION is the 3rd scenario (turn 4+)
}
