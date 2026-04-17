---
sidebar_position: 1
---

# Docs Freshness Sweep

> Every edge case is a regulation waiting to be enforced — including stale documentation.

This process defines **when to sweep**, **what to check**, and **who owns what** so docs never quietly rot.

---

## Staleness Indicators

| Indicator | Meaning |
|-----------|---------|
| 🔴 **Confirmed stale** | Known to contradict the codebase. Must be fixed before the next release. |
| 🟠 **Likely stale** | Code or architecture changed in an area this doc covers. Needs review. |
| 🟢 **Fresh** | Verified against the current codebase within the last release cycle. |

When you find a 🔴 or 🟠 page during a sweep, open a GitHub issue with label `documentation` + `priority:important` and tag the area owner.

---

## Trigger 1 — Release-triggered sweep

Run this checklist before cutting any release (see [RELEASING.md](../../RELEASING.md)):

### Architecture docs

- [ ] `docs-site/docs/architecture/overview.md` — monorepo structure still accurate?
- [ ] `docs-site/docs/architecture/prompt-pipeline.md` — skill injection mechanisms still correct?
- [ ] `docs-site/docs/architecture/json-envelope.md` — envelope shape matches `converse.ts`?
- [ ] `docs-site/docs/architecture/a2ui-integration.md` — component catalog size matches assertions?
- [ ] `docs-site/docs/architecture/skill-injection.md` — mechanisms A and B still exist?

### Engineering docs

- [ ] `docs-site/docs/engineering/api-layer.md` — endpoint list matches actual Functions?
- [ ] `docs-site/docs/engineering/frontend-context-map.md` — context providers and state accurate?
- [ ] `docs-site/docs/engineering/configuration-reference.md` — all env vars documented?

### Security-relevant docs (mandatory — Zapp scope)

- [ ] Auth model — MSAL config, token flow, SWA auth still matches implementation
- [ ] API boundaries — which routes are authenticated vs public
- [ ] Connector model — client-side vs proxy execution documented correctly
- [ ] Debug gate — debug endpoints, feature flags, and their guards documented

### ADRs

- [ ] Does any merged PR since the last release introduce a decision not recorded in `docs-site/docs/adrs/`?
- [ ] Are all pending ADRs in `docs-site/docs/adrs/` still marked with correct status?

### Getting started / contributing

- [ ] `CONTRIBUTING.md` — setup instructions still work end-to-end?
- [ ] `docs-site/docs/getting-started/` — deployment guide matches current infra?

---

## Trigger 2 — PR-triggered sweep

When a PR touches certain source paths, the corresponding docs **must** be reviewed before merge.

| Source path changed | Docs to review |
|---------------------|---------------|
| `packages/web/api/src/**` | `api-layer.md`, `json-envelope.md`, security auth/connector docs |
| `packages/web/src/**` | `frontend-context-map.md`, `a2ui-integration.md` |
| `packages/core/src/engine/**` | `architecture/overview.md`, `prompt-pipeline.md`, `skill-injection.md` |
| `packages/core/src/prompts/**` | `prompt-pipeline.md`, `json-envelope.md` |
| `packages/core/src/kits/**` | `skill-injection.md`, `a2ui-integration.md` |
| `infra/**` | `getting-started/deployment.md`, `configuration-reference.md` |
| `.github/workflows/**` | `ops/ci-overview.md` (if it exists) |

If you're unsure whether your change requires a docs update, apply the `needs-docs` label to the PR. The CI check (`docs-freshness.yml`) will also remind you automatically.

---

## CI Enforcement

The workflow `.github/workflows/docs-freshness.yml` runs on every PR that touches `packages/web/api/src/`, `packages/web/src/`, or `packages/core/src/`. It posts a reminder listing the docs that are likely affected.

**The `needs-docs` label is mandatory (not optional)** on any PR that makes a user-visible or API-contract change. Reviewers must verify the label is either applied and resolved, or explicitly waived with a comment explaining why no docs update is needed.

Label: [`needs-docs`](https://github.com/sabbour/kickstart/labels/needs-docs) — color `#0075ca`

---

## Per-area owners

| Area | Owner | Docs path |
|------|-------|-----------|
| Conversation engine / phases | Leela (Lead) | `architecture/` |
| Prompt pipeline / skill injection | Leela (Lead) | `architecture/prompt-pipeline.md`, `architecture/skill-injection.md` |
| API layer / Azure Functions | Bender (Backend) | `engineering/api-layer.md` |
| Frontend / A2UI | Fry (Frontend) | `engineering/frontend-context-map.md`, `architecture/a2ui-integration.md` |
| Security: auth, connectors, debug gate | Zapp (Security) | Security-relevant docs (see checklist above) |
| Tests / CI | Hermes (Tester) | `engineering/` + this process doc |
| ADRs | Scribe (Session Logger) | `docs-site/docs/adrs/` |
| Infrastructure / deployment | Bender (Backend) | `getting-started/deployment.md` |

---

## Archiving stale docs

When a feature is removed:

1. Replace the page body with a short archived stub (see `architecture/fsm.md` as a reference).
2. Keep the file at its original path so existing links don't 404.
3. Add a `:::caution This page is archived` admonition at the top.
4. Link to the current replacement doc.
5. Record the removal in `.squad/decisions/inbox/hermes-archive-{slug}.md`.
