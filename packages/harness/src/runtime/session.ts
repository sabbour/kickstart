import { randomUUID, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { A2UIMessageV09 as A2UIMessage } from '../types/a2ui.js';
import type { Artifact, A2UICatalog, SessionCtx, Turn, PendingUserAction, AppIntent, AzureCredential, ClientHydrationMessage } from '../types/session.js';
import type { Phase } from '../index.js';

export type { ClientHydrationMessage } from '../types/session.js';

export interface SessionData {
  sessionId: string;
  user: { oid: string; tid?: string; upn?: string };
  workspaceRoot: string;
  currentPhase: Phase;
  history: { role: 'user' | 'assistant'; content: string }[];
  a2uiEmissions: A2UIMessage[];
  pendingUserAction: PendingUserAction | null;
  createdAt: number;
  lastActiveAt: number;
}

const DEFAULT_CATALOG: A2UICatalog = { id: 'kickstart', components: [], userActions: [] };

// ── Live-surface cap (D11 / Zapp M1, #1075) ─────────────────────────────────
// Resolved ONCE at module load so every `Session` in this process shares the
// same cap. Misconfiguration falls back silently to the default — misconfig
// should never crash session initialisation.
const DEFAULT_MAX_LIVE_SURFACES = 1000;
const MIN_LIVE_SURFACES_CAP = 10;
const MAX_LIVE_SURFACES_CAP = 100_000;

function resolveMaxLiveSurfaces(): number {
  const raw = process.env.KICKSTART_MAX_LIVE_SURFACES;
  if (!raw) return DEFAULT_MAX_LIVE_SURFACES;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_MAX_LIVE_SURFACES;
  return Math.min(MAX_LIVE_SURFACES_CAP, Math.max(MIN_LIVE_SURFACES_CAP, n));
}

const MAX_LIVE_SURFACES = resolveMaxLiveSurfaces();

export class Session implements SessionCtx {
  readonly sessionId: string;
  user: { oid: string; tid?: string; upn?: string };
  intent: AppIntent | null = null;
  artifacts: Map<string, Artifact> = new Map();
  a2uiEmissions: A2UIMessage[] = [];
  /** D11 / #1075 — live surface ids for idempotency guard in `core.emit_ui`. */
  liveSurfaceIds: Set<string> = new Set();
  /** Zapp M1 / #1075 — per-session live-surface cap (process-wide constant). */
  readonly maxLiveSurfaces: number = MAX_LIVE_SURFACES;
  negotiatedCatalog: A2UICatalog = DEFAULT_CATALOG;
  recentTurns: Turn[] = [];
  activeAgent = 'core.triage';
  pendingUserAction: PendingUserAction | null = null;
  workspaceRoot: string;
  currentPhase: Phase;
  /**
   * Per-turn record of skill ids pulled via `core.read_skill`. Reset at the
   * top of every `Runner.run` turn (try/finally). Also used by the `end`
   * SSE event to populate `skillsExecuted` (D12 — count only what actually
   * reached the model).
   */
  skillsPulled?: Set<string>;
  skillsPulledBytes?: number;
  skillsPulledTokens?: number;
  /** Leela BLOCK-1: real first-class field; no type-cast side-channel needed. */
  lastActiveAt: number = Date.now();
  /**
   * SHA-256 hash of the per-session anonymous token (#1079). Only set for
   * anonymous sessions. The raw token is returned to the client exactly once
   * (in the SSE `start` event + `X-Anon-Session-Token` header); subsequent
   * requests must present it for session resumption.
   */
  anonTokenHash?: string;

  constructor(opts: {
    sessionId: string;
    user: { oid: string; tid?: string; upn?: string };
    workspaceRoot?: string;
    currentPhase?: Phase;
  }) {
    this.sessionId = opts.sessionId;
    this.user = opts.user;
    this.workspaceRoot = opts.workspaceRoot ?? '/workspace';
    this.currentPhase = (opts.currentPhase ?? 'discover') as Phase;
  }

  recordA2UIEmission(msg: A2UIMessage): void {
    this.a2uiEmissions.push(msg);
    // Keep `liveSurfaceIds` in sync with the append-only log. The tool-side
    // guard in `core.emit_ui` enforces dedupe/existence invariants BEFORE
    // calling this method; we mirror the set here so the invariant survives
    // any non-tool call path that ever lands in the future.
    // Narrow structural checks — avoid importing the full union type discriminator logic.
    const m = msg as unknown as {
      createSurface?: { surfaceId?: string };
      deleteSurface?: { surfaceId?: string };
    };
    if (m.createSurface && typeof m.createSurface.surfaceId === 'string') {
      this.liveSurfaceIds.add(m.createSurface.surfaceId);
    } else if (m.deleteSurface && typeof m.deleteSurface.surfaceId === 'string') {
      this.liveSurfaceIds.delete(m.deleteSurface.surfaceId);
    }
  }

  recordArtifact(artifact: Artifact): void {
    this.artifacts.set(artifact.path, artifact);
  }

  recordTurn(turn: Turn): void {
    this.recentTurns.push(turn);
    // Keep a bounded sliding window of recent turns (last 50)
    if (this.recentTurns.length > 50) {
      this.recentTurns.splice(0, this.recentTurns.length - 50);
    }
  }

  async getAzureCreds(): Promise<AzureCredential> {
    // TODO(Step 7): Implement real Azure credential retrieval via pack-azure.
    return undefined;
  }

  async getGithubToken(): Promise<unknown> {
    // TODO(Step 9): Implement real GitHub token retrieval via pack-github.
    return undefined;
  }

  touch(): void {
    this.lastActiveAt = Date.now();
  }

  /** Drain all pending a2uiEmissions and clear the array, returning what was drained. */
  drainA2UIEmissions(): A2UIMessage[] {
    const drained = this.a2uiEmissions.splice(0);
    return drained;
  }
}

// ---------------------------------------------------------------------------
// In-memory session store
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 min

export const sessionStore = new Map<string, Session>();

// Cleanup stale sessions periodically
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessionStore) {
    const ttl = isAnonymousSession(session) ? ANON_SESSION_TTL_MS : SESSION_TTL_MS;
    if (now - session.lastActiveAt > ttl) {
      sessionStore.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Allow the timer to not block process exit in serverless environments
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export function getOrCreateSession(
  sessionId: string | undefined,
  oid: string,
  workspaceRoot = '/workspace',
): Session {
  const id = sessionId ?? randomUUID();
  let session = sessionStore.get(id);
  if (!session) {
    session = new Session({ sessionId: id, user: { oid }, workspaceRoot });
    sessionStore.set(id, session);
  } else if (session.user.oid !== oid) {
    // B1: Prevent cross-user session attachment
    throw new Error('SESSION_OID_MISMATCH');
  }
  // Update last-active time for TTL cleanup
  session.touch();
  return session;
}

// ---------------------------------------------------------------------------
// Anonymous session token (#1079)
// ---------------------------------------------------------------------------

/** TTL for anonymous sessions — 10 min (shorter than the 30 min default). */
export const ANON_SESSION_TTL_MS = 10 * 60 * 1000;

/**
 * Error thrown when crypto primitives fail during anonymous token generation.
 * Callers should catch this and return 503 (Service Unavailable) with a
 * Retry-After header instead of letting the process crash.
 */
export class AnonTokenGenerationError extends Error {
  override readonly name = 'AnonTokenGenerationError';
  constructor(cause: unknown) {
    super('ANON_TOKEN_GENERATION_FAILED');
    this.cause = cause;
  }
}

/**
 * Generate a cryptographically random per-session token for an anonymous
 * session. Stores the SHA-256 hash on the session; returns the raw token
 * (base64url, 32 bytes of entropy). The caller sends the raw token to the
 * client exactly once.
 *
 * @throws {AnonTokenGenerationError} if crypto primitives fail (entropy
 *   exhaustion, FIPS restrictions, etc.). The caller should respond with
 *   503 + Retry-After rather than letting the server crash.
 */
export function generateAnonSessionToken(session: Session): string {
  try {
    const token = randomBytes(32).toString('base64url');
    session.anonTokenHash = createHash('sha256').update(token).digest('base64url');
    return token;
  } catch (err) {
    throw new AnonTokenGenerationError(err);
  }
}

/**
 * Validate a client-supplied anonymous session token against the stored hash.
 * Uses timing-safe comparison to prevent timing side-channels.
 */
export function validateAnonSessionToken(session: Session, token: string): boolean {
  if (!session.anonTokenHash) return false;
  if (typeof token !== 'string' || token.length === 0) return false;
  const incoming = createHash('sha256').update(token).digest('base64url');
  const expected = session.anonTokenHash;
  try {
    return timingSafeEqual(Buffer.from(incoming), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Check if a session belongs to an anonymous (unauthenticated) user. */
export function isAnonymousSession(session: Session): boolean {
  return session.user.oid === 'anonymous';
}

/**
 * Extended result from {@link getOrCreateSessionResult} that also reports
 * whether the session was freshly created vs. resumed from the store.
 */
export interface SessionResult {
  session: Session;
  created: boolean;
}

/**
 * Like {@link getOrCreateSession} but also returns a `created` flag so
 * callers can distinguish new-session from resume without peeking at the
 * store directly.
 */
export function getOrCreateSessionResult(
  sessionId: string | undefined,
  oid: string,
  workspaceRoot = '/workspace',
): SessionResult {
  const id = sessionId ?? randomUUID();
  let session = sessionStore.get(id);
  let created = false;
  if (!session) {
    session = new Session({ sessionId: id, user: { oid }, workspaceRoot });
    sessionStore.set(id, session);
    created = true;
  } else if (session.user.oid !== oid) {
    throw new Error('SESSION_OID_MISMATCH');
  }
  session.touch();
  return { session, created };
}

// ---------------------------------------------------------------------------
// Cold-session hydration (#1074 D3)
// ---------------------------------------------------------------------------

/**
 * Default maximum number of client-supplied history messages accepted at the
 * request boundary for cold-session hydration (Leela DP, Zapp M1).
 */
export const HYDRATION_DEFAULT_CAP = 20;

/**
 * Default maximum byte length per hydrated message `content`. Combined with
 * {@link HYDRATION_DEFAULT_CAP} this gives a hard 80 KB ceiling on the history
 * that a single `POST /api/converse` invocation can seed.
 */
export const HYDRATION_CONTENT_MAX_BYTES = 4 * 1024;

/**
 * Anon-hydration interlock flag (Zapp M4).
 *
 * Defaults to `false`. While `false`, an anonymous session
 * (`session.user.oid === 'anonymous'`) may not seed its recentTurns via
 * client-supplied `messages[]` — this prevents the #1079 anon-sessionId
 * guess vector from being amplified by cold-hydration. Authenticated users
 * hydrate freely regardless of this flag.
 */
export function isAnonHydrationAllowed(): boolean {
  const raw = process.env.HARNESS_ALLOW_ANON_HYDRATION;
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true';
}

export interface HydrateColdSessionResult {
  /** Number of turns actually appended to `session.recentTurns`. */
  hydrated: number;
  /**
   * Reason the hydration was a no-op, if any. `null` when hydration ran (even
   * if `hydrated === 0`, e.g. an empty `messages: []` on a brand-new session).
   */
  ignored: null | 'warm' | 'disabled';
}

/**
 * Hydrate a brand-new (cold-start) `Session` from client-supplied history.
 *
 * Contract (Leela DP + Zapp M1–M3):
 *  - Hydrates **only** when `session.recentTurns.length === 0` — warm sessions
 *    are server-authoritative and client `messages` are ignored.
 *  - Messages are expected to already be schema-validated (strict zod
 *    discriminatedUnion at the handler) and guardrail-scanned (per-user-turn
 *    input guardrails at the handler, fail-closed). This helper does NOT
 *    re-validate — its job is the atomic "brand-new detection + push"
 *    primitive.
 *  - Each appended turn is stamped `trust: 'client-hydrated'` so the runner
 *    can render it inside a delimited untrusted-context block.
 *
 * Synchronous in-process hydration; JS event-loop makes the existence check
 * + push race-free for a given sessionId. Two concurrent cold-hydrations on
 * the same `Session` instance → first writer wins; the second call observes
 * `recentTurns.length > 0` and no-ops. Regression-guarded by the race test.
 */
export function hydrateColdSession(
  session: Session,
  messages: readonly ClientHydrationMessage[] | undefined,
  opts: { enabled?: boolean; cap?: number } = {},
): HydrateColdSessionResult {
  const enabled = opts.enabled ?? true;
  if (!enabled) {
    return { hydrated: 0, ignored: 'disabled' };
  }
  if (session.recentTurns.length > 0) {
    return { hydrated: 0, ignored: 'warm' };
  }
  if (!messages || messages.length === 0) {
    return { hydrated: 0, ignored: null };
  }

  const cap = opts.cap ?? HYDRATION_DEFAULT_CAP;
  const slice = messages.slice(0, cap);
  const nowIso = new Date().toISOString();
  let hydrated = 0;
  for (const m of slice) {
    // role filter is a defense-in-depth belt over the schema's suspenders.
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    if (typeof m.content !== 'string' || m.content.length === 0) continue;
    session.recordTurn({
      role: m.role,
      content: m.content,
      timestamp: nowIso,
      trust: 'client-hydrated',
    });
    hydrated++;
  }
  return { hydrated, ignored: null };
}
