# Squad Identity — Operational Runbook

This directory holds the GitHub App credentials the squad uses for bot-authored
git and GitHub API writes. See issue #1087 for the governance context that made
this runbook mandatory.

## Files and why they never leave the workstation

| Path | Contents | Committed? |
|---|---|---|
| `config.json` | Role → app registration map. | **No** — gitignored. |
| `apps/<role>.json` | Non-secret app metadata (`appId`, `installationId`, `appSlug`). Treated as secret because it reveals the installation and is paired with the PEM. | **No** — gitignored. |
| `keys/<role>.pem` | GitHub App RSA private key. The primary long-lived secret — installation tokens are derived from this. Has no expiry. | **No** — gitignored. |
| `README.md` (this file) | Operational runbook. | **Yes**. |
| `now.md` / `wisdom.md` | Shared team context, no secrets. | **Yes**. |

The `.gitignore` entries live at the repo root:

```
.squad/identity/keys/
.squad/identity/apps/
.squad/identity/config.json
```

The secret-scan job (`.squad/scripts/scrub-secrets.mjs`) additionally refuses
any commit that tries to stage a matching path, regardless of content.

## The three-surface scrub (Zapp C2)

Agent output that ever contains a `ghs_`, `ghp_`, `gho_`, `ghu_`, `ghr_`,
`ghe_`, `github_pat_`, `Authorization: Bearer …`, `x-access-token:…`, or
`-----BEGIN … PRIVATE KEY-----` substring is filtered at three surfaces:

1. **Response capture** — coordinator runs `scrub-secrets.mjs --response`
   over the agent's streamed output before surfacing or writing to
   `events.jsonl`. Redacts matches to `[REDACTED:<kind>]`.
2. **Pre-stage** — Scribe runs `scrub-secrets.mjs --staged` before any
   `git commit`. Non-zero exit blocks the commit.
3. **Pre-commit / CI** — `.github/workflows/squad-secret-scan.yml` runs
   `scrub-secrets.mjs --tree` plus a diff grep on every PR. A match blocks
   merge — no override path.

## Token handling via squad-identity

This repo uses [`squad-identity`](https://github.com/sabbour/squad-identity) for bot-authored GitHub writes. **Do not use the resolve-token.mjs pattern** — it is deprecated.

Instead, agents receive `ROLE_SLUG` in their charter (injected by `squad-identity setup`). The squad-identity extension provides authenticated `gh` with the right bot identity:

```bash
# From within an agent charter, ROLE_SLUG is provided:
gh pr create --draft --title "..." --body "..."
# ↑ Automatically uses the bot token for that role (via extension auth hook)

# If you need explicit token control (rare):
BEARER_TOKEN=$(squad-identity token --role "$ROLE_SLUG") || exit 1
GH_TOKEN="$BEARER_TOKEN" gh pr create ...
```

**Never:**
- Echo or log tokens
- Export `GH_TOKEN` — use inline: `GH_TOKEN="$TOKEN" gh ...`
- Use `GH_CONFIG_DIR` isolation (deprecated — squad-identity uses OS keychain)
- Fall back to personal auth (`gh` without GH_TOKEN)

## Rotation-on-leak runbook (Zapp C10)

If a token ever reaches a commit, a PR body, an issue comment, chat output,
a log file, or `events.jsonl`:

1. **Rotate the GitHub App private key immediately.** Ephemeral token
   revocation by GitHub's scanner is a safety net, not the primary control.
   The App private key has no expiry — if it leaked, installation tokens can
   be minted from it indefinitely.
   - Go to `https://github.com/organizations/<org>/settings/apps/<app-slug>`.
   - **Generate a new private key.** Download it.
   - **Delete the old private key.** Confirm.
   - Replace `.squad/identity/keys/<role>.pem` on the workstation with the
     new file. Verify permissions: `chmod 600`.

2. **If the secret reached a git blob:**
   - Force-remove the blob from the offending branch before push. Default
     (`main`) branch history rewrite is prohibited — open a P1 retro instead
     and let the token expire.
   - On a non-default branch: `git rebase -i` → drop or amend the offending
     commit, then `git push --force-with-lease` on that branch only.

3. **File a retro** in `.squad/decisions/inbox/<role>-token-leak-<date>.md`
   capturing root cause, the scrub surface that should have caught it, and
   the fix.

4. **Run the CI secret scan manually against HEAD + last 30 commits** to
   confirm no lingering matches:
   ```bash
   node .squad/scripts/scrub-secrets.mjs --tree
   ```

5. **Post-flight verify** the next bot-authored write succeeds as
   `sabbour-squad-<role>[bot]` with `user.type == "Bot"`:
   ```bash
   GH_TOKEN="$TOKEN" node .squad/scripts/post-flight-check.mjs \
     --kind comment --owner sabbour --repo kickstart \
     --issue <N> --id <COMMENT_ID> \
     --expected-login sabbour-squad-<role>[bot]
   ```

## Deprecated: resolve-token.mjs (use squad-identity instead)

Prior to `squad-identity`, agents used `.squad/scripts/resolve-token.mjs` to mint ephemeral tokens:

```bash
# Deprecated — do not use
TOKEN=$(node .squad/scripts/resolve-token.mjs --required <role>) || exit 1
GH_TOKEN="$TOKEN" gh pr create ...
```

**This pattern is now obsolete.** The `resolve-token.mjs` file may still exist in worktrees or git history, but should not be referenced in new code or agent charters. Use `squad-identity` instead (see "Token handling via squad-identity" above).

At the time of this runbook's introduction, `.squad/identity/keys/*.pem` and
`.squad/identity/apps/*.json` were already tracked in `HEAD` despite being
listed in `.gitignore` (gitignore does not untrack already-committed files).

**Round 2 of PR #1091 resolves the tree side of this legacy state:**

- The 4 `.pem` files and 4 `.json` files are now `git rm --cached`'d in this
  PR so the tree-scan surface no longer has to special-case them.
- `runTree()` now hard-fails on any tracked forbidden path (no more
  silent skip), which is why the `git rm --cached` is required in the same
  commit as the CI gate.
- The keys remain in git **history** (since v0.5.5, commit `c222ac78`). An
  actual key rotation on the GitHub App side is a separate P1 tracked in a
  follow-up issue — linked from this PR's description.
- Until that rotation lands, the leaked material in history must be treated
  as compromised. New App private keys will be provisioned and installed
  locally via this runbook's `Adding a new role` flow.

## Known incidents

- **2026-04-22 / #1086 / #1087** — A Leela spawn ran `node resolve-token.mjs
  --required lead` as a bare bash command; the token leaked into chat context
  and the subsequent `gh pr review` fell back to the human operator's
  `~/.config/gh/hosts.yml`. The same token was later re-surfaced in issue
  #1087's original body as "evidence." GitHub's secret scanner auto-revoked
  within minutes. See `.squad/decisions.md` for the full Leela / Zapp /
  Nibbler DPs that led to this runbook.
