# Repo-internal docs directory

Kickstart uses [`docs-site/docs/`](../docs-site/docs/) as the single source of
truth for **user-facing and engineering documentation**. The `docs/` directory
exists for content that is intentionally **not published**: ADRs, contributor
process docs, and a small architecture archive that has not yet been promoted
to the published site.

## What lives here

- [`adrs/`](./adrs/) — repo-internal Architecture Decision Records ledger,
  with [template](./adrs/template.md). ADRs were removed from the published
  docs site; this is where new ones live.
- [`CONTRIBUTING-COPILOT.md`](./CONTRIBUTING-COPILOT.md) — contributor process
  for working alongside the Copilot squad.

The previous `architecture/` archive was lifted into the published site
([component selection](../docs-site/docs/architecture/component-selection-framework.md),
[requirement gathering](../docs-site/docs/architecture/requirement-gathering-methodology.md),
[tool usage](../docs-site/docs/architecture/tool-usage-framework.md)). Add new
architecture material directly under `docs-site/docs/architecture/`.

## Common destinations on the published site

- [Architecture overview](../docs-site/docs/architecture/overview.md)
- [MCP server internals](../docs-site/docs/architecture/mcp-server-internals.md)
- [Agent coordination](../docs-site/docs/architecture/agent-coordination.md)
- [API endpoints](../docs-site/docs/extending/api-endpoints.md)
- [Extension guide](../docs-site/docs/extending/overview.md)
- [Packs](../docs-site/docs/extending/packs.md)
- [Safeguards](../docs-site/docs/extending/safeguards.md)
- [Browser telemetry](../docs-site/docs/operations/browser-telemetry.md)
- [A2UI component authoring](../docs-site/docs/components/extending-a2ui.md)
- [Local setup](../docs-site/docs/getting-started/local-setup.md)
- [Deployment](../docs-site/docs/getting-started/deployment.md)

## Recent path changes (published site)

The 2026 docs restructure renamed and removed several pages. Old paths
redirect automatically via `@docusaurus/plugin-client-redirects`.

| Old path                                                       | New path                                                   |
|----------------------------------------------------------------|------------------------------------------------------------|
| `architecture/decisions/ADR-*`                                 | _(removed; ledger relocated to [`docs/adrs/`](./adrs/))_   |
| `architecture/v2-implementation-brief.md`                      | `operations/browser-telemetry.md`                          |
| `extending/integration-kits.md`                                | `extending/packs.md`                                       |
| `architecture/agent-coordination-decisions.md`                 | `architecture/agent-coordination.md`                       |

## Legacy path map (pre-restructure)

| Legacy path under `docs/`               | Published location                                                                                       |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------|
| `architecture.md`                       | [`docs-site/docs/architecture/overview.md`](../docs-site/docs/architecture/overview.md)                  |
| `prompt-architecture.md`                | [`docs-site/docs/architecture/prompt-pipeline.md`](../docs-site/docs/architecture/prompt-pipeline.md)    |
| `a2ui-catalog.md`                       | [`docs-site/docs/architecture/a2ui-integration.md`](../docs-site/docs/architecture/a2ui-integration.md)  |
| `extending.md`                          | [`docs-site/docs/extending/overview.md`](../docs-site/docs/extending/overview.md)                        |
| `api-reference.md`                      | [`docs-site/docs/extending/api-endpoints.md`](../docs-site/docs/extending/api-endpoints.md)              |
| `integration-kits.md`                   | [`docs-site/docs/extending/packs.md`](../docs-site/docs/extending/packs.md)                              |
| `mcp-server.md`                         | [`docs-site/docs/extending/mcp-tools.md`](../docs-site/docs/extending/mcp-tools.md)                      |
| `extending-components.md`               | [`docs-site/docs/components/extending-a2ui.md`](../docs-site/docs/components/extending-a2ui.md)          |
| `deployment.md`                         | [`docs-site/docs/getting-started/deployment.md`](../docs-site/docs/getting-started/deployment.md)        |
| `development.md`                        | [`docs-site/docs/getting-started/local-setup.md`](../docs-site/docs/getting-started/local-setup.md)      |
| `v2-implementation-brief.md`            | [`docs-site/docs/operations/browser-telemetry.md`](../docs-site/docs/operations/browser-telemetry.md)    |
| `agent-coordination-decisions.md` (under `architecture/`) | [`docs-site/docs/architecture/agent-coordination.md`](../docs-site/docs/architecture/agent-coordination.md) |
