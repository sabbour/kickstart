/**
 * Resume handler — validates ownership + resultSchema before resuming a paused Runner run.
 *
 * Zapp Critical 1: OID check — 403 if requester doesn't own the session.
 * Zapp Critical 2: resultSchema server-side validation — 400 if payload fails schema.
 * Zapp Critical 3: Playground stubs gate enforced in runner.ts UserAction tool wrappers.
 */

import { z } from 'zod';
import type { PackRegistry } from './registry.js';
import type { Session } from './session.js';
import type { Runner } from './runner.js';
import type { SSEWriter } from './sse.js';

/** Parsed from the X-MS-CLIENT-PRINCIPAL header on Azure Static Web Apps. */
export interface ClientPrincipal {
  identityProvider: string;
  userId: string;
  userDetails: string;
  userRoles: string[];
  claims?: Array<{ typ: string; val: string }>;
}

/**
 * Extract the user OID from the Azure SWA client principal header.
 * Falls back to `userId` if the OID claim is not present (non-AAD providers).
 */
export function getOidFromPrincipalHeader(headerValue: string | null | undefined): string | null {
  if (!headerValue) return null;
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf-8');
    const principal = JSON.parse(decoded) as ClientPrincipal;

    // Prefer the OID claim from AAD
    const oidClaim = principal.claims?.find((c) => c.typ === 'http://schemas.microsoft.com/identity/claims/objectidentifier' || c.typ === 'oid');
    if (oidClaim?.val) return oidClaim.val;

    // Fallback to userId
    return principal.userId ?? null;
  } catch {
    return null;
  }
}

export interface ResumeHandlerInput {
  /** Session to resume. */
  session: Session;
  /** OID of the authenticated requester (from X-MS-CLIENT-PRINCIPAL). */
  requesterOid: string | null;
  /** Name of the UserAction tool to resume (e.g. "core:some_action"). */
  toolName: string;
  /** The run ID that was issued in the user_action_req event. */
  runId: string;
  /** Raw result payload from the browser. */
  resultPayload: unknown;
}

export interface ResumeHandlerResult {
  /** HTTP status code to return. */
  status: 200 | 400 | 403 | 404;
  /** Error message (only set when status !== 200). */
  error?: string;
}

/**
 * Validates the resume request (ownership + schema) and resumes the runner if valid.
 * Returns an action result object that the API handler uses to set response status.
 */
export async function handleResume(
  input: ResumeHandlerInput,
  runner: Runner,
  registry: PackRegistry,
  sseWrite: SSEWriter,
): Promise<ResumeHandlerResult> {
  const { session, requesterOid, toolName, runId, resultPayload } = input;

  // Zapp Critical 1: Session ownership check
  if (requesterOid === null || session.user.oid !== requesterOid) {
    return { status: 403, error: 'Forbidden: session does not belong to this user.' };
  }

  // Verify there is a pending action and it matches
  // B3: compare-and-swap — clear pendingUserAction BEFORE validating to prevent concurrent replay
  const pending = session.pendingUserAction;
  if (!pending) {
    return { status: 404, error: 'No pending UserAction on this session.' };
  }
  session.pendingUserAction = null;

  if (pending.name !== toolName) {
    return {
      status: 400,
      error: `Pending action is "${pending.name}", not "${toolName}".`,
    };
  }
  if (runId && pending.runId !== runId) {
    return { status: 400, error: `Run ID mismatch. Expected "${pending.runId}".` };
  }

  // Zapp Critical 2: resultSchema server-side validation
  let contribution: { resultSchema: z.ZodTypeAny };
  try {
    contribution = registry.getUserAction(toolName);
  } catch {
    return { status: 400, error: `Unknown UserAction: "${toolName}".` };
  }

  const parsed = contribution.resultSchema.safeParse(resultPayload);
  if (!parsed.success) {
    return {
      status: 400,
      error: `Result payload failed schema validation: ${parsed.error.message}`,
    };
  }

  // All checks passed — resume the runner
  await runner.resume(session, parsed.data, sseWrite);

  return { status: 200 };
}
