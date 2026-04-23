/**
 * `core.read_skill` — on-demand pull loader for SKILL.md bodies (D5, #1070).
 *
 * The runner advertises the id+description of every allowlisted skill in the
 * agent's system prompt under a heading that reads:
 *
 *   ## Available Skills (call core.read_skill(id) to load the full body)
 *
 * When the model decides a skill is relevant, it calls `core.read_skill({ id })`
 * to fetch the full SKILL.md body. No router, no pre-selection, no keyword
 * heuristics — the main LLM IS the router (Ahmed's v5 directive).
 *
 * ── Policy exception (F1, Leela self-review) ────────────────────────────────
 * Unlike most tools, `core.read_skill` is NOT placed in any pack's
 * `toolAllowlist`. The runner registers it UNIVERSALLY on every agent as a
 * harness-provided introspection tool (same spirit as `core.emit_ui` and
 * `core.search_components`, but note those two ARE still listed in pack
 * allowlists — this one deliberately is not). The tool's own fail-closed
 * `matchesSkill`-based allowlist enforces per-skill access; the `toolAllowlist`
 * mechanism would be redundant with that and would also require every pack to
 * opt in to something that is a harness primitive. If you ever need to take
 * the tool away from a specific agent, delete the registration line in
 * `runner.ts` — there is no per-pack lever for it by design.
 *
 * ── Security / pack-authoring note (Zapp L2) ────────────────────────────────
 * SKILL.md bodies are LLM-visible whenever the model reads them via this
 * tool. Treat pack SKILL.md content as if it will be rendered verbatim into
 * the model's context window: do NOT embed secrets, API keys, customer data,
 * or any other content that shouldn't cross the trust boundary into the
 * prompt.
 *
 * ── Error shape (Zapp L1) ───────────────────────────────────────────────────
 * Returns a discriminated union. `not_available` and `unknown_skill` are kept
 * separate so the model can distinguish "wrong for this agent" from "typo /
 * stale name" and recover appropriately. Both error messages echo only the
 * id the model just asked for; no enumeration / discovery surface is added.
 *
 * ── Handoff coupling (Zapp L5) ──────────────────────────────────────────────
 * `agentName` is captured at turn entry when the tool is created. If #1073
 * introduces live handoffs that swap the active agent mid-turn, this tool's
 * allowlist will still reflect the ORIGINAL agent. That's acceptable for D5
 * because the current harness aborts the run on handoff (see `runner.ts`
 * handoff_occurred branch) and starts a fresh turn against the new agent,
 * which rebuilds the tool with the new agentName. When #1073 lands with
 * mid-stream handoffs, revisit this — either rebuild the tool on handoff or
 * thread `session.activeAgent` through on every call.
 */

import { tool } from '@openai/agents';
import { z } from 'zod';
import type { Skill, ToolContribution } from '@aks-kickstart/harness';

// ── Narrow tracking context (F2, Leela self-review) ──────────────────────────
//
// A narrow view of the session surface this tool actually mutates. The runner
// casts its `Session` to this when wiring the tool, so we do NOT widen the
// shared `SessionCtx` interface from pack-core. Keeping the fields optional
// lets callers that don't care about skill tracking pass any SessionCtx.
export interface SkillTrackingCtx {
  skillsPulled?: Set<string>;
  skillsPulledBytes?: number;
  skillsPulledTokens?: number;
}

// ── Registry view ────────────────────────────────────────────────────────────

export interface SkillRegistry {
  /** Returns skills for which matchesSkill(agentName, skill) is true. */
  listSkillsForAgent(agentName: string): ReadonlyArray<{ id: string; description: string }>;
  /** Full skill record, including the `instructions` body. */
  getSkill(id: string): Skill | undefined;
}

export interface ReadSkillOptions {
  registry: SkillRegistry;
  agentName: string;
  session: SkillTrackingCtx;
  /** Per-turn byte cap. Defaults to env `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN` or 50 KiB. */
  maxBytesPerTurn?: number;
}

// ── Byte cap ─────────────────────────────────────────────────────────────────

export const DEFAULT_MAX_BYTES_PER_TURN = 50 * 1024;       // 50 KiB
export const MIN_MAX_BYTES_PER_TURN = 1 * 1024;            //  1 KiB
export const MAX_MAX_BYTES_PER_TURN = 1 * 1024 * 1024;     //  1 MiB

/**
 * Zapp L4 — parses `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN` and falls back to
 * the default on any invalid input (NaN, non-finite, non-integer, <= 0). The
 * result is always clamped into `[MIN_MAX_BYTES_PER_TURN, MAX_MAX_BYTES_PER_TURN]`
 * so a malformed env var can never cause unbounded reads.
 */
export function parseByteCapEnv(raw: string | undefined = process.env.KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_MAX_BYTES_PER_TURN;
  const n = Number(raw);
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return DEFAULT_MAX_BYTES_PER_TURN;
  const clamped = Math.min(MAX_MAX_BYTES_PER_TURN, Math.max(MIN_MAX_BYTES_PER_TURN, Math.floor(n)));
  return clamped;
}

