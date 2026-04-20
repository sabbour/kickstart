# Role-specific GitHub App identity uses the checked-in resolver script

**Date:** 2026-04-20  
**Author:** Bender (Backend Dev)  
**Status:** Proposed

**Decision:** Squad agent prompts and lifecycle docs should resolve GitHub App tokens via `.squad/scripts/resolve-token.mjs`. The resolver owns explicit role-to-app mapping, supports explicit persona aliases, and write actions fail closed unless `SQUAD_ALLOW_WRITE_FALLBACK=1` is intentionally set as an escape hatch.

**Rationale:** The repository ships the checked-in resolver script and identity config in `.squad/identity/`, but worktrees do not reliably contain a built `packages/squad-sdk/dist/identity/tokens.js` artifact. Calling the checked-in script removes that drift, and refusing silent ambient-auth fallback keeps commits, pushes, issue comments, and PR creation aligned to the spawned agent's intended bot identity.

**Consequences:**
- New bot personas must be registered in `.squad/identity/config.json`/`.squad/identity/apps/` and, when needed, added to the resolver alias map.
- Unmapped roles now resolve to no token instead of guessing another app identity.
- Ambient `git`/`gh` writes require explicit `SQUAD_ALLOW_WRITE_FALLBACK=1`; the default is fail-closed.
- PR bodies should continue to include `🤖 Created by [{app_slug}](https://github.com/apps/{app_slug})`.
