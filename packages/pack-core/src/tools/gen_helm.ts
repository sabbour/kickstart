export interface GenHelmInput {
  plan: {
    name: string;
    description?: string;
    version?: string;
  };
  proposed_services: {
    vmSize?: string;
    model?: string;
    cpu?: string;
    memory?: string;
    cpuLimit?: string;
    memoryLimit?: string;
    replicaCount?: number;
  };
  track: 'kaito' | 'foundry';
}

export interface HelmFile {
  content: string;
  outputPath: string;
}

export interface GenHelmOutput {
  files: HelmFile[];
}

const NAME_RE = /^[a-zA-Z0-9-]+$/;

function assertSafeName(name: string): void {
  if (!NAME_RE.test(name)) {
    throw new Error(`gen_helm: plan.name must match /^[a-zA-Z0-9-]+$/, got: ${JSON.stringify(name)}`);
  }
}

function chartYaml(input: GenHelmInput): HelmFile {
  const { name, description = '', version = '0.1.0' } = input.plan;
  const content = [
    'apiVersion: v2',
    `name: ${name}`,
    `description: ${description}`,
    `version: ${version}`,
  ].join('\n') + '\n';
  return { content, outputPath: 'helm/Chart.yaml' };
}

function valuesYaml(input: GenHelmInput): HelmFile {
  const {
    cpu = '500m',
    memory = '512Mi',
    cpuLimit = '1000m',
    memoryLimit = '1Gi',
    replicaCount = 1,
  } = input.proposed_services;
  const { name } = input.plan;
  const content = [
    'image:',
    `  repository: ${name}`,
    '  tag: "latest"',
    'replicaCount: ' + replicaCount,
    'resources:',
    '  requests:',
    `    cpu: "${cpu}"`,
    `    memory: "${memory}"`,
    '  limits:',
    `    cpu: "${cpuLimit}"`,
    `    memory: "${memoryLimit}"`,
  ].join('\n') + '\n';
  return { content, outputPath: 'helm/values.yaml' };
}

function deploymentYaml(input: GenHelmInput): HelmFile {
  const { name } = input.plan;
  const isKaito = input.track === 'kaito';

  const gpuSection = isKaito
    ? [
        '      nodeSelector:',
        '        agentpool: kaito-gpu-pool',
        '      tolerations:',
        '        - key: "nvidia.com/gpu"',
        '          operator: "Exists"',
        '          effect: "NoSchedule"',
      ].join('\n')
    : null;

  const lines = [
    'apiVersion: apps/v1',
    'kind: Deployment',
    'metadata:',
    `  name: {{ .Release.Name }}-${name}`,
    'spec:',
    '  replicas: {{ .Values.replicaCount }}',
    '  selector:',
    '    matchLabels:',
    `      app: ${name}`,
    '  template:',
    '    metadata:',
    '      labels:',
    `        app: ${name}`,
    '    spec:',
  ];

  if (gpuSection) {
    lines.push(gpuSection);
  }

  lines.push(
    '      containers:',
    `        - name: ${name}`,
    '          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"',
    '          resources: {{ .Values.resources | toYaml | nindent 12 }}',
    '          securityContext:',
    '            runAsNonRoot: true',
    '            runAsUser: 1000',
    '            allowPrivilegeEscalation: false',
    '            readOnlyRootFilesystem: true',
  );

  return { content: lines.join('\n') + '\n', outputPath: 'helm/templates/deployment.yaml' };
}

function serviceYaml(input: GenHelmInput): HelmFile {
  const { name } = input.plan;
  const content = [
    'apiVersion: v1',
    'kind: Service',
    'metadata:',
    `  name: {{ .Release.Name }}-${name}`,
    'spec:',
    '  type: ClusterIP',
    '  selector:',
    `    app: ${name}`,
    '  ports:',
    '    - port: 80',
    '      targetPort: 8080',
  ].join('\n') + '\n';
  return { content, outputPath: 'helm/templates/service.yaml' };
}

function serviceAccountYaml(input: GenHelmInput): HelmFile {
  const { name } = input.plan;
  const content = [
    'apiVersion: v1',
    'kind: ServiceAccount',
    'metadata:',
    `  name: {{ .Release.Name }}-${name}`,
    '  annotations:',
    '    rbac.kickstart.io/policy: "read-only"',
    '    rbac.kickstart.io/denied-verbs: "delete,create-pod"',
  ].join('\n') + '\n';
  return { content, outputPath: 'helm/templates/serviceaccount.yaml' };
}

export function genHelm(input: GenHelmInput): GenHelmOutput {
  assertSafeName(input.plan.name);
  return {
    files: [
      chartYaml(input),
      valuesYaml(input),
      deploymentYaml(input),
      serviceYaml(input),
      serviceAccountYaml(input),
    ],
  };
}
