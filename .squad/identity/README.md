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

## Token handling (hard boundary — mirrors squad.agent.md §Pre-Spawn)

```bash
# Correct — one-liner, token scoped to the single gh invocation:
TOKEN=$(node .squad/scripts/resolve-token.mjs --required <role>) || exit 1
[ -n "$TOKEN" ] || exit 1
GH_TOKEN="$TOKEN" gh pr create ...

# Forbidden — any of these is a P1 governance failure:
node .squad/scripts/resolve-token.mjs --required <role>      # bare invocation, leaks to chat
echo "$TOKEN"                                                # echo to log / stdout
export GH_TOKEN; gh pr create ...                            # token persists in env
gh pr create ...                                             # no GH_TOKEN — falls back to hosts.yml
```

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

## Known legacy state (pre-#1087)

At the time of this runbook's introduction, `.squad/identity/keys/*.pem` and
`.squad/identity/apps/*.json` are already tracked in `HEAD` despite being
listed in `.gitignore` (gitignore does not untrack already-committed files).
The tree-scan surface skips these paths to avoid blocking every PR; the
staged surface still refuses any **new** add of these paths. Migrating out
of this legacy state requires coordinated key rotation on the GitHub App
side and is tracked as a follow-up — do not `git rm --cached` these files
in a routine PR without rotating the underlying app keys first.

## Known incidents

- **2026-04-22 / #1086 / #1087** — A Leela spawn ran `node resolve-token.mjs
  --required lead` as a bare bash command; the token leaked into chat context
  and the subsequent `gh pr review` fell back to the human operator's
  `~/.config/gh/hosts.yml`. The same token was later re-surfaced in issue
  #1087's original body as "evidence." GitHub's secret scanner auto-revoked
  within minutes. See `.squad/decisions.md` for the full Leela / Zapp /
  Nibbler DPs that led to this runbook.
