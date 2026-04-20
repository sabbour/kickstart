/**
 * @module @aks-kickstart/mcp-server/adapter/interrupt-store
 *
 * CAS (Compare-And-Swap) single-use interrupt state store.
 *
 * Security properties (Zapp conditions 5 & 6):
 * - Single-use: `claim()` atomically marks the entry as consumed; a second
 *   call with the same actionId returns null → 404.
 * - Action-bound: the actionId is tied to the specific UserAction name.
 * - TTL: entries expire after `INTERRUPT_TTL_MS` (default 15 min).
 * - Replay guard: consumed flag prevents replays even within the TTL window.
 * - Process restart → 404: this store is entirely in-process memory; a
 *   restart clears all entries. Callers receive 404 for any pending interrupt
 *   after a restart.
 * - Per-session mutex: callers must hold the session mutex before calling
 *   `claim()` to prevent concurrent resume races.
 */

export interface InterruptEntry {
  /** Session that issued this interrupt. */
  sessionId: string;
  /** Unique run ID matching the one sent to the MCP client. */
  actionId: string;
  /** Canonical UserAction name (e.g. "azure:create_subscription"). */
  actionName: string;
  /** A2UI component to render for user confirmation, if any. */
  confirmComponent?: { component: string; props?: Record<string, unknown> };
  /** JSON Schema object for validating the resume payload. */
  resultSchema: Record<string, unknown>;
  /** Unix timestamp (ms) when this entry was created. */
  issuedAt: number;
  /** True once `claim()` has been called — prevents replays. */
  consumed: boolean;
}

/** Default TTL: 15 minutes. */
export const INTERRUPT_TTL_MS = 15 * 60 * 1_000;

/**
 * Module-level in-process store.
 * Keyed by `${sessionId}:${actionId}` for fast lookup.
 *
 * A process restart clears this map → any pending interrupts return 404,
 * which is the correct behaviour (Leela condition 2, Zapp condition 6).
 */
const store = new Map<string, InterruptEntry>();

function storeKey(sessionId: string, actionId: string): string {
  return `${sessionId}:${actionId}`;
}

/**
 * Register a new interrupt entry.
 * Called by the MCP adapter when the Runner emits `user_action_req`.
 */
export function registerInterrupt(entry: Omit<InterruptEntry, 'consumed'>): void {
  const key = storeKey(entry.sessionId, entry.actionId);
  store.set(key, { ...entry, consumed: false });
}

/**
 * Attempt to claim an interrupt entry for resume (CAS single-use).
 *
 * Returns the entry if:
 * - It exists and has not yet been consumed.
 * - It has not expired (within TTL).
 *
 * Returns null (→ 404) if:
 * - The entry does not exist (never registered, or process restarted).
 * - The entry was already consumed (replay attempt).
 * - The entry has expired past its TTL.
 *
 * The entry is atomically marked `consumed = true` before returning, so
 * concurrent callers serialised through the session mutex cannot both succeed.
 */
export function claimInterrupt(sessionId: string, actionId: string): InterruptEntry | null {
  const key = storeKey(sessionId, actionId);
  const entry = store.get(key);

  if (!entry) return null;
  if (entry.consumed) return null;
  if (Date.now() - entry.issuedAt > INTERRUPT_TTL_MS) {
    store.delete(key);
    return null;
  }

  // CAS: mark consumed before returning — prevents any concurrent replay
  entry.consumed = true;
  return entry;
}

/** Remove a specific interrupt entry (e.g. on session cleanup). */
export function removeInterrupt(sessionId: string, actionId: string): void {
  store.delete(storeKey(sessionId, actionId));
}

/** Remove all interrupt entries for a session (e.g. on session expiry). */
export function removeSessionInterrupts(sessionId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      store.delete(key);
    }
  }
}

/** Purge all entries that have exceeded their TTL. Called periodically. */
export function purgeExpiredInterrupts(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.issuedAt > INTERRUPT_TTL_MS) {
      store.delete(key);
    }
  }
}

/** Return the number of entries currently in the store (for testing). */
export function interruptStoreSize(): number {
  return store.size;
}

/** Clear ALL entries — for test isolation only. */
export function clearInterruptStore(): void {
  store.clear();
}
