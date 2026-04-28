import type { A2UIMessageV09 as A2UIMessage } from '../types/a2ui.js';
import type { Artifact, A2UICatalog, SessionCtx, Turn, PendingUserAction, AppIntent, AzureCredential, ClientHydrationMessage, ToolCallRecord } from '../types/session.js';
import type { Phase } from '../index.js';

// ── Browser-compatible crypto helpers (replaces node:crypto) ─────────────────

/** Encode a Uint8Array to a base64url string (no padding). */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** SHA-256 hash of a UTF-8 string, returned as base64url. */
async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return toBase64Url(hash);
}

/** Constant-time comparison of two equal-length strings (XOR-based). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export type { ClientHydrationMessage } from '../types/session.js';

export interface SessionData {
  sessionId: string;
  user: { oid: string; tid?: string; upn?: string };
  workspaceRoot?: string;
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
  const raw = typeof process !== "undefined" && process.env
    ? process.env.KICKSTART_MAX_LIVE_SURFACES
    : undefined;
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
  workspaceRoot?: string;
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
  /**
   * Paired tool call + result items captured during each turn (#103).
   * Bounded to the last 200 records via a sliding window in `recordToolCallRecord`.
   */
  toolCallItems: ToolCallRecord[] = [];
  /** Leela BLOCK-1: real first-class field; no type-cast side-channel needed. */
  lastActiveAt: number = Date.now();
  /**
   * SHA-256 hash of the per-session anonymous token (#1079). Only set for
   * anonymous sessions. The raw token is returned to the client exactly once
   * (in the SSE `start` event + `X-Anon-Session-Token` header); subsequent
   * requests must present it for session resumption.
   */
  anonTokenHash?: string;
  /**
   * The last Responses API response ID for this session (#126 / #114 Phase 3).
   * Set after each successful SDK run when `KICKSTART_USE_RESPONSES=1` to
   * the `result.lastResponseId` returned by the SDK. On subsequent turns the
   * runner passes this as `previousResponseId` instead of re-sending the full
   * `inputItems` history, letting the OpenAI Responses API maintain the
   * thread server-side. Absent on first turn (fallback: full history).
   */
  responseId?: string;

  constructor(opts: {
    sessionId: string;
    user: { oid: string; tid?: string; upn?: string };
    workspaceRoot?: string;
    currentPhase?: Phase;
  }) {
    this.sessionId = opts.sessionId;
    this.user = opts.user;
    this.workspaceRoot = opts.workspaceRoot;
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

  /**
   * Record a tool call + result pair captured during a turn (#103).
   * Keeps a bounded sliding window of the last 200 records.
   */
  recordToolCallRecord(record: ToolCallRecord): void {
    this.toolCallItems.push(record);
    if (this.toolCallItems.length > 200) {
      this.toolCallItems.splice(0, this.toolCallItems.length - 200);
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

export type { ISessionStore } from './session-store.js';
export { InMemorySessionStore, createSessionStore } from './session-store.js';
import { createSessionStore } from './session-store.js';

/** Module-level singleton; backed by InMemorySessionStore (Phase 1). */
export const sessionStore = createSessionStore('memory');

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
  workspaceRoot?: string,
): Session {
  const id = sessionId ?? crypto.randomUUID();
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
export async function generateAnonSessionToken(session: Session): Promise<string> {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = toBase64Url(bytes);
    session.anonTokenHash = await sha256Base64Url(token);
    return token;
  } catch (err) {
    throw new AnonTokenGenerationError(err);
  }
}

/**
 * Validate a client-supplied anonymous session token against the stored hash.
 * Uses timing-safe comparison to prevent timing side-channels.
 */
export async function validateAnonSessionToken(session: Session, token: string): Promise<boolean> {
  if (!session.anonTokenHash) return false;
  if (typeof token !== 'string' || token.length === 0) return false;
  try {
    const incoming = await sha256Base64Url(token);
    const expected = session.anonTokenHash;
    return timingSafeEqual(incoming, expected);
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
  workspaceRoot?: string,
): SessionResult {
  const id = sessionId ?? crypto.randomUUID();
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
  const raw = typeof process !== "undefined" && process.env
    ? process.env.HARNESS_ALLOW_ANON_HYDRATION
    : undefined;
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
