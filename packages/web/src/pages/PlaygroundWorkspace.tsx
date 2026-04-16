/**
 * PlaygroundWorkspace — Self-contained FileManager + FileViewer sandbox.
 *
 * Renders the full file manager experience with static sample files
 * (no IndexedDB, no VirtualFSContext). Useful for testing the sidebar,
 * viewer, Mermaid diagrams, and Codespaces/vscode.dev buttons without
 * going through the LLM pipeline.
 */

import React, { useState, useMemo } from 'react';
import {
  Button,
  Input,
  Label,
  Text,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { VirtualFile } from '../services/virtual-fs';
import type { VirtualFS } from '../services/virtual-fs';
import { FileManagerSidebar } from '../components/FileManager/FileManagerSidebar';
import { FileViewer } from '../components/FileManager/FileViewer';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginRight: tokens.spacingHorizontalS,
  },
  repoField: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginLeft: 'auto',
  },
  repoInput: {
    minWidth: '280px',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  viewerWrapper: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
});

/* ------------------------------------------------------------------ */
/*  Sample files                                                       */
/* ------------------------------------------------------------------ */

const NOW = Date.now();

const SAMPLE_FILES: VirtualFile[] = [
  {
    path: 'src/server.ts',
    language: 'typescript',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { logger } from './middleware/logger';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use(logger);
app.use('/api', router);

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(\`Server listening on port \${PORT}\`);
});

export default app;
`,
  },
  {
    path: 'k8s/deployment.yaml',
    language: 'yaml',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: kickstart-app
  namespace: default
  labels:
    app: kickstart-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kickstart-app
  template:
    metadata:
      labels:
        app: kickstart-app
    spec:
      containers:
        - name: app
          image: kickstartacr.azurecr.io/kickstart-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: PORT
              value: "3000"
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          readinessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /healthz
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
`,
  },
  {
    path: 'k8s/service.yaml',
    language: 'yaml',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `apiVersion: v1
kind: Service
metadata:
  name: kickstart-app-svc
  namespace: default
spec:
  selector:
    app: kickstart-app
  type: LoadBalancer
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
`,
  },
  {
    path: '.github/workflows/ci.yml',
    language: 'yaml',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Log in to Azure Container Registry
        uses: azure/docker-login@v1
        with:
          login-server: kickstartacr.azurecr.io
          username: \${{ secrets.ACR_USERNAME }}
          password: \${{ secrets.ACR_PASSWORD }}

      - name: Build and push Docker image
        run: |
          docker build -t kickstartacr.azurecr.io/kickstart-app:\${{ github.sha }} .
          docker push kickstartacr.azurecr.io/kickstart-app:\${{ github.sha }}
`,
  },
  {
    path: 'Dockerfile',
    language: 'dockerfile',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
`,
  },
  {
    path: 'architecture.mmd',
    language: 'mermaid',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `architecture-beta
group azure(cloud)[Azure]
group aks(server)[AKS Cluster] in azure
group network(internet)[Public Internet]

service client(internet)[Browser / CLI] in network
service ingress(server)[Ingress Controller] in aks
service app(server)[Node.js App x3] in aks
service acr(disk)[Container Registry] in azure
service db(database)[PostgreSQL Flexible] in azure
service kv(lock)[Key Vault] in azure
service monitor(cloud)[Azure Monitor] in azure

client:R --> L:ingress
ingress:R --> L:app
app:B --> T:db
app:R --> L:kv
acr:B --> T:app
app:T --> B:monitor
`,
  },
  {
    path: 'infra/main.bicep',
    language: 'bicep',
    status: 'complete',
    createdAt: NOW,
    updatedAt: NOW,
    content: `@description('Azure region for all resources')
param location string = resourceGroup().location

@description('AKS cluster name')
param clusterName string = 'kickstart-aks'

@description('ACR name (globally unique)')
param acrName string = 'kickstartacr'

@description('Node count for default node pool')
param nodeCount int = 3

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: { adminUserEnabled: false }
}

resource aks 'Microsoft.ContainerService/managedClusters@2023-10-01' = {
  name: clusterName
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    dnsPrefix: clusterName
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: nodeCount
        vmSize: 'Standard_D4s_v5'
        mode: 'System'
        osType: 'Linux'
      }
    ]
  }
}

output aksName string = aks.name
output acrLoginServer string = acr.properties.loginServer
`,
  },
];

/* ------------------------------------------------------------------ */
/*  Stub VirtualFS (satisfies the FileViewer interface)               */
/* ------------------------------------------------------------------ */

// FileViewer first checks streamingFiles; it only calls vfs.getFile as fallback.
// Since all our files are in streamingFiles, this stub never gets called in practice.
const stubVfs = {
  getFile: async (_path: string) => { throw new Error('not found in stub vfs'); },
  readAll: async () => [],
  writeFile: async () => {},
  readFile: async () => '',
  deleteFile: async () => {},
  exportZip: async () => new Blob(),
  saveWorkspaceSnapshot: async () => {},
  loadWorkspaceSnapshot: async () => [],
  subscribe: () => () => {},
  notify: () => {},
} as unknown as VirtualFS;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PlaygroundWorkspace() {
  const styles = useStyles();

  const [selectedPath, setSelectedPath] = useState<string | undefined>(SAMPLE_FILES[0]?.path);
  const [repoInput, setRepoInput] = useState('');
  const [appliedRepo, setAppliedRepo] = useState('');

  const streamingFiles = useMemo(() => SAMPLE_FILES, []);

  return (
    <div className={styles.root}>
      {/* Header bar */}
      <div className={styles.header}>
        <Text className={styles.headerTitle} size={400}>Workspace</Text>
        <div className={styles.repoField}>
          <Label htmlFor="ws-repo-input" size="small">GitHub repository (optional)</Label>
          <Input
            id="ws-repo-input"
            className={styles.repoInput}
            size="small"
            value={repoInput}
            onChange={(_e, d) => setRepoInput(d.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setAppliedRepo(repoInput); }}
            placeholder="https://github.com/owner/repo"
          />
          <Button
            size="small"
            appearance="primary"
            onClick={() => setAppliedRepo(repoInput)}
          >
            Apply
          </Button>
        </div>
      </div>

      {/* Sidebar + Viewer */}
      <div className={styles.body}>
        <FileManagerSidebar
          streamingFiles={streamingFiles}
          persistedFiles={[]}
          selectedPath={selectedPath}
          onSelectFile={setSelectedPath}
          onDismiss={() => {}}
          githubRepoUrl={appliedRepo || undefined}
        />
        <div className={styles.viewerWrapper}>
          <FileViewer
            filePath={selectedPath}
            streamingFiles={streamingFiles}
            vfs={stubVfs}
            onDismiss={() => setSelectedPath(undefined)}
          />
        </div>
      </div>
    </div>
  );
}
