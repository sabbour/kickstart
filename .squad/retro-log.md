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

## Round 4 Retrospective (2026-04-21)

**Shipped:** 5 UI bugs (#991, #980, #995, #997, #998)  
**PRs merged:** #1000 (pack client guardrails + bundle ceiling), #1001 (pack previews), #1003 (playground layout constants), #1004 (workspace flex), #1005 (schema conformance)  
**Gate cycle:** 4-way review (Leela, Zapp, Nibbler, Docs) all PRs; avg 2-3 cycles per PR

### Key Learnings

1. **Stale agent verdicts must be verified live.** Leela reported PR #1000 CI as "red" post-rebase, but CI was actually green. The agent cached a stale state and didn't re-poll GitHub Actions. **Action:** Each reviewer agent should validate live `gh run list` output before posting verdict. Avoid time-of-check-to-time-of-use gaps on CI state.

2. **Edit-but-not-commit creates silent test passes.** During Bender's rebase of #1000, test-import fixes were applied in the working tree but not committed. Local `npm test` passed (saw the edits), but the PR CI failed (index was stale). **Action:** Enforce "commit early, commit often" during rebases. Code review should flag `git status` with dirty working tree.

3. **Approval labels strip on PR synchronize.** GitHub clears review labels when a new commit is pushed to a PR. After Bender's rebase (fc60b872 → 6b8f17e3), nibbler/leela/zapp labels vanished. The "auto-merge on label" contract broke. **Action:** Plan an explicit relabel pass into the PR merge ceremony. Current workaround: contributor re-requests reviews, or Scribe force-adds via REST API.

4. **Worktree hygiene is overdue.** `.worktrees/` directory accumulated stale branches (fry-987, bender-996, etc.). Cleanup was not automated. **Action:** Add weekly squad housekeeping: `git worktree list`, then `git worktree remove .worktrees/X && git worktree prune` for all closed PRs.

5. **Bundle-budget ceiling gate proved.** PR #1000's `check-bundle-budget.mjs` (post-build CI + waiver-by-PR-description line) successfully gated JS payload growth. This is the approved pattern for any future "controlled performance overage" sign-off. ✅ Pattern locked in.

6. **Named-constant geometry SSoT prevents test drift.** PRs #1003 and #1004 used `playground-layout-constants.ts` (consumed by CSS, unit test, Playwright) as the single source of truth. This eliminates the test-drift-no-op failure mode. ✅ Pattern locked in for all Playground and flex-layout regressions.

7. **Parametrised tool conformance test is durable.** The `tool-strict-required-conformance.test.ts` walker (parametrised across all pack-core tools) prevents silent schema regressions like #998 from ever landing. This is now the mandatory check for any tool schema change. ✅ Conformance testing locked in.

### Implications for Next Rounds

- **Agent state validation:** Require live polling before verdicts; consider adding `--live` flag or automated re-check on stale reports.
- **Rebase discipline:** Stress-test commit workflow during rebases; treat working-tree-dirty as a red flag in reviews.
- **Label persistence:** Add relabel bot or explicit relabel step in the ceremony so 4-way approvals survive rebases.
- **Worktree cleanup:** Weekly cadence (or automatically on PR merge close).
- **Bundle + geometry as standard gates:** Future PRs touching performance or Playground layout should default to these patterns.

---

## Round 5–6 Retrospective (Overnight Sprint, 2026-04-21)

**Scope:** Continuous delivery sprint, 2 rounds of 4-way reviews  
**Shipped:** 19 issues / 26 PRs merged in ~8h  
**Outcomes:** 5 UI bugs landed + 4 process/security improvements  
**Gate cycle:** 4-way review (Leela, Zapp, Nibbler, Docs); avg 2–3 cycles per PR

### Key Learnings

1. **Trio-agent confusion on diff delta.** The `trio-1014-relabel` agent mistook "full PR diff" for "delta since last approval" and refused to relabel, claiming the change was "out of scope." Coordinator had to manually apply `leela:approved` label. **Root cause:** agent logic assumed `gh pr diff` returns delta vs approval-time state; actually returns entire PR scope vs main. **Action:** Teach all diff-comparison agents: (a) PR diff vs main is the WHOLE scope, never a delta; (b) for relabel tasks, explicitly fetch the diff at the time of PREVIOUS approval (via commit SHA) and compare against the current head, not against main.

2. **Bootstrap problem on workflow PRs.** PR #1011 originally failed CI because the base checkout (sparse-checkout of base.sha) tried to execute a script that was new to the PR. The script couldn't run until the head checkout was available, but the anti-tamper sparse-checkout job blocked it. **Solution pattern:** Split into two independent checkouts: (a) full checkout from head SHA (for dynamic scripts), (b) sparse checkout from base SHA (for anti-tamper static checks). Run (b) first (fast-fail if base is compromised), then (a) for script execution.

3. **`nibbler:rejected` label requires explicit deletion on re-review.** PR #1011 had `nibbler:rejected` label from an earlier review. When Nibbler re-approved, the label workflow added `nibbler:approved` but left the `rejected` label live, causing confusion about the actual state. **Action:** Teach all reviewers (agents and humans): when flipping a verdict (rejected → approved, or vice versa), EXPLICITLY DELETE the opposing label with `gh pr edit --remove-label nibbler:rejected` (or equivalent). Don't rely on "last label wins" semantics.

4. **Approval-label stripping is inconsistent (open question).** In round 4, we documented that approval labels strip on PR synchronize (GitHub default). In round 5, Leela's force-push on #1011 allegedly preserved all labels, contradicting the earlier pattern. **Status:** Open question — may be GitHub behavior variance, GitHub Actions race condition, or coordinator sequence issue. Recommend: next agent force-push should log `gh pr view <PR> --json labels` before and after to capture the actual label state. Don't assume; verify.

5. **User-authored PRs (e.g., PR #999) are in a separate lane.** PR #999 is Asabbour's user-authored identity fix, currently in flight. Coordinator and squad agents must NOT touch this PR without explicit direction from Asabbour. Unlike squad-authored PRs (which expect automated relabel + approve flows), user PRs have external ownership. **Action:** Add a check to the coordinator: if `author != (squad app)` and `issue != (squad workflow generated)`, flag as "user-owned, do not touch" and ping Asabbour before any automated action.

### Patterns Locked In (Carry Forward)

- ✅ **Bundle-budget ceiling gate** — CI hard-fail + waiver-by-PR-description is the approved shape
- ✅ **Named-constant geometry SSoT** — CSS + unit test + Playwright all import same constants module
- ✅ **Parametrised tool-conformance test** — covers all pack-core tools at every nesting depth, prevents schema regressions
- ✅ **Vitest guardrail tests as workflow equivalent** — CI hard-fail vitest tests accepted for security/conformance gates
- ✅ **Label deletion on verdict flip** — explicit `--remove-label` when changing approved → rejected or vice versa

### Implications for Next Rounds

- **Diff-comparison agents:** Validate diff scope vs approval-time state, not just vs main
- **Bootstrap on workflow PRs:** Plan two-checkout strategy (full head + sparse base)
- **Label management:** Make explicit deletion a standard step in the relabel ceremony
- **Force-push verification:** Log label state before/after to catch GitHub behavior variance
- **User-owned PR detection:** Add pre-check in coordinator to block automated actions on non-squad PRs

---

<!-- entries below this line, newest at top -->

- 2026-04-22 | #1083 "feat(harness): wire handoffs frontmatter to SDK (D2) — closes #1073" | L | impl=1m | review=9m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=5m | ci=9m | reviewer=bot | human_comments=0 | issue=#1073 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1072 "feat: structured event payload, triage branch-on-event, createSurface guard (#1062 Layers 1-3)" | XL | impl=1m | review=18m | cycles=1 | merged-with-rework | @sabbour | first_review=3m | ci=9m | reviewer=bot | human_comments=2 | issue=#1062 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1071 "feat(harness): thread conversation history across turns (#1062 Layer 0)" | L | impl=1m | review=9m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=6m | ci=8m | reviewer=bot | human_comments=0 | issue=#1062 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1068 "ci(guard): forbid useAzureMonitor double-export regression (#1066)" | S | impl=0m | review=122m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=0m | ci=6m | reviewer=bot | human_comments=0 | issue=#1066 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1064 "fix(obs): sanitize AgentSpanError stack trace before OTel export (#1040)" | M | impl=1m | review=313m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=2m | ci=8m | reviewer=human | human_comments=1 | issue=#1040 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1065 "fix(telemetry): plug PII double-export bypass; extend redactor to links + resource" | XL | impl=0m | review=16m | cycles=1 | merged | @sabbour | first_review=0m | ci=8m | reviewer=bot | human_comments=0 | issue=#1035 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1063 "chore: remove dead applicationinsights dep (#1037) + real tracer in T9 test (#1038)" | M | impl=0m | review=6m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=0m | ci=9m | reviewer=bot | human_comments=0 | issue=#1037 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1058 "fix(pack-core): emit_ui strict-mode schema violation" | M | impl=1m | review=53m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=3m | ci=9m | reviewer=bot | human_comments=0 | issue=#1050 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1056 "fix(ops): SWA smoke test hard gate + re-enable PR preview environments (closes #1049)" | M | impl=1m | review=26m | cycles=1 | merged-with-rework | @sabbour-squad-frontend[bot] | first_review=4m | ci=9m | reviewer=bot | human_comments=0 | issue=#1049 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1053 "fix(identity): alias zapp to lead role" | S | impl=0m | review=31m | cycles=1 | merged | @sabbour-squad-tester[bot] | first_review=6m | ci=7m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1052 "fix(ci): invert OTel externals guard in deploy-swa.yml (#1051 follow-up)" | S | impl=0m | review=10m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=2m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1048 "chore(identity): map Nibbler alias to lead role" | S | impl=0m | review=66m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=65m | ci=7m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1051 "fix(api): revert #1030 externalization to unblock SWA prod deploy (#1041)" | L | impl=7m | review=33m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=30m | ci=6m | reviewer=bot | human_comments=0 | issue=#1041 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1046 "fix: ship OTel externals in Functions deploy (#1041 hotfix)" | M | impl=1m | review=28m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=4m | ci=7m | reviewer=human | human_comments=1 | issue=#1041 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1039 "Fix: emit_ui tool schema strict-mode compliance (#1032)" | L | impl=1m | review=9m | cycles=1 | merged | @sabbour | first_review=2m | ci=7m | reviewer=bot | human_comments=0 | issue=#1032 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1034 "fix(observability): pure-OTel AppInsights pipeline + redaction (#1030)" | XL | impl=3m | review=16m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=6m | ci=7m | reviewer=bot | human_comments=0 | issue=#1030 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1033 "fix(observability): repair AppInsights telemetry pipeline (closes #1030)" | L | impl=1m | review=4m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=1m | ci=7m | reviewer=bot | human_comments=0 | issue=#1030 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1029 "fix: quarantine invalid pack skill manifests; close raw error leak (closes #1027)" | L | impl=1m | review=36m | cycles=2 | merged-with-rework | @sabbour-squad-backend[bot] | first_review=11m | ci=6m | reviewer=bot | human_comments=0 | issue=#1027 | estimate=unknown | rejections_by_reviewer=nibbler:1,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1022 "fix(web): sparkle.svg asset + local CSP-compliant sample media (#1018)" | M | impl=1m | review=67m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=20m | ci=8m | reviewer=bot | human_comments=1 | issue=#1018 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1023 "refactor(web-api): simplify widget-inspirations prompt generation (#1020)" | L | impl=1m | review=7m | cycles=1 | closed | @sabbour-squad-frontend[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#1020 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1015 "docs: Scribe Round-5 decisions merge + overnight sprint summary + retrospective" | L | impl=2m | review=5m | cycles=1 | merged | @sabbour | first_review=0m | ci=7m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1011 "feat: add quality SLO safety brake to squad review-gate (#806)" | L | impl=1m | review=30m | cycles=2 | merged-with-rework | @sabbour-squad-backend[bot] | first_review=0m | ci=6m | reviewer=bot | human_comments=1 | issue=#806 | estimate=unknown | rejections_by_reviewer=nibbler:1,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1014 "feat(process): process grader workflow (close the learning loop) (#805)" | XL | impl=3m | review=16m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=3m | ci=5m | reviewer=bot | human_comments=1 | issue=#805 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1013 "feat(security): harden insertSvgSafely against SVG XSS vectors" | L | impl=2m | review=13m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=5m | ci=6m | reviewer=bot | human_comments=1 | issue=#1006 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1012 "fix(workflows): pass retro metrics via env to avoid JS template injection" | S | impl=1m | review=16m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=1m | ci=7m | reviewer=bot | human_comments=1 | issue=#792 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1007 "docs: Scribe Round-4 decisions merge + identity update + retrospective" | XL | impl=93m | review=34m | cycles=1 | merged | @sabbour | first_review=20m | ci=23m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1008 "chore: extend retros with slo trip triggers (#808)" | L | impl=1943m | review=20m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=10m | ci=7m | reviewer=bot | human_comments=0 | issue=#808 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1009 "fix(web): coerce AKS composition outputs so the shared validator resolves them (#996)" | M | impl=1m | review=12m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=8m | ci=6m | reviewer=bot | human_comments=0 | issue=#996 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1000 "feat: render pack components via the engine" | XL | impl=1m | review=63m | cycles=3 | merged-with-rework | @sabbour | first_review=9m | ci=6m | reviewer=bot | human_comments=0 | issue=#991 | estimate=L | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1004 "fix(web): Workspace flex layout (min-height:0) closes black-void (#997)" | M | impl=0m | review=15m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=11m | ci=6m | reviewer=bot | human_comments=1 | issue=#997 | estimate=S | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #1001 "test(pack-core): add emit_ui explicit-op fixture" | M | impl=0m | review=16m | cycles=1 | merged | @sabbour | first_review=6m | ci=6m | reviewer=bot | human_comments=0 | issue=#980 | estimate=S | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #993 "process: add Sprint Planning + Cadence Retro ceremonies, elevate Nibbler to full reviewer, add docs gate, tighten coordinator ceremony enforcement" | XL | impl=1m | review=39m | cycles=1 | merged | @sabbour-squad-lead[bot] | first_review=48m | ci=6m | reviewer=human | human_comments=2 | issue=#992 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #990 "fix(web): vary Create-tab inspirations and constrain to core components" | L | impl=1m | review=10m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=26m | ci=5m | reviewer=bot | human_comments=5 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #989 "fix(web): align A2UI schema and renderer with v0.9 spec" | L | impl=1m | review=55m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=34m | ci=5m | reviewer=bot | human_comments=2 | issue=#984 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #986 "fix(web/playground): tighten grid, fix Workspace void, unify Create chat composer" | M | impl=1m | review=42m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=37m | ci=6m | reviewer=bot | human_comments=2 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #982 "fix(emit_ui): use `component`+`id` fields and require catalogId='kickstart'" | S | impl=1m | review=24m | cycles=1 | merged | @sabbour | first_review=7m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #976 "docs: AppInsights SWA wiring + observability runbook" | L | impl=0m | review=100m | cycles=1 | merged-with-rework | @sabbour | first_review=4m | ci=5m | reviewer=bot | human_comments=1 | issue=#964 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #971 "chore(squad): merge stale decisions inbox + archive decisions.md" | L | impl=0m | review=113m | cycles=1 | merged | @sabbour | first_review=113m | ci=5m | reviewer=bot | human_comments=0 | issue=#794 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #981 "fix(web): restore Playground component previews and fix _ErrorComponent lookup" | M | impl=1m | review=34m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=29m | ci=5m | reviewer=bot | human_comments=0 | issue=#978 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #978 "test(harness): runner a2ui drain-forward regression guard (#977)" | M | impl=1m | review=2m | cycles=1 | closed | @sabbour-squad-backend[bot] | first_review=n/a | ci=2m | reviewer=none | human_comments=0 | issue=#977 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #977 "fix(web): render A2UI envelopes in chat messages" | S | impl=1m | review=7m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=2m | ci=5m | reviewer=bot | human_comments=0 | issue=#977 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #974 "fix(api): ensure local AppInsights telemetry actually flows" | S | impl=1m | review=1m | cycles=1 | closed | @sabbour-squad-backend[bot] | first_review=n/a | ci=1m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #965 "fix(api): add local.settings.json.template with APPLICATIONINSIGHTS_CONNECTION_STRING placeholder" | S | impl=2m | review=32m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=29m | ci=6m | reviewer=bot | human_comments=0 | issue=#964 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #969 "fix(pack-core): core.emit_ui schema — replace z.unknown() with typed discriminated union (#966)" | L | impl=1m | review=0m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=15m | ci=6m | reviewer=bot | human_comments=0 | issue=#966 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #962 "feat(web): Debug panel — surface agentName, skillsExecuted, toolsExecuted (#959)" | M | impl=13m | review=8m | cycles=1 | merged | @sabbour | first_review=7m | ci=6m | reviewer=bot | human_comments=0 | issue=#959 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #956 "fix(playground): use bare component names in COMPONENT_PREVIEWS so registry resolves them (#954)" | M | impl=1m | review=30m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=18m | ci=5m | reviewer=bot | human_comments=0 | issue=#954 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #961 "feat(harness+web): add agentName, skillsExecuted, toolsExecuted to SSE end event" | M | impl=1m | review=19m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=8m | ci=5m | reviewer=bot | human_comments=0 | issue=#958 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #951 "fix(api): redact raw error details from unauthenticated /health 503 responses" | M | impl=0m | review=4m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=3m | ci=6m | reviewer=bot | human_comments=0 | issue=#927 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #950 "feat(api): add /health?deep=1 LLM canary check" | L | impl=1m | review=3m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=1m | ci=5m | reviewer=bot | human_comments=0 | issue=#941 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #948 "feat(infra): provision Application Insights + Log Analytics workspace (#942)" | M | impl=0m | review=8m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=3m | ci=5m | reviewer=bot | human_comments=0 | issue=#942 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #947 "fix(converse): fix double-encoded JSON responses and missing model name in SSE stream" | L | impl=1m | review=25m | cycles=1 | merged-with-rework | @sabbour-squad-backend[bot] | first_review=2m | ci=5m | reviewer=bot | human_comments=1 | issue=#937 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #946 "feat(api): wire Azure Monitor OpenTelemetry auto-instrumentation (closes #940)" | L | impl=1m | review=0m | cycles=2 | merged-with-rework | @sabbour-squad-backend[bot] | first_review=13m | ci=5m | reviewer=bot | human_comments=0 | issue=#940 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #945 "fix(playground): render live A2UI component previews in Components tab (#944)" | L | impl=0m | review=13m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=12m | ci=5m | reviewer=bot | human_comments=0 | issue=#944 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #935 "fix(web): Playground uses live /api/packs (#934)" | L | impl=0m | review=5m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=3m | ci=5m | reviewer=bot | human_comments=0 | issue=#934 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #891 "feat(api): Add Application Insights instrumentation for 404 diagnosis" | XL | impl=0m | review=221m | cycles=2 | merged-with-rework | @sabbour | first_review=286m | ci=5m | reviewer=bot | human_comments=3 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:1 | reverted=false

- 2026-04-21 | #924 "fix: Add diagnostic error messages to API health check (#914)" | L | impl=0m | review=76m | cycles=1 | merged-with-rework | @sabbour | first_review=9m | ci=5m | reviewer=human | human_comments=6 | issue=#914 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #921 "fix: centralized Azure credentials validation at startup (#920)" | L | impl=0m | review=76m | cycles=1 | merged | @sabbour | first_review=4m | ci=5m | reviewer=human | human_comments=5 | issue=#920 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #929 "ci: Fix changeset status check in PR contexts" | S | impl=0m | review=28m | cycles=1 | merged | @sabbour | first_review=27m | ci=6m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #912 "refactor: rename @kickstart scope to @aks-kickstart" | XL | impl=67m | review=90m | cycles=1 | merged-with-rework | @sabbour | first_review=1m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #930 "fix(api): bundle @azure/functions + bicep-node to fix SWA health 404" | S | impl=0m | review=2m | cycles=1 | merged | @sabbour | first_review=1m | ci=5m | reviewer=bot | human_comments=0 | issue=#926 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #928 "fix(ci): replace file: workspace refs with published version 1.0.1" | M | impl=0m | review=24m | cycles=1 | closed | @sabbour | first_review=15m | ci=5m | reviewer=bot | human_comments=2 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #926 "fix: Playground component graceful API fallback and E2E test re-enablement (#913)" | M | impl=1m | review=33m | cycles=1 | merged | @sabbour | first_review=5m | ci=5m | reviewer=human | human_comments=6 | issue=#913 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #922 "feat: Add structured JSON logging to Azure Functions with Application Insights" | L | impl=0m | review=14m | cycles=1 | merged | @sabbour | first_review=6m | ci=5m | reviewer=human | human_comments=7 | issue=#915 | estimate=M | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-21 | #925 "fix: Build and deploy pipeline reliability (fixes #919)" | S | impl=0m | review=8m | cycles=1 | merged | @sabbour | first_review=6m | ci=5m | reviewer=human | human_comments=4 | issue=#919 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #911 "fix: skip Oryx API build to use pre-resolved workspace packages" | S | impl=0m | review=3m | cycles=1 | merged | @sabbour | first_review=0m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #910 "release: v1.0.2" | S | impl=12m | review=4m | cycles=1 | merged | @sabbour | first_review=0m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #908 "docs: remove v2 branding and implementation brief" | XL | impl=7m | review=14m | cycles=1 | merged | @sabbour | first_review=8m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #907 "fix: use local workspace references instead of npm for internal packages" | M | impl=0m | review=26m | cycles=1 | merged | @sabbour | first_review=22m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #843 "feat: Shipping forecast workflow" | M | impl=2m | review=0m | cycles=1 | merged | @sabbour | first_review=1096m | ci=6m | reviewer=bot | human_comments=2 | issue=#804 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #903 "chore(release): wrap v1.0.1 release in PR for review gate" | S | impl=10m | review=10m | cycles=1 | merged | @sabbour | first_review=5m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #897 "chore(release): merge v1.0.1 to main for deployment" | XL | impl=191m | review=49m | cycles=1 | merged | @sabbour | first_review=n/a | ci=4m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #898 "chore(release): remove deprecated v* branch pattern from skill & docs" | M | impl=0m | review=33m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #899 "fix(review-gate): preserve lane-safe approvals on synchronize" | S | impl=502m | review=29m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#875 | estimate=S | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #881 "chore(deps-dev): bump @testing-library/react from 14.3.1 to 16.3.2" | L | impl=0m | review=412m | cycles=1 | merged | @dependabot[bot] | first_review=n/a | ci=6m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #889 "fix: align github pack asset paths with other packs" | S | impl=1m | review=52m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #880 "chore(deps): bump the non-breaking group with 4 updates" | L | impl=0m | review=403m | cycles=1 | merged | @dependabot[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #892 "🚨 CRITICAL FIX: Deploy /api/converse 404 resilience fix" | M | impl=0m | review=16m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #890 "docs(contributing): explain Squad and Copilot workflow in deployed page" | L | impl=0m | review=7m | cycles=1 | merged | @sabbour | first_review=4m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #887 "docs: handoff cleanup — v2 architecture, squad workflow, removed dead pages" | L | impl=0m | review=15m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=1 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #840 "feat: Harden docs gate to block merge without docs/changeset" | M | impl=1m | review=16m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#810 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #841 "fix: Delete or fix broken squad-docs.yml workflow" | M | impl=1m | review=0m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#809 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #842 "docs: add docs review checklist" | S | impl=1m | review=1m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#782 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #871 "chore: rename Fat components to Smart components" | S | impl=1m | review=158m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #839 "chore: point continuous improvement skill at workflows (#807)" | S | impl=1m | review=515m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#807 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #835 "chore: load docs-changelog skill in code charters (#812)" | S | impl=4m | review=515m | cycles=1 | merged | @sabbour | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#812 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #885 "test: pin colon allowlist ids" | S | impl=0m | review=6m | cycles=1 | merged | @sabbour-squad-tester[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#866 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #883 "docs: document pack-assets bundle layout" | S | impl=1m | review=0m | cycles=1 | merged | @sabbour-squad-frontend[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#867 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #882 "fix: restore playground route" | S | impl=1m | review=3m | cycles=1 | merged | @sabbour-squad-tester[bot] | first_review=n/a | ci=5m | reviewer=none | human_comments=0 | issue=#870 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #879 "fix(identity): stop reviewer roles collapsing into lead" | S | impl=0m | review=0m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=7m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #872 "fix(auth): fail closed primary agent github writes" | L | impl=5m | review=24m | cycles=1 | merged-with-rework | @sabbour-squad-backend[bot] | first_review=27m | ci=5m | reviewer=bot | human_comments=0 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-20 | #873 "docs: harden squad github write auth guidance" | L | impl=0m | review=20m | cycles=1 | closed | @sabbour | first_review=n/a | ci=4m | reviewer=none | human_comments=1 | issue=none | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

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
