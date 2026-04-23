# Docs & Changelog Contract

**When to use:** you are opening, reviewing, or merging a PR. This is a pre-merge gate.

## Context

Kickstart treats documentation and changelogs as shipping artifacts, not afterthoughts. Every PR answers three questions before it can merge:

1. What did a user gain or lose?
2. Where is it documented?
3. What version will ship it?

If any answer is missing, the PR is not ready.

## Steps

### 1. Classify the change

| Class | Example | Required artifacts |
|-------|---------|--------------------|
| **User-facing** | new component, new pack, new SSE event, new env var, UX change | changeset + public docs update |
| **Architectural** | new primitive, harness contract change, pack boundary shift | changeset + public docs update + brief update |
| **Internal only** | refactor, test-only, dev tooling | no changeset required, but add a note to the PR body |
| **Docs-only** | fixes to `docs-site/` (and the legacy `docs/README.md` redirect) | no changeset |

### 2. Public docs update (`docs-site/docs/`)

Pick the right folder:

- `getting-started/` — setup, local run, deploy
- `architecture/` — harness, packs, SDK runtime, A2UI streaming
- `components/` — A2UI catalog, authoring custom components
- `extending/` — how to add packs, skills, tools, user actions, agents
- `contributing.md` — workflow and conventions

Rules:
- One Markdown file per topic. Do not mega-merge unrelated pages.
- Link to source files using relative paths and 1-based line numbers.
- Code samples must be copy-pasteable and reference the actual repo layout.
- Use KaTeX for math. Do not use emoji in headings.

### 3. Brief update (`docs-site/docs/architecture/v2-implementation-brief.md`)

Update the brief when a PR changes any of:

- Architecture layering (harness vs pack boundaries)
- Primitive surface (Pack, Agent, Skill, Tool, UserAction, Component, Guardrail)
- A2UI streaming contract (`core.emit_ui` schema, SSE event types)
- SDK integration (Runner, interrupt/resume)
- Pack registration or sealing
- Playground contract

Bump the `Last updated` line at the top of the brief. Do not rewrite history. Add a dated amendment section.

### 4. Changeset

For every user-facing or architectural change:

```bash
npm run changeset
```

- Select affected packages (usually all of them, since they are linked).
- Pick the bump type: `patch` for fixes, `minor` for new behaviour, `major` for breaking changes.
- The changeset body is what the user sees in `CHANGELOG.md`. Write it in the user's voice, not the implementer's. One line is good. Three lines is fine. Twenty lines is wrong.

Good changeset:
> Azure pack now emits a `provisioning-progress` component while resources deploy, so users see real-time status instead of a spinner.

Bad changeset:
> Refactored `azure-kit.ts` to add a new streaming hook and wired it through `useStreaming.ts`.

### 5. API reference (`docs-site/docs/extending/api-endpoints.md`)

Update for any change to:
- HTTP endpoint shape (path, request body, response body, status codes)
- SSE event type or payload schema
- Public SDK tool schema exposed by a pack
- Environment variable (name, default, required/optional)

### 6. Pack docs (`docs-site/docs/extending/`)

When adding a new pack or changing an existing one's surface, update the matching page. Each pack page lists:

- Pack ID and version
- Agents registered by the pack
- Skills registered by the pack
- Tools registered by the pack (with sigil: `pack.tool`)
- User actions (sigil: `pack:action`)
- Components (sigil: `pack/component`)
- Guardrails
- Pack dependencies

### 7. Release notes (Scribe curates)

On release PRs:

- Scribe pulls all changesets and groups them by user impact: Added / Changed / Fixed / Removed / Security.
- Cross-link each line to the PR number.
- Highlight any breaking changes at the top with a migration note.
- Match the category taxonomy to `CHANGELOG.md` formatting.

## Pre-merge checklist

Paste into the PR description:

```md
- [ ] Changeset added (or marked internal-only with reason)
- [ ] `docs-site/docs/` updated (or N/A)
- [ ] `docs-site/docs/architecture/v2-implementation-brief.md` updated (or N/A)
- [ ] `docs-site/docs/extending/api-endpoints.md` updated (or N/A)
- [ ] Pack docs updated (or N/A)
- [ ] Tests added or existing tests cover the change
```

A PR without these is not ready. Leela and the PR author both verify.
