/**
 * Safeguard rules ported from Microsoft AKS-Copilot PRs #1837 and #1976.
 *
 * Each rule is a static check against parsed Kubernetes manifest documents.
 * Rules are detection-only — fix logic lives in ./fixes.ts.
 *
 * Security: operates on already-parsed YAML objects. No eval, no shell, no
 * helm template, no kustomize build. Pure object inspection.
 */

/** Severity levels aligned with the DP. */
export type Severity = 'high' | 'medium' | 'low';

/** A single safeguard violation. */
export interface SafeguardViolation {
  /** Stable rule ID (kebab-case). Maps 1:1 to MS PR source. */
  id: string;
  /** Human-readable title. */
  title: string;
  severity: Severity;
  /** Explanation of why this is a problem. */
  message: string;
  /** MS PR attribution link. */
  msprLink: string;
  /** Whether an automatic fix is available. */
  autoFixable: boolean;
  /** Path within the manifest where the violation was found. */
  path: string;
}

/** A safeguard rule definition. */
export interface SafeguardRule {
  id: string;
  title: string;
  severity: Severity;
  message: string;
  msprLink: string;
  autoFixable: boolean;
  /** Returns violation paths found in a single K8s resource document. */
  check: (doc: Record<string, unknown>) => string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPodSpec(doc: Record<string, unknown>): Record<string, unknown> | null {
  const kind = doc.kind as string | undefined;
  if (!kind) return null;

  if (kind === 'Pod') {
    return (doc.spec as Record<string, unknown>) ?? null;
  }

  const workloadKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job'];
  if (workloadKinds.includes(kind)) {
    const spec = doc.spec as Record<string, unknown> | undefined;
    if (!spec) return null;
    const template = spec.template as Record<string, unknown> | undefined;
    return (template?.spec as Record<string, unknown>) ?? null;
  }

  if (kind === 'CronJob') {
    const spec = doc.spec as Record<string, unknown> | undefined;
    const jobTemplate = spec?.jobTemplate as Record<string, unknown> | undefined;
    const jtSpec = jobTemplate?.spec as Record<string, unknown> | undefined;
    const template = jtSpec?.template as Record<string, unknown> | undefined;
    return (template?.spec as Record<string, unknown>) ?? null;
  }

  return null;
}

function getContainers(podSpec: Record<string, unknown>): Array<Record<string, unknown>> {
  const containers: Array<Record<string, unknown>> = [];
  for (const key of ['containers', 'initContainers']) {
    const arr = podSpec[key];
    if (Array.isArray(arr)) {
      containers.push(...(arr as Array<Record<string, unknown>>));
    }
  }
  return containers;
}

// ── Rules — ported from MS AKS-Copilot PR #1837 ────────────────────────────

const privilegedContainerRule: SafeguardRule = {
  id: 'privileged-container',
  title: 'Privileged container detected',
  severity: 'high',
  message:
    'Containers must not run in privileged mode. Privileged containers have full access ' +
    'to the host and bypass most security boundaries. AKS Automatic clusters enforce ' +
    'Pod Security Standards (Baseline) which reject privileged pods.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1837',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const paths: string[] = [];
    for (const c of getContainers(podSpec)) {
      const sc = c.securityContext as Record<string, unknown> | undefined;
      if (sc?.privileged === true) {
        paths.push(`containers/${c.name ?? '?'}/securityContext/privileged`);
      }
    }
    return paths;
  },
};

const hostPathVolumeRule: SafeguardRule = {
  id: 'hostpath-volume',
  title: 'hostPath volume detected',
  severity: 'high',
  message:
    'hostPath volumes mount host filesystem paths into pods, enabling container escape ' +
    'and data exfiltration. AKS Automatic clusters restrict hostPath via Pod Security ' +
    'Standards. Use PersistentVolumeClaims with Azure Disk or Azure Files instead.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1837',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const volumes = podSpec.volumes as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(volumes)) return [];
    const paths: string[] = [];
    for (const vol of volumes) {
      if (vol.hostPath != null) {
        paths.push(`volumes/${vol.name ?? '?'}/hostPath`);
      }
    }
    return paths;
  },
};

const hostNetworkRule: SafeguardRule = {
  id: 'host-network',
  title: 'hostNetwork enabled',
  severity: 'high',
  message:
    'Pods with hostNetwork: true share the host network namespace, bypassing network ' +
    'policies and exposing host-level services. AKS Automatic clusters reject pods ' +
    'with hostNetwork under Baseline Pod Security Standards.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1837',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    return podSpec.hostNetwork === true ? ['spec/hostNetwork'] : [];
  },
};

