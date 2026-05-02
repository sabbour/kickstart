// Tests for token-lease-store.mjs — pruning behaviour (Zapp PR #358 security finding)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createLease,
  exchangeLease,
  validateLease,
  revokeLease,
  listLeases,
  cleanupExpired,
} from '../token-lease-store.mjs';

const STORE_PATH = path.join(os.tmpdir(), 'squad-identity-leases.json');
const LOCK_PATH  = STORE_PATH + '.lock';

function cleanupStore() {
  try { fs.unlinkSync(STORE_PATH); } catch { /* ok */ }
  try { fs.rmdirSync(LOCK_PATH);   } catch { /* ok */ }
}

function readDisk() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')); } catch { return {}; }
}

function backdateToExpired(scopeId) {
  const raw = readDisk();
  raw[scopeId].deadlineUnix = Math.floor(Date.now() / 1000) - 1;
  fs.writeFileSync(STORE_PATH, JSON.stringify(raw, null, 2), { mode: 0o600 });
}

describe('token-lease-store — stale lease pruning', () => {
  beforeEach(cleanupStore);
  afterEach(cleanupStore);

  it('prunes expired leases from disk on the next createLease call', () => {
    const { scopeId: staleId } = createLease({ role: 'backend', token: 'tok-stale', maxTimeSec: 300, maxOps: 3 });
    backdateToExpired(staleId);

    createLease({ role: 'backend', token: 'tok-fresh', maxTimeSec: 300, maxOps: 3 });

    expect(readDisk()[staleId]).toBeUndefined();
  });

  it('prunes expired leases from disk on the next listLeases call', () => {
    const { scopeId: staleId } = createLease({ role: 'backend', token: 'tok-stale', maxTimeSec: 300, maxOps: 3 });
    backdateToExpired(staleId);

    const active = listLeases();
    expect(active.find(l => l.scopeId === staleId)).toBeUndefined();
    expect(readDisk()[staleId]).toBeUndefined();
  });

  it('prunes stale side-entries from disk on validateLease of an active lease', () => {
    const { scopeId } = createLease({ role: 'backend', token: 'tok-active', maxTimeSec: 300, maxOps: 3 });

    // Inject a revoked lease directly into the store file
    const raw = readDisk();
    const ghostId = 'lease_deadbeef00000000';
    raw[ghostId] = {
      scopeId: ghostId, role: 'backend', token: 'tok-ghost',
      deadlineUnix: Math.floor(Date.now() / 1000) + 300,
      remainingOps: 3, leasedAtUnix: Math.floor(Date.now() / 1000), revoked: true,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(raw, null, 2), { mode: 0o600 });

    const result = validateLease(scopeId);
    expect(result.valid).toBe(true);

    const onDisk = readDisk();
    expect(onDisk[ghostId]).toBeUndefined();  // revoked ghost pruned
    expect(onDisk[scopeId]).toBeDefined();    // active entry preserved
  });

  it('removes an exhausted lease from disk immediately after the last exchange', () => {
    const { scopeId } = createLease({ role: 'backend', token: 'tok-exhaust', maxTimeSec: 300, maxOps: 1 });

    const { remainingOps } = exchangeLease(scopeId, 'backend');
    expect(remainingOps).toBe(0);
    expect(readDisk()[scopeId]).toBeUndefined();
  });

  it('removes a revoked lease from disk immediately on revokeLease', () => {
    const { scopeId } = createLease({ role: 'backend', token: 'tok-revoke', maxTimeSec: 300, maxOps: 3 });
    revokeLease(scopeId);
    expect(readDisk()[scopeId]).toBeUndefined();
  });

  it('prunes stale entries even when the target lease triggers an error in exchangeLease', () => {
    // Stale ghost lease in the store
    const raw = {};
    const ghostId = 'lease_cafebabe00000000';
    raw[ghostId] = {
      scopeId: ghostId, role: 'backend', token: 'tok-ghost',
      deadlineUnix: Math.floor(Date.now() / 1000) - 10, // already expired
      remainingOps: 3, leasedAtUnix: Math.floor(Date.now() / 1000) - 400, revoked: false,
    };
    fs.writeFileSync(STORE_PATH, JSON.stringify(raw, null, 2), { mode: 0o600 });

    expect(() => exchangeLease('lease_nonexistent', 'backend')).toThrow('Lease not found');
    expect(readDisk()[ghostId]).toBeUndefined(); // ghost pruned on error path
  });

  it('preserves file mode 0o600 after a prune-and-write', () => {
    const { scopeId } = createLease({ role: 'backend', token: 'tok-mode', maxTimeSec: 300, maxOps: 3 });
    backdateToExpired(scopeId);

    listLeases(); // triggers prune-and-write

    const stat = fs.statSync(STORE_PATH);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('cleanupExpired is idempotent and prunes the same entries as normal access paths', () => {
    const { scopeId: a } = createLease({ role: 'backend', token: 'tok-a', maxTimeSec: 300, maxOps: 3 });
    const { scopeId: b } = createLease({ role: 'backend', token: 'tok-b', maxTimeSec: 300, maxOps: 3 });
    backdateToExpired(a);

    cleanupExpired();
    cleanupExpired(); // idempotent

    const onDisk = readDisk();
    expect(onDisk[a]).toBeUndefined();
    expect(onDisk[b]).toBeDefined();
  });
});
