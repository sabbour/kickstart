# Fix ceremony workflow auth + release drift

- **Context:** `squad-pr-retro.yml` and `squad-release-cadence.yml` started failing after they drifted away from the documented ceremony auth and release flow.
- **Root causes:**
  1. `squad-pr-retro.yml` tried to commit directly to `main`, which repository rules now reject without the required checks. The workflow also used the default Actions token, so any bot-created follow-up PR would not reliably trigger downstream PR workflows.
  2. `squad-release-cadence.yml` drifted to `npm run version`, but the repo only exposes `npm run changeset:version`. The workflow also stopped using the Squad lead GitHub App token for branch push / PR creation, so release PR automation no longer matched the documented ceremony path.
- **Decision:** restore GitHub App auth for both workflows, have retro write through a `retro-log/pr-*` side branch + PR instead of pushing straight to `main`, and switch release cadence back to `npm run changeset:version`.
- **Why it matters:** ceremony workflows need to create branches/PRs in a way that triggers the normal repository checks, while release automation must keep using the actual Changesets command exposed by the repo.
