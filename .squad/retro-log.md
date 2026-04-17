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

- 2026-04-17 | #465 "docs(connectors): document client vs proxy execution model" | S | impl=1m | review=18m | cycles=1 | merged | @sabbour-squad-tester[bot]

- 2026-04-17 | #464 "fix(web): resolve FileViewer empty black space in Workspace tab" | S | impl=0m | review=7m | cycles=1 | merged | @sabbour

- 2026-04-17 | #543 "Redirect ceremony-reference.md pointers to .squad/ceremonies.md" | S | impl=0m | review=3m | cycles=1 | merged | @sabbour

- 2026-04-17 | #481 "Address Copilot review feedback from #471" | L | impl=1m | review=34m | cycles=1 | merged | @sabbour
- 2026-04-17 | #552 "fix(workflows): fix YAML syntax errors in squad ceremony workflows" | M | impl=0m | review=43m | cycles=1 | merged | @sabbour

- 2026-04-17 | #555 "fix(retro-log): side branch + PR approach with CI bypass" | M | impl=4m | review=16m | cycles=1 | merged | @sabbour

- 2026-04-17 | #736 "docs: Step 13 — scrub Azure identifiers, delete v1 refs, update docs (#488)" | XL | impl=1m | review=3m | cycles=1 | merged | @sabbour
