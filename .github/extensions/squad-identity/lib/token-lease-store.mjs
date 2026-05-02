import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STORE_PATH = path.join(os.tmpdir(), 'squad-identity-leases.json');
const LOCK_PATH = STORE_PATH + '.lock';
const LOCK_STALE_MS = 5000; // Consider lock stale after 5s

const now = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// File-level advisory locking (atomic mkdir as mutex)
// ---------------------------------------------------------------------------

function acquireLock(maxWaitMs = 3000) {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    try {
      fs.mkdirSync(LOCK_PATH);
      return; // acquired
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Check if lock is stale (holder crashed)
      try {
        const stat = fs.statSync(LOCK_PATH);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.rmdirSync(LOCK_PATH);
          continue; // retry immediately after breaking stale lock
        }
      } catch { /* stat failed — lock was just released */ continue; }
      if (Date.now() >= deadline) {
        // Force-break to avoid deadlock
        try { fs.rmdirSync(LOCK_PATH); } catch {}
        continue;
      }
      // Spin-wait with jitter
      const jitter = Math.floor(Math.random() * 10) + 1;
      const waitUntil = Date.now() + jitter;
      while (Date.now() < waitUntil) { /* busy wait (ms-scale) */ }
    }
  }
}

function releaseLock() {
  try { fs.rmdirSync(LOCK_PATH); } catch { /* already released */ }
}

function withLock(fn) {
  acquireLock();
  try {
    return fn();
  } finally {
    releaseLock();
  }
}

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return (parsed !== null && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(leases) {
  const data = JSON.stringify(leases, null, 2);
  fs.writeFileSync(STORE_PATH, data, { mode: 0o600 });
}

/** Returns true if the lease is past its deadline, revoked, or has no ops left. */
function isStale(lease, ts) {
  return lease.revoked || ts >= lease.deadlineUnix || lease.remainingOps <= 0;
}

/**
 * Partition the store into active leases only.
 * `changed` is true when at least one stale entry was dropped.
 * Must be called inside withLock when the result is written back.
 */
function pruneStore(store, ts) {
  const pruned = {};
  let changed = false;
  for (const [id, lease] of Object.entries(store)) {
    if (isStale(lease, ts)) {
      changed = true;
    } else {
      pruned[id] = lease;
    }
  }
  return { pruned, changed };
}

/**
 * Create a time-bound, operation-counted lease for a resolved token.
 * @param {object} opts
 * @param {string} opts.role - Role slug the lease is scoped to.
 * @param {string} opts.token - GitHub App installation token.
 * @param {number} [opts.maxOps=3] - Maximum exchange operations allowed.
 * @param {number} [opts.maxTimeSec=300] - Lease lifetime in seconds.
 * @returns {{ scopeId: string, role: string, token: string, deadlineUnix: number, remainingOps: number, leasedAtUnix: number }}
 */
export function createLease({ role, token, maxOps = 3, maxTimeSec = 300 }) {
  return withLock(() => {
    const ts = now();
    const scopeId = `lease_${crypto.randomBytes(8).toString('hex')}`;
    const leasedAtUnix = ts;
    const deadlineUnix = leasedAtUnix + maxTimeSec;
    const lease = { scopeId, role, token, deadlineUnix, remainingOps: maxOps, leasedAtUnix, revoked: false };
    const { pruned } = pruneStore(readStore(), ts);
    pruned[scopeId] = lease;
    writeStore(pruned);
    return { scopeId, role, token, deadlineUnix, remainingOps: maxOps, leasedAtUnix };
  });
}

/**
 * Exchange a lease for its token, decrementing the operation counter.
 * @param {string} scopeId - Lease identifier.
 * @param {string} role - Expected role slug (must match the lease).
 * @returns {{ token: string, remainingOps: number }}
 * @throws If lease is missing, expired, exhausted, revoked, or role mismatches.
 */
export function exchangeLease(scopeId, role) {
  return withLock(() => {
    const ts = now();
    const store = readStore();
    const { pruned } = pruneStore(store, ts);

    // Use original store for precise error diagnostics so error messages stay stable.
    const lease = store[scopeId];
    if (!lease)                  { writeStore(pruned); throw new Error(`Lease not found: ${scopeId}`); }
    if (lease.revoked)           { writeStore(pruned); throw new Error('Lease revoked'); }
    if (ts >= lease.deadlineUnix){ writeStore(pruned); throw new Error('Lease expired: deadline reached'); }
    if (lease.remainingOps === 0){ writeStore(pruned); throw new Error('Lease exhausted: no remaining operations'); }
    if (lease.role !== role)     { writeStore(pruned); throw new Error(`Role mismatch: lease is for '${lease.role}', not '${role}'`); }

    lease.remainingOps -= 1;
    if (lease.remainingOps === 0) {
      delete pruned[scopeId]; // exhausted after this op — remove immediately
    } else {
      pruned[scopeId] = lease;
    }
    writeStore(pruned);
    return { token: lease.token, remainingOps: lease.remainingOps };
  });
}

/**
 * Validate a lease without consuming an operation.
 * @param {string} scopeId
 * @returns {{ valid: boolean, reason?: string, remainingOps?: number, deadlineUnix?: number }}
 */
export function validateLease(scopeId) {
  return withLock(() => {
    const ts = now();
    const store = readStore();
    const { pruned, changed } = pruneStore(store, ts);

    const lease = store[scopeId];
    if (!lease)                  { if (changed) writeStore(pruned); return { valid: false, reason: `Lease not found: ${scopeId}` }; }
    if (lease.revoked)           { writeStore(pruned); return { valid: false, reason: 'Lease revoked' }; }
    if (ts >= lease.deadlineUnix){ writeStore(pruned); return { valid: false, reason: 'Lease expired: deadline reached' }; }
    if (lease.remainingOps === 0){ writeStore(pruned); return { valid: false, reason: 'Lease exhausted: no remaining operations' }; }
    if (changed) writeStore(pruned);
    return { valid: true, remainingOps: lease.remainingOps, deadlineUnix: lease.deadlineUnix };
  });
}

/**
 * Explicitly revoke a lease.
 * @param {string} scopeId
 */
export function revokeLease(scopeId) {
  withLock(() => {
    const ts = now();
    const { pruned } = pruneStore(readStore(), ts);
    delete pruned[scopeId]; // remove immediately — revoked tokens must not persist
    writeStore(pruned);
  });
}

export function cleanupExpired() {
  return withLock(() => {
    const { pruned } = pruneStore(readStore(), now());
    writeStore(pruned);
  });
}

/**
 * List all active leases (for debugging / status).
 * @returns {Array<{ scopeId: string, role: string, deadlineUnix: number, remainingOps: number, leasedAtUnix: number }>}
 */
export function listLeases() {
  return withLock(() => {
    const ts = now();
    const store = readStore();
    const { pruned, changed } = pruneStore(store, ts);
    if (changed) writeStore(pruned);
    return Object.values(pruned).map(({ scopeId, role, deadlineUnix, remainingOps, leasedAtUnix }) => ({
      scopeId, role, deadlineUnix, remainingOps, leasedAtUnix,
    }));
  });
}
