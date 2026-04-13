# Release Process

**When to use:** You need to cut a release, bump versions, update the changelog, or deploy to production.

## Context

Kickstart is a monorepo with 3 npm workspace packages (`@kickstart/core`, `@kickstart/mcp-server`, `@kickstart/web`) using `@changesets/cli` for coordinated versioning. All packages are linked for lockstep version bumps. Tagged releases trigger production deploys to Azure Static Web Apps.

## Steps

### 1. Create a Changeset

For each meaningful change, create a changeset describing the bump type:
```bash
npm run changeset
```
Select the affected packages and the bump type (patch/minor/major). Changesets are committed as `.md` files in `.changeset/` — reviewable in PRs.

### 2. Version Bump

When ready to release, consume all pending changesets:
```bash
npm run version
```
This bumps versions across all linked packages and updates `CHANGELOG.md`.

### 3. Commit and Tag

```bash
git add -A
git commit -m "chore: release vX.Y.Z"
git tag vX.Y.Z
git push origin main --tags
```

### 4. Deploy

Tag push (`v*`) triggers `.github/workflows/deploy-swa.yml` automatically.

- **Version tags (`v*`):** Production deploy to SWA
- **Manual dispatch (`workflow_dispatch`):** Emergency deploys
- **Main branch:** Pre-prod / staging environment

### 5. CI on PRs

Before any release, CI must pass (`.github/workflows/ci.yml`):
1. Lint (`npm run lint`)
2. TypeScript check (`cd packages/web && npx tsc --noEmit`)
3. Build core, API, web
4. Unit tests (`vitest`)
5. Playwright E2E tests

## Key Rules

- **Release early, release often** — small, frequent releases over big batches
- **Semver levels matter** — use appropriate bump levels (patch for fixes, minor for features, major for breaking changes)
- **All packages version in lockstep** — linked in `.changeset/config.json`
- **No direct pushes to main** — all work goes through PRs
- **Infra/docs deploys** still trigger on push to main (path-scoped, lower risk)

## Who Can Tag Releases

- **Ahmed (human):** Manual releases at any time
- **Ralph (automated):** Can tag releases after N PRs merge (future automation)
