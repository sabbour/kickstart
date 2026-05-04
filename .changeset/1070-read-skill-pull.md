---
"@aks-kickstart/harness": minor
"@aks-kickstart/pack-core": minor
"@sabbour/kickstart-mcp": patch
"@aks-kickstart/api": patch
---

Inert skills D5 — `core.read_skill` pull-based skill loading (#1070).

Skills now reach the LLM on demand. Agents see an id + description catalog
under `## Available Skills (call core.read_skill(id) to load the full body)`
in their system prompt and can pull the full SKILL.md body via a new tool:

- New tool `core.read_skill` (pack-core). Returns a discriminated union:
  `{ ok: true, id, body, tokenCount }` on success, or
  `{ ok: false, error: 'not_available' | 'unknown_skill' | 'budget_exhausted', message }`
  on failure. Never throws.
- Registered universally on every agent by the harness runner (policy
  exception — deliberately bypasses pack `toolAllowlist`). Fail-closed
  allowlist via `matchesSkill`.
- Per-turn byte cap (default 50 KiB; env `KICKSTART_SKILL_READ_MAX_BYTES_PER_TURN`,
  clamped `[1 KiB, 1 MiB]`; falls back to default on invalid input).
- D12 telemetry fix: `end.skillsExecuted` now reflects skill ids actually
  pulled this turn (via `session.skillsPulled`), not naive `appliesTo` matches.
  New `skillsPulledBytes` / `skillsPulledTokens` fields on the `end` event.
- Cross-turn isolation guaranteed by unconditional `try/finally` reset of
  per-turn skill-pull counters in `Runner.run`.

Pack authoring: SKILL.md bodies are now LLM-visible whenever the model reads
them. Do not embed secrets.
