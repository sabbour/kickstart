---
"kickstart": patch
---

Token-leak prevention and governance hardening (#1087).

After the PR #1086 identity-mismatch incident (a Leela agent's `gh pr review`
was posted under the human operator's identity because a bare
`resolve-token.mjs` call leaked the token into chat context), this change
tightens the governance layer end-to-end:

- **`.github/agents/squad.agent.md`** — new Pre-Spawn Token Handling section
  mandating `unset GH_TOKEN GITHUB_TOKEN` + per-ceremony `GH_CONFIG_DIR`
  isolation, the inline `GH_TOKEN="$TOKEN" gh …` one-liner form (never
  `export`), and synchronous post-flight identity check with
  `user.type == "Bot"` verification and dismiss-not-delete review revocation.
- **Charter updates** for Leela, Zapp, Nibbler, Scribe, Fry, Bender, and
  Hermes — each carries a sentinel-wrapped `Token handling (hard boundary)`
  block. CI verifies the sentinels are intact so legitimate charter
  rewording is allowed inside the block.
- **`.squad/scripts/scrub-secrets.mjs`** — three-surface scrubber (response
  capture, pre-stage, tracked tree). Pattern set covers `ghs_`, `ghp_`,
  `gho_`, `ghu_`, `ghr_`, `ghe_`, `github_pat_`, Authorization header
  forms, `x-access-token:` URL form, and PEM private-key block markers
  (RSA / EC / DSA / OPENSSH / ENCRYPTED). Path-level refusal for
  `.squad/identity/keys/*.pem` and `.squad/identity/apps/*.json`.
- **`.squad/scripts/post-flight-check.mjs`** — synchronous blocking identity
  check. Supports review, comment, label, pr-create, issue-edit, and commit
  write kinds; reviews are dismissed (PUT /dismissals) rather than deleted
  per GitHub API semantics.
- **`.squad/identity/README.md`** — operational runbook including the
  rotation-on-leak procedure (rotate the App private key, don't wait for
  GitHub's ephemeral-token scanner).
- **`.github/workflows/squad-secret-scan.yml`** — CI gate that scans the
  tracked tree and PR diff plus verifies charter sentinels. No override.
- **Tests** for scrub-secrets pattern coverage, resolve-token fail-closed
  contract, and post-flight-check arg parsing.

⚠️ **Operator action required after merge:** restart the Copilot CLI
session so the coordinator picks up the new governance rules. The running
coordinator is on stale instructions until then.
