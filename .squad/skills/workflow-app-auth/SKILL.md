---
name: "workflow-app-auth"
description: "Wire GitHub Actions to repo-tracked GitHub App identities without breaking branch-protection bypass flows."
domain: "ci-cd"
confidence: "high"
source: "observed"
---

## Context

Use this when a workflow needs GitHub App auth for checkout, pushes, or API writes and the repo's secret shape does not match the workflow assumptions.

## Patterns

- Treat the GitHub App private key as the secret boundary; verify whether the app id is already tracked in `.squad/identity/config.json` or `.squad/identity/apps/{role}.json`.
- If the app id is stable and recorded in-repo, prefer wiring the workflow to that numeric id instead of depending on a second secret that may not exist.
- Keep commit attribution aligned with the same app id so bot noreply addresses stay consistent.
- Preserve the intended app path for the workflow instead of silently falling back to `GITHUB_TOKEN`.

## Examples

- `.github/workflows/squad-pr-retro.yml`
- `.squad/identity/config.json`
- `.squad/identity/config.json`

## Anti-Patterns

- Assuming `SQUAD_*_APP_ID` exists just because a private-key secret exists.
- Falling back to `github-actions[bot]` for protected-branch writes when the repo already relies on an App bypass actor.
- Renaming secret references in workflows without checking the actual repo secret inventory.
