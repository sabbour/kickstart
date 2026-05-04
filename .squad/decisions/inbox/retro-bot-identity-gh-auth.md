# DP: Harden bot identity documentation and make GH_TOKEN-inline the canonical pattern

**Status**: Draft — awaiting @asabbour_microsoft review
**Proposed by**: Leela (squad-lead)
**Category**: process

## Problem

During Phase 2 and Phase 3, `gh auth` keyring state intermittently broke for one or more agent sessions. The symptom was silent: `gh pr create` or `gh issue edit` would fail with a 401 without a clear error, or would succeed but write under the wrong identity (human token instead of bot token). The root cause is that `gh auth login` stores credentials in the system keyring, which is per-user and per-machine — it is not portable across agent sessions and can be invalidated by OS keyring rotation or concurrent `gh auth` calls from other processes.

The correct pattern — `GH_TOKEN="$TOKEN" gh ...` per call — is documented in `.squad/skills/squad-identity/SKILL.md` and in `pr-workflow.md`, but agents occasionally defaulted to ambient `gh auth` either because they did not read the skill before starting or because the skill's wording ("Normal agent writes do not use ambient `gh` auth") was not prominent enough to catch in a fast scan.

Two specific gaps observed:
1. **Missing in charter headers**: Only Kif's charter mentions GitHub App identity explicitly. Other charters (Bender, Fry, Hermes) do not have a prominent "Auth" reminder at the top.
2. **No fast-fail guard**: There is no CI or pre-push check that would catch a bot commit authored under a human identity. A commit slipping in under the wrong author is a governance gap.

## Proposal

1. **Add an "Auth" callout to every agent charter** (Bender, Fry, Hermes, Amy, Nibbler, Zapp, Scribe, Ralph) that reads:

   > **GitHub writes:** Always use `GH_TOKEN="$(squad_identity_resolve_token)"` per call. Never rely on ambient `gh auth`. See `.squad/skills/squad-identity/SKILL.md`.

   This is a one-line addition to each charter's "How I Work" section. Kif's charter already has this; the others need it.

2. **Add a smoke-check to `squad-identity doctor`** that detects if the ambient `gh auth status` token owner differs from the expected bot identity, and warns with a clear message. This is a diagnostic only — it does not block.

3. **Document the keyring failure mode** in `SKILL.md` under a new "Troubleshooting" section: "If `gh` commands fail silently or authenticate as the wrong user, the system keyring may have stale state. Do not run `gh auth login` to fix this. Use `GH_TOKEN=` inline instead — it bypasses the keyring entirely."

4. **Update the charter injection command** (`.squad/skills/squad-identity/SKILL.md`) to include the one-liner above in its template, so new agents added via `squad_identity_update_charters` get it automatically.

## Impact

- **All agents** — charter additions are documentation only.
- **Kif** — owns `squad_identity_doctor` extension; would implement the smoke-check.
- **No code or CI changes** in this phase; the smoke-check is a future Kif task.

## Alternatives considered

- **Enforce bot identity via commit-msg hook**: A pre-receive hook on GitHub that rejects commits not authored by a bot account. Too strict — some human commits are legitimate (e.g., hotfixes). Also requires Kif to implement, which is a separate tracked issue.
- **Store GH_TOKEN in a `.env.agent` file**: Introduces secrets-on-disk risk. Rejected.
- **Require `squad_identity_resolve_token` call at session start**: Already the documented pattern; the problem is agents skipping it. Better documentation is the fix.
