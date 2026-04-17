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
