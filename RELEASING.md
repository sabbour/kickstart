# Releasing Kickstart

This project uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation across the monorepo.

## Documentation Entry Points

Before cutting a release, make sure these entry points agree:

- `README.md`
- `CHANGELOG.md`
- `docs-site/docs/` (canonical docs site — start at `intro.md` and `architecture/overview.md`)

If you fix an old `docs/*` link during release prep, update the source link or `docs/README.md` redirect map instead of recreating legacy stubs.

## How It Works

1. **Contributors add changesets** alongside their code changes
2. **Changesets accumulate** on `main` as PRs are merged
3. **Maintainer runs `changeset version`** to bump versions and collate changelogs
4. **A tagged release** triggers the deploy workflow to production

## Adding a Changeset

Every PR that changes user-facing behavior (features, fixes, breaking changes) should include a changeset.

### Interactive (recommended)

```bash
npx changeset
```

Follow the prompts to select affected packages and bump type.

### Manual

Create a markdown file in `.changeset/` with a random name (e.g., `.changeset/cool-lions-dance.md`):

```markdown
---
"@aks-kickstart/harness": minor
"@aks-kickstart/web": minor
---

Add new deployment progress tracking to the conversation engine.
```

**Bump types:**
| Type | When |
|------|------|
| `patch` | Bug fixes, typos, dependency updates |
| `minor` | New features, enhancements |
| `major` | Breaking API changes (rare — discuss with team first) |

### What Doesn't Need a Changeset

- Documentation-only changes (`docs/`, `*.md`)
- CI/workflow changes (`.github/`)
- Dev tooling changes (eslint config, tsconfig)
- Squad framework changes (`.squad/`)
- Infrastructure changes (`infra/`)

## Linked Packages

The three workspace packages are **linked** in `.changeset/config.json`:

```json
"linked": [["@aks-kickstart/harness", "@aks-kickstart/mcp-server", "@aks-kickstart/web"]]
```

This means when any linked package gets a version bump, all linked packages get at least the same bump level. This keeps versions in sync across the monorepo.

## CI Validation

The CI workflow runs `npx changeset status` on pull requests. This warns (but does not block) if a PR is missing a changeset. Not every PR needs one — see "What Doesn't Need a Changeset" above.

## Cutting a Release

Releases are tied to milestones (e.g., `v0.2.0`, `v0.3.0`).

### Step-by-step

```bash
# 1. Make sure you're on main with all changesets merged
git checkout main && git pull

# 2. Consume changesets — bumps versions in package.json and updates CHANGELOG.md
npx changeset version

# 3. Review the changes
git diff

# 4. Commit the version bump
git add -A
git commit -m "chore: version packages for vX.Y.Z"

# 5. Tag the release
git tag vX.Y.Z

# 6. Push commit and tag
git push && git push --tags
```

### What Happens on Tag Push

The `deploy-swa.yml` workflow triggers on `v*` tags and deploys to Azure Static Web Apps production. See `.github/workflows/deploy-swa.yml`.

### Release Checklist

- [ ] All milestone PRs are merged to `main`
- [ ] CI passes on `main`
- [ ] Run `npx changeset version` — review version bumps and changelog
- [ ] Commit, tag, push
- [ ] Verify deployment succeeds
- [ ] Close the milestone on GitHub

## For Squad Agents

When creating PRs that include user-facing changes, agents should add a changeset file manually:

```bash
cat > .changeset/$(date +%s)-description.md << 'EOF'
---
"@aks-kickstart/harness": patch
---

Fix conversation engine phase transition edge case.
EOF
```

Use descriptive filenames and accurate bump types. When in doubt, use `patch`.
