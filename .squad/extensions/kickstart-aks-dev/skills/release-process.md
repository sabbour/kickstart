# Release Process

**When to use:** you are reviewing the daily release PR, publishing release notes, or troubleshooting the cadence workflow.

## Context

Kickstart is a monorepo with linked packages (`@kickstart/harness`, `@kickstart/pack-core`, `@kickstart/pack-azure`, `@kickstart/pack-aks-automatic`, `@kickstart/pack-github`, `@kickstart/web`, `@kickstart/mcp-server`) versioned in lockstep via `@changesets/cli`.

- **Pre-prod SWA** is the runtime surface. It deploys from `main` on every merge.
- **Tags (`v*`)** mark versioned releases and cut GitHub Release notes. They do not trigger a separate production deploy today.
- **Cadence is automated.** `.github/workflows/squad-release-cadence.yml` runs every day at 17:00 Pacific, checks for pending changesets, and opens a draft Release PR if any exist. Nobody asks Ralph to "run the release." The workflow does it.

## Ownership

- **Leela (Lead)** is the author-of-record on the daily Release PR. Review for scope and correctness.
- **Scribe** curates the GitHub Release notes. When the cadence workflow opens the PR, it comments `@copilot — work as Scribe` so @copilot adopts the Scribe persona for note curation.
- **Hermes** validates via CI + Playwright + pack conformance. No manual test-run ceremony is required; CI is the gate.
- **Zapp** reviews any release that touches auth, secrets, CORS, ARM proxy, or SDK tool schemas.
- **Ralph** nags if CI expires on an open Release PR.

## Steps (Leela's review, not a manual release ritual)

### 1. Confirm the cadence workflow opened the PR

Branch: `release/cadence`. Label: `squad:leela` + `release`. Body starts with `Working as Leela (Lead)`.

If no PR opened and you expected one, check `.github/workflows/squad-release-cadence.yml` run history. The workflow skips quietly when there are no pending changesets.

### 2. Review the version bump

Verify:
- `npm run version` consumed all pending changesets from `.changeset/`.
- Every package bumped in lockstep.
- `CHANGELOG.md` entries match the changeset bodies.

### 3. Confirm Scribe's release notes

Scribe (via @copilot persona on this PR) posts the curated notes as a comment:
- Grouped **Added / Changed / Fixed / Removed / Security**
- Breaking changes called out at the top with a migration note
- Each bullet links to its PR

Request revisions if the grouping is off or a breaking change is missed.

### 4. Merge

Merge to `main`. Main is pre-prod. The usual `.github/workflows/deploy-swa.yml` picks up the merge.

### 5. Tag and publish release notes

After merge:

```bash
git checkout main && git pull
VERSION=$(node -e "console.log(require('./package.json').version)")
git tag "v${VERSION}"
git push origin "v${VERSION}"
gh release create "v${VERSION}" --notes-file <(gh pr view <RELEASE_PR> --json comments --jq '.comments[-1].body')
```

The tag is a marker. No separate production deploy runs today.

### 6. Announce (optional)

Open a Discussion under **Announcements** only when the release changes the top-line pitch or introduces a breaking change. Silent weeks are fine.

## Bump semantics

| Change | Bump |
|--------|------|
| Bug fix, internal refactor that affects user behaviour | patch |
| New pack, new component, new agent, new tool | minor |
| Renamed or removed primitive, SSE event shape change, tool schema narrowing | major |

## Rules

- **All packages version in lockstep.** Linked in `.changeset/config.json`.
- **No direct pushes to main.** Release PRs go through review.
- **Main = pre-prod SWA.** Every merge deploys. Tags mark versioned releases but do not cut a separate production deploy today.
- **Infra + docs** deploy on push to main, path-scoped (`.github/workflows/deploy-infra.yml`, `.github/workflows/deploy-docs.yml`).
- **Release early, release often.** Small, frequent releases over big batches.

## Failure modes

- **Cadence workflow didn't run:** check `.github/workflows/squad-release-cadence.yml` run history. Dispatch manually via `workflow_dispatch` if a scheduled run was missed.
- **Release PR already open and stale:** rebase it. The workflow is idempotent and won't open a duplicate.
- **Changeset missed on a merged PR:** open a follow-up PR that adds a changeset describing the historical impact. The next cadence run picks it up.
- **CHANGELOG drift:** regenerate with `npm run version`. Do not hand-edit.
- **Tag pushed by mistake:** delete the tag locally and remotely (`git push --delete origin vX.Y.Z`), then re-tag the correct commit. Never force-update an existing tag that's already in a published release.
