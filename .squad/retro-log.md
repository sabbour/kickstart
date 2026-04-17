# Squad Retro Log

Append-only record of every merged or closed PR. One line per entry. Owned by Scribe (via `.github/workflows/squad-pr-retro.yml`). Do not hand-edit.

Format:
```
- YYYY-MM-DD | #NNN "title" | size | impl=XXm | review=XXm | cycles=N | outcome | author
```

Legend:
- **size** — S / M / L / XL based on lines changed (S ≤50, M ≤250, L ≤1000, XL >1000)
- **impl** — time from branch first-commit to PR opened
- **review** — time from PR ready-for-review to merge/close
- **cycles** — number of review-then-push loops
- **outcome** — `merged` / `closed` / `merged-with-rework`
- **author** — GitHub login

---

<!-- entries below this line, newest at top -->

- 2026-04-17 | #392 "feat(playground): Workspace tab, Codespaces buttons, Ideas cleanup" | XL | impl=0m | review=280m | cycles=1 | merged | @sabbour

- 2026-04-16 | #391 "test(e2e): harden Playwright E2E tests — auth route mock + openScenario robustness" | S | impl=0m | review=119m | cycles=1 | merged | @sabbour

- 2026-04-16 | #393 "fix(docs): remove invalid MDX heading anchor that breaks Docusaurus build" | S | impl=0m | review=4m | cycles=1 | merged | @sabbour

- 2026-04-17 | #412 "cleanup: finish FSM removal — remove engineState and dead phase fields" | L | impl=0m | review=5m | cycles=1 | merged | @sabbour
- 2026-04-17 | #407 "cleanup: explicitly gitignore packages/core/dist (workspace-only build output)" | S | impl=0m | review=1m | cycles=1 | merged | @sabbour

- 2026-04-17 | #408 "docs: pick canonical docs tree — collapse docs/ into docs-site/docs/" | XL | impl=0m | review=1m | cycles=1 | merged | @sabbour

- 2026-04-17 | #415 "refactor: narrow @kickstart/core skill-resolver public API" | L | impl=0m | review=1m | cycles=1 | merged | @sabbour

- 2026-04-17 | #416 "refactor: unify skill-injection keyword vocabulary into shared module" | L | impl=0m | review=1m | cycles=1 | merged | @sabbour

- 2026-04-17 | #418 "refactor: deduplicate advancePhase() — move to @kickstart/core" | S | impl=0m | review=13m | cycles=1 | merged | @sabbour

- 2026-04-17 | #421 "docs: fix phantom paths in getting-started + contributing" | M | impl=0m | review=1m | cycles=1 | merged | @sabbour
- 2026-04-17 | #420 "docs: remove stale 'typed skill path dormant' warning" | S | impl=0m | review=9m | cycles=1 | merged | @sabbour

- 2026-04-17 | #422 "docs: fix component-count drift (33 base, 22 custom)" | S | impl=0m | review=2m | cycles=1 | merged | @sabbour
- 2026-04-17 | #426 "docs: rewrite FSM docs to reflect completed cleanup" | L | impl=0m | review=13m | cycles=1 | merged | @sabbour

- 2026-04-17 | #424 "docs: rewrite api-reference — document all 19 endpoints" | L | impl=0m | review=8m | cycles=1 | merged | @sabbour

- 2026-04-17 | #427 "fix: replace required-approval gate with label-based squad/review-gate" | L | impl=1m | review=25m | cycles=1 | merged | @sabbour

- 2026-04-17 | #437 "fix(core): inject appDefinition, azureContext, repoInfo into system prompt" | S | impl=0m | review=0m | cycles=1 | merged | @sabbour
- 2026-04-17 | #439 "fix(core): guard advancePhase() against invalid phase strings" | M | impl=0m | review=0m | cycles=1 | merged | @sabbour

- 2026-04-17 | #438 "fix(core): make vocabulary arrays readonly; keep as internal-only exports" | S | impl=1m | review=0m | cycles=1 | merged | @sabbour

- 2026-04-17 | #440 "docs: fix stale skill-path claims in architecture docs" | S | impl=1m | review=0m | cycles=1 | merged | @sabbour-squad-frontend[bot]

- 2026-04-17 | #442 "docs: replace hardcoded Azure env values with placeholders (#432)" | S | impl=4m | review=12m | cycles=1 | merged | @sabbour-squad-frontend[bot]

- 2026-04-17 | #441 "fix(docs): correct conversation-phases and contributing accuracy (#435)" | L | impl=9m | review=13m | cycles=1 | merged | @sabbour

- 2026-04-17 | #443 "test: custom component count contract test" | M | impl=1m | review=0m | cycles=1 | merged | @sabbour-squad-tester[bot]

- 2026-04-17 | #444 "fix(docs): correct 19 API reference inaccuracies vs actual implementation" | M | impl=0m | review=8m | cycles=1 | merged | @sabbour-squad-frontend[bot]

- 2026-04-17 | #447 "feat(api): OpenAI Agents SDK backend runtime adapter" | XL | impl=39m | review=0m | cycles=1 | merged | @sabbour

- 2026-04-17 | #455 "feat(web): Agents SDK UI adaptation — route state consumption + E2E" | L | impl=98m | review=23m | cycles=1 | merged | @sabbour-squad-frontend[bot]

- 2026-04-17 | #457 "feat(web): add DebugA2UITree component for A2UI message visualization" | L | impl=1m | review=4m | cycles=1 | merged | @sabbour

- 2026-04-17 | #458 "feat(api): add systemPrompt to DebugMetadata for debug panel" | M | impl=1m | review=11m | cycles=1 | merged | @sabbour

- 2026-04-17 | #461 "feat(web): add systemPrompt collapsible section to DebugPanel" | S | impl=0m | review=6m | cycles=1 | merged | @sabbour

- 2026-04-17 | #465 "docs(connectors): document client vs proxy execution model" | S | impl=1m | review=18m | cycles=1 | merged | @sabbour-squad-tester[bot]

- 2026-04-17 | #464 "fix(web): resolve FileViewer empty black space in Workspace tab" | S | impl=0m | review=7m | cycles=1 | merged | @sabbour

- 2026-04-17 | #543 "Redirect ceremony-reference.md pointers to .squad/ceremonies.md" | S | impl=0m | review=3m | cycles=1 | merged | @sabbour

- 2026-04-17 | #481 "Address Copilot review feedback from #471" | L | impl=1m | review=34m | cycles=1 | merged | @sabbour
- 2026-04-17 | #552 "fix(workflows): fix YAML syntax errors in squad ceremony workflows" | M | impl=0m | review=43m | cycles=1 | merged | @sabbour

- 2026-04-17 | #555 "fix(retro-log): side branch + PR approach with CI bypass" | M | impl=4m | review=16m | cycles=1 | merged | @sabbour

- 2026-04-17 | #736 "docs: Step 13 — scrub Azure identifiers, delete v1 refs, update docs (#488)" | XL | impl=1m | review=3m | cycles=1 | merged | @sabbour
