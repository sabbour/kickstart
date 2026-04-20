# Squad Retro Log

Workflow-owned record of every merged or closed PR. One line per entry. Rows are appended on PR close, and the workflow may later backfill `reverted=true` if a standard git revert lands on `main`. Do not hand-edit.

Format:
```
- YYYY-MM-DD | #NNN "title" | size | impl=XXm | review=XXm | cycles=N | outcome | author | first_review=XXm | ci=XXm | reviewer=bot|human|none | human_comments=N | issue=#NNN/none | estimate=S/M/L/XL/unknown | rejections_by_reviewer=nibbler:X,leela:Y,zapp:Z | reverted=true/false
```

Legend:
- **size** — S / M / L / XL based on lines changed (S ≤50, M ≤250, L ≤1000, XL >1000)
- **impl** — time from branch first-commit to PR opened
- **review** — time from PR ready-for-review to merge/close
- **cycles** — number of review-then-push loops
- **outcome** — `merged` / `closed` / `merged-with-rework`
- **author** — GitHub login
- **first_review** — time from PR open to the first submitted review (`n/a` when none)
- **ci** — total completed check-run duration for the PR head SHA (`n/a` when unavailable)
- **reviewer** — whether the first submitted reviewer was a `bot`, `human`, or `none`
- **human_comments** — human-authored review + issue comment count (bot comments excluded)
- **issue** — linked in-repo issue from the PR closing keyword (`Closes #NNN`), else `none`
- **estimate** — linked issue label `estimate:S|M|L|XL`, else `unknown`
- **rejections_by_reviewer** — count of `*:rejected` label applications during the PR lifecycle
- **reverted** — `true` once a later trusted `git revert` commit on `main` is associated back to the PR, else `false`

Historical rows before each schema extension keep their older trailing columns.

---

<!-- entries below this line, newest at top -->

- 2026-04-20 | #869 "feat(harness): per-agent model env vars + friendly fallback error" | L | impl=1m | review=57m | cycles=3 | merged-with-rework | @sabbour | first_review=6m | ci=6m | reviewer=bot | human_comments=3 | issue=#868 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #865 "fix(workflows): realign retro lane to scribe auth" | M | impl=1m | review=1m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #861 "fix(workflows): restore retro-log protected-branch flow" | L | impl=5m | review=1m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-17 | #551 "feat(harness): Step 6 — Skill Resolver (#480)" | L | impl=0m | review=30m | cycles=1 | merged | @sabbour

- 2026-04-17 | #550 "feat(v2): #479 Step 5 — Runner + SSE" | XL | impl=1m | review=20m | cycles=1 | merged | @sabbour

- 2026-04-17 | #549 "fix(harness): Pack.skills[] for inline skill registration" | M | impl=0m | review=13m | cycles=1 | merged | @sabbour

- 2026-04-17 | #548 "feat(v2): #477 pack-core — agents, skills, tools, 40 components, guardrails, corePack manifest" | XL | impl=80m | review=31m | cycles=1 | merged | @sabbour

- 2026-04-17 | #547 "feat(v2): #478 Step 4a — Playground on registry" | L | impl=1m | review=18m | cycles=1 | merged | @sabbour

- 2026-04-17 | #546 "feat(v2): Step 3 — PackRegistry, loaders, frontmatter parser" | XL | impl=17m | review=14m | cycles=1 | merged | @sabbour

- 2026-04-17 | #545 "feat(v2): Step 2 — Harness primitives, all types + Zod schemas" | M | impl=0m | review=24m | cycles=1 | merged | @sabbour

- 2026-04-17 | #544 "feat(v2): Step 1 — Nuke v1, cut to harness, web-shell cleanup" | XL | impl=20m | review=16m | cycles=1 | merged | @sabbour

- 2026-04-17 | #551 "feat(harness): Step 6 — Skill Resolver (#480)" | L | impl=0m | review=30m | cycles=1 | merged | @sabbour

- 2026-04-17 | #549 "fix(harness): Pack.skills[] for inline skill registration" | M | impl=0m | review=13m | cycles=1 | merged | @sabbour

- 2026-04-17 | #545 "feat(v2): Step 2 — Harness primitives, all types + Zod schemas" | M | impl=0m | review=24m | cycles=1 | merged | @sabbour
