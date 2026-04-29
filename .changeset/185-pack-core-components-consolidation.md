---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/web": patch
---

refactor(pack-core): consolidate rich components to ComponentContribution pattern (eliminate 13 web duplicates)

- pack-core components now emit from single source instead of duplicated in web
- new public export: pack-core/client with registerCoreClient() and coreClientComponents array
- eliminates ArchitectureDiagram drift bug (was missing from web entirely)
- web bootstrap now imports core components from pack-core/client via registerPackComponents
- reduces code duplication and maintenance burden; single source of truth for component list
- no bundle size change (static imports tree-shake; Vite code-splitting unchanged)
- pack-core/client exempt from guardrail test (harness-maintained, sanitized dangerouslySetInnerHTML in CodeBlock/Markdown/FileEditor)
