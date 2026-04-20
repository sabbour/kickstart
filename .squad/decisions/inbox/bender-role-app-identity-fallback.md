# Role-specific GitHub App identity uses the checked-in resolver script

**Date:** 2026-04-20  
**Author:** Bender (Backend Dev)  
**Status:** Proposed

**Decision:** Squad agent prompts and lifecycle docs should resolve GitHub App tokens via `.squad/scripts/resolve-token.mjs`. The resolver owns role-to-app mapping, supports persona aliases, prefers the configured per-role app, and falls back to the lead app or default auth when identity resolution fails.

**Rationale:** The repository ships the checked-in resolver script and identity config in `.squad/identity/`, but worktrees do not reliably contain a built `packages/squad-sdk/dist/identity/tokens.js` artifact. Calling the checked-in script removes that drift and keeps commits, pushes, issue comments, and PR creation aligned to the spawned agent's bot identity.

**Consequences:**
- New bot personas must be registered in `.squad/identity/config.json`/`.squad/identity/apps/` and, when needed, added to the resolver alias map.
- Identity failures degrade gracefully to existing `git`/`gh` auth instead of blocking work.
- PR bodies should continue to include `🤖 Created by [{app_slug}](https://github.com/apps/{app_slug})`.
