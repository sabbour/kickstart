/**
 * @module @aks-kickstart/mcp-server/adapter/session-mutex
 *
 * Per-session serialisation mutex.
 *
 * Ensures that concurrent MCP tool calls for the same session are serialised
 * so that interrupt state (pendingUserAction) is never raced (Zapp condition 6).
 *
 * In-memory only — a process restart clears all mutexes. This is correct:
 * after a restart there are no in-flight requests to serialise, and any
 * pending interrupts have been cleared from the interrupt store (→ 404).
 */

/** Map from sessionId to the tail of the current mutex chain. */
const mutexTails = new Map<string, Promise<void>>();

/**
 * Acquire the mutex for a session, run `fn`, then release.
 *
 * All calls for the same `sessionId` are serialised in arrival order.
 * Callers that throw are handled gracefully — the mutex is always released.
 */
export async function withSessionMutex<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const prev = mutexTails.get(sessionId) ?? Promise.resolve();

  let release!: () => void;
  const acquired = new Promise<void>((resolve) => { release = resolve; });

  // Chain: wait for the previous holder to release, then set ourselves as the new tail
  const next = prev.then(() => acquired);
  mutexTails.set(sessionId, next);

  // Wait for our turn
  await prev;

  try {
    return await fn();
  } finally {
    // Release the mutex — unblocks the next waiter
    release();
    // Cleanup: if no further waiters registered after us, remove the entry
    if (mutexTails.get(sessionId) === next) {
      mutexTails.delete(sessionId);
    }
  }
}