const hostPidRule: SafeguardRule = {
  id: 'host-pid',
  title: 'hostPID enabled',
  severity: 'high',
  message:
    'Pods with hostPID: true share the host PID namespace, allowing processes in the ' +
    'container to see and signal host processes. Rejected by AKS Automatic Baseline ' +
    'Pod Security Standards.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1837',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    return podSpec.hostPID === true ? ['spec/hostPID'] : [];
  },
};

const hostIpcRule: SafeguardRule = {
  id: 'host-ipc',
  title: 'hostIPC enabled',
  severity: 'high',
  message:
    'Pods with hostIPC: true share the host IPC namespace, allowing access to host ' +
    'shared memory. Rejected by AKS Automatic Baseline Pod Security Standards.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1837',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    return podSpec.hostIPC === true ? ['spec/hostIPC'] : [];
  },
};

// ── Rules — ported from MS AKS-Copilot PR #1976 ────────────────────────────

const missingResourceLimitsRule: SafeguardRule = {
  id: 'missing-resource-limits',
  title: 'Missing resource limits',
  severity: 'medium',
  message:
    'Containers without resource limits can consume unbounded CPU/memory, causing ' +
    'node pressure and evictions. AKS Automatic best practice requires explicit ' +
    'resource requests and limits for predictable scheduling.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1976',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const paths: string[] = [];
    for (const c of getContainers(podSpec)) {
      const resources = c.resources as Record<string, unknown> | undefined;
      const limits = resources?.limits as Record<string, unknown> | undefined;
      if (!limits || (!limits.cpu && !limits.memory)) {
        paths.push(`containers/${c.name ?? '?'}/resources/limits`);
      }
    }
    return paths;
  },
};

const missingResourceRequestsRule: SafeguardRule = {
  id: 'missing-resource-requests',
  title: 'Missing resource requests',
  severity: 'medium',
  message:
    'Containers without resource requests cannot be scheduled predictably. The Kubernetes ' +
    'scheduler uses requests for bin-packing decisions. Always set CPU and memory requests.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1976',
  autoFixable: true,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const paths: string[] = [];
    for (const c of getContainers(podSpec)) {
      const resources = c.resources as Record<string, unknown> | undefined;
      const requests = resources?.requests as Record<string, unknown> | undefined;
      if (!requests || (!requests.cpu && !requests.memory)) {
        paths.push(`containers/${c.name ?? '?'}/resources/requests`);
      }
    }
    return paths;
  },
};

const runAsRootRule: SafeguardRule = {
  id: 'run-as-root',
  title: 'Container may run as root',
  severity: 'medium',
  message:
    'Containers running as root (UID 0) have elevated privileges inside the container. ' +
    'Set runAsNonRoot: true and specify a non-zero runAsUser in the security context.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1976',
  autoFixable: false,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const paths: string[] = [];
    for (const c of getContainers(podSpec)) {
      const sc = c.securityContext as Record<string, unknown> | undefined;
      if (!sc || sc.runAsNonRoot !== true) {
        paths.push(`containers/${c.name ?? '?'}/securityContext/runAsNonRoot`);
      }
    }
    return paths;
  },
};

const readOnlyRootFilesystemRule: SafeguardRule = {
  id: 'mutable-root-filesystem',
  title: 'Root filesystem is writable',
  severity: 'low',
  message:
    'A writable root filesystem allows attackers to modify binaries or install tools ' +
    'post-exploitation. Set readOnlyRootFilesystem: true and use emptyDir or volume ' +
    'mounts for write-needed paths.',
  msprLink: 'https://github.com/microsoft/AKS-Copilot/pull/1976',
  autoFixable: false,
  check(doc) {
    const podSpec = getPodSpec(doc);
    if (!podSpec) return [];
    const paths: string[] = [];
    for (const c of getContainers(podSpec)) {
      const sc = c.securityContext as Record<string, unknown> | undefined;
      if (!sc || sc.readOnlyRootFilesystem !== true) {
        paths.push(`containers/${c.name ?? '?'}/securityContext/readOnlyRootFilesystem`);
      }
    }
    return paths;
  },
};

// ── Exported rule list ──────────────────────────────────────────────────────

/** All safeguard rules, ordered by severity (high → medium → low). */
export const SAFEGUARD_RULES: ReadonlyArray<SafeguardRule> = [
  privilegedContainerRule,
  hostPathVolumeRule,
  hostNetworkRule,
  hostPidRule,
  hostIpcRule,
  missingResourceLimitsRule,
  missingResourceRequestsRule,
  runAsRootRule,
  readOnlyRootFilesystemRule,
];

/** Look up a rule by ID. */
export function getRuleById(id: string): SafeguardRule | undefined {
  return SAFEGUARD_RULES.find((r) => r.id === id);
}
