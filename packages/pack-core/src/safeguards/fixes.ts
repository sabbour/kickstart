/**
 * Deterministic fix rewrites for auto-fixable safeguard violations.
 *
 * Security: no eval, no shell, no code execution. Pure YAML ↔ JS object
 * transforms using the `yaml` library's AST-preserving API.
 *
 * Only allowlisted rule IDs are accepted (Zapp condition #3).
 */

import { parseAllDocuments, stringify } from 'yaml';

// ── Allowlisted fix IDs ─────────────────────────────────────────────────────

const FIXABLE_IDS = new Set([
  'privileged-container',
  'hostpath-volume',
  'host-network',
  'host-pid',
  'host-ipc',
  'missing-resource-limits',
  'missing-resource-requests',
]);

/** Default resource limits applied when missing. */
const DEFAULT_LIMITS = { cpu: '500m', memory: '256Mi' };

/** Default resource requests applied when missing. */
const DEFAULT_REQUESTS = { cpu: '100m', memory: '128Mi' };

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPodSpec(doc: Record<string, unknown>): Record<string, unknown> | null {
  const kind = doc.kind as string | undefined;
  if (!kind) return null;

  if (kind === 'Pod') return (doc.spec as Record<string, unknown>) ?? null;

  const workloadKinds = ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job'];
  if (workloadKinds.includes(kind)) {
    const spec = doc.spec as Record<string, unknown> | undefined;
    const template = spec?.template as Record<string, unknown> | undefined;
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
  const result: Array<Record<string, unknown>> = [];
  for (const key of ['containers', 'initContainers']) {
    const arr = podSpec[key];
    if (Array.isArray(arr)) result.push(...(arr as Array<Record<string, unknown>>));
  }
  return result;
}

// ── Fix functions (one per fixable rule) ────────────────────────────────────

function fixPrivilegedContainer(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  for (const c of getContainers(podSpec)) {
    const sc = c.securityContext as Record<string, unknown> | undefined;
    if (sc?.privileged === true) {
      sc.privileged = false;
    }
  }
}

function fixHostPathVolume(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  const volumes = podSpec.volumes as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(volumes)) return;

  for (const vol of volumes) {
    if (vol.hostPath != null) {
      delete vol.hostPath;
      vol.persistentVolumeClaim = {
        claimName: `${vol.name ?? 'data'}-pvc`,
      };
    }
  }
}

function fixHostNetwork(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  if (podSpec.hostNetwork === true) {
    delete podSpec.hostNetwork;
  }
}

function fixHostPid(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  if (podSpec.hostPID === true) {
    delete podSpec.hostPID;
  }
}

function fixHostIpc(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  if (podSpec.hostIPC === true) {
    delete podSpec.hostIPC;
  }
}

function fixMissingResourceLimits(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  for (const c of getContainers(podSpec)) {
    if (!c.resources) c.resources = {};
    const resources = c.resources as Record<string, unknown>;
    const limits = resources.limits as Record<string, unknown> | undefined;
    if (!limits || (!limits.cpu && !limits.memory)) {
      resources.limits = { ...DEFAULT_LIMITS, ...limits };
    }
  }
}

function fixMissingResourceRequests(doc: Record<string, unknown>): void {
  const podSpec = getPodSpec(doc);
  if (!podSpec) return;
  for (const c of getContainers(podSpec)) {
    if (!c.resources) c.resources = {};
    const resources = c.resources as Record<string, unknown>;
    const requests = resources.requests as Record<string, unknown> | undefined;
    if (!requests || (!requests.cpu && !requests.memory)) {
      resources.requests = { ...DEFAULT_REQUESTS, ...requests };
    }
  }
}

const FIX_DISPATCH: Record<string, (doc: Record<string, unknown>) => void> = {
  'privileged-container': fixPrivilegedContainer,
  'hostpath-volume': fixHostPathVolume,
  'host-network': fixHostNetwork,
  'host-pid': fixHostPid,
  'host-ipc': fixHostIpc,
  'missing-resource-limits': fixMissingResourceLimits,
  'missing-resource-requests': fixMissingResourceRequests,
};

// ── Public API ──────────────────────────────────────────────────────────────

export interface FixResult {
  fixedManifest: string;
  appliedFixes: string[];
  skippedIds: string[];
  remainingViolations: string[];
}

/**
 * Apply deterministic fixes to the given manifest YAML text.
 *
 * Only allowlisted rule IDs are processed; unknown or non-fixable IDs
 * are returned in `skippedIds`.
 */
export function applyFixes(manifestText: string, violationIds: string[]): FixResult {
  const appliedFixes: string[] = [];
  const skippedIds: string[] = [];

  for (const id of violationIds) {
    if (FIXABLE_IDS.has(id)) {
      appliedFixes.push(id);
    } else {
      skippedIds.push(id);
    }
  }

  const docs = parseAllDocuments(manifestText);
  const jsonDocs: Array<Record<string, unknown>> = [];
  for (const doc of docs) {
    const obj = doc.toJSON();
    if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
      jsonDocs.push(obj as Record<string, unknown>);
      continue;
    }
    const record = obj as Record<string, unknown>;
    for (const id of appliedFixes) {
      FIX_DISPATCH[id]?.(record);
    }
    jsonDocs.push(record);
  }

  const fixedManifest = jsonDocs
    .map((d) => stringify(d, { lineWidth: 0 }))
    .join('---\n');

  return {
    fixedManifest,
    appliedFixes,
    skippedIds,
    remainingViolations: skippedIds,
  };
}

/** Check if a rule ID is auto-fixable. */
export function isFixable(id: string): boolean {
  return FIXABLE_IDS.has(id);
}