// ── Schemas ──────────────────────────────────────────────────────────────────

// Zapp L3: .max(256) on id to bound input size and match the pack registry's
// effective id length in practice. Skill ids are `pack/skill-name` shapes, so
// 256 is generous; the cap is purely defensive against pathological input.
const ReadSkillInputSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(256)
    .describe('Skill id exactly as listed under "## Available Skills" in your system prompt.'),
});

const ReadSkillErrorSchema = z.object({
  ok: z.literal(false),
  error: z.enum(['not_available', 'unknown_skill', 'budget_exhausted']),
  message: z.string(),
});

const ReadSkillSuccessSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
  body: z.string(),
  tokenCount: z.number().int().nonnegative(),
});

export const ReadSkillOutputSchema = z.union([ReadSkillSuccessSchema, ReadSkillErrorSchema]);

export type ReadSkillOutput = z.infer<typeof ReadSkillOutputSchema>;

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the `core.read_skill` tool bound to a skill registry view, an
 * agent name (captured at turn entry), and a session tracking context.
 * Call this per turn inside `Runner.run`.
 *
 * The `execute` callback NEVER throws — every failure path returns a
 * structured `{ ok: false, error, message }` so the model can recover.
 */
export function createReadSkillTool(opts: ReadSkillOptions): ToolContribution {
  const cap = opts.maxBytesPerTurn ?? parseByteCapEnv();

  return {
    name: 'core.read_skill',
    tool: tool({
      name: 'core.read_skill',
      description:
        'Loads the full SKILL.md body for a given skill id from the "## Available Skills" ' +
        'catalog in your system prompt. Returns { ok: true, id, body, tokenCount } on success, ' +
        'or { ok: false, error, message } on failure. Error codes: ' +
        '"not_available" (id is not allowlisted for this agent), ' +
        '"unknown_skill" (id is not registered at all), ' +
        '"budget_exhausted" (per-turn byte cap reached). ' +
        'Returns a structured error rather than throwing — on failure, try a different skill or ' +
        'proceed without it. Repeated reads of the same id within a turn return the cached body ' +
        'without re-charging the byte cap.',
      parameters: ReadSkillInputSchema,
      execute: async (input): Promise<string> => {
        // Nibbler N1 — sequential-read semantics: re-reads of the same id
        // within a turn return the cached body without re-charging bytes.
        // De-dupe is keyed off `session.skillsPulled` so it survives across
        // multiple tool calls in one turn but is reset at turn boundaries.
        if (opts.session.skillsPulled?.has(input.id)) {
          const cached = opts.registry.getSkill(input.id);
          // Allowlist still applies to re-reads — defence-in-depth in case
          // the allowlist was narrowed mid-turn (it currently cannot be,
          // but the check is O(n) over a small list).
          const stillAllowed = opts.registry
            .listSkillsForAgent(opts.agentName)
            .some((s) => s.id === input.id);
          if (cached && stillAllowed) {
            const body = cached.instructions;
            return JSON.stringify({
              ok: true as const,
              id: input.id,
              body,
              tokenCount: Math.ceil(body.length / 4),
            });
          }
          // Fall through to regular error paths if state drifted.
        }

        const allowed = opts.registry
          .listSkillsForAgent(opts.agentName)
          .some((s) => s.id === input.id);
        if (!allowed) {
          return JSON.stringify({
            ok: false as const,
            error: 'not_available' as const,
            message:
              `Skill "${input.id}" is not available to this agent. ` +
              `Check the "## Available Skills" list in your system prompt for valid ids.`,
          });
        }

        const skill = opts.registry.getSkill(input.id);
        if (!skill) {
          return JSON.stringify({
            ok: false as const,
            error: 'unknown_skill' as const,
            message: `No skill is registered with id "${input.id}".`,
          });
        }

        const body = skill.instructions;
        const bytes = Buffer.byteLength(body, 'utf8');
        const used = opts.session.skillsPulledBytes ?? 0;
        if (used + bytes > cap) {
          return JSON.stringify({
            ok: false as const,
            error: 'budget_exhausted' as const,
            message:
              `Per-turn skill-read byte cap (${cap} bytes) would be exceeded by reading ` +
              `"${input.id}" (${bytes} bytes requested, ${used} already used). ` +
              `Consider proceeding without it.`,
          });
        }

        // F3 — inline the trivial token estimator (Math.ceil(len / 4))
        // rather than reverse-depending on the harness estimator.
        const tokenCount = Math.ceil(body.length / 4);

        // Telemetry (D12). Every successful read is recorded on the session
        // so the `end` event's `skillsExecuted` reflects what actually
        // reached the model this turn.
        opts.session.skillsPulled ??= new Set<string>();
        opts.session.skillsPulled.add(input.id);
        opts.session.skillsPulledBytes = used + bytes;
        opts.session.skillsPulledTokens = (opts.session.skillsPulledTokens ?? 0) + tokenCount;

        return JSON.stringify({
          ok: true as const,
          id: input.id,
          body,
          tokenCount,
        });
      },
    }),
  };
}
