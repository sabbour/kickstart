# Squad Retro Log

Append-only record of every merged or closed PR. One row per entry. Owned by Scribe (via `.github/workflows/squad-pr-retro.yml`). Do not hand-edit.

Legend:
- **Size** — S / M / L / XL based on lines changed (S ≤50, M ≤250, L ≤1000, XL >1000)
- **Impl** — time from branch first-commit to PR opened
- **Review** — time from PR ready-for-review to merge/close
- **Cycles** — number of review-then-push loops
- **Outcome** — `merged` / `closed` / `merged-with-rework`
- **Author** — GitHub login
Append-only record of every merged or closed PR. One line per entry. Owned by Scribe (via `.github/workflows/squad-pr-retro.yml`). Do not hand-edit.
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
| Date | PR | Title | Size | Impl | Review | Cycles | Outcome | Author |
|------|-----|-------|------|------|--------|--------|---------|--------|
| 2026-04-15 | [#289](https://github.com/sabbour/kickstart/pull/289) | docs: add Extending Kickstart guide | XL | 1m | 5m | 1 | merged | @sabbour |
| 2026-04-15 | [#285](https://github.com/sabbour/kickstart/pull/285) | docs: clarify fat components documentation | M | 45m | 32m | 1 | merged | @sabbour |
| 2026-04-15 | [#288](https://github.com/sabbour/kickstart/pull/288) | fix: TextField editable + Markdown newline rendering | S | 3m | 13m | 1 | merged | @sabbour |
| 2026-04-15 | [#287](https://github.com/sabbour/kickstart/pull/287) | ci: remove paths-ignore to fix docs PR merge deadlock | S | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#281](https://github.com/sabbour/kickstart/pull/281) | docs: Integration Kits reference + A2UI catalog visual references | L | 3m | 87m | 1 | merged | @sabbour |
| 2026-04-15 | [#283](https://github.com/sabbour/kickstart/pull/283) | Remove Raw Text Content and Render Decisions from debug panel | M | 3m | 69m | 1 | merged | @sabbour |
| 2026-04-15 | [#279](https://github.com/sabbour/kickstart/pull/279) | docs: add extension guide for phases, tools, kits, API, and MCP | L | 2m | 100m | 1 | merged | @sabbour |
| 2026-04-15 | [#280](https://github.com/sabbour/kickstart/pull/280) | docs: A2UI component extension guide + playground docs | L | 1m | 96m | 1 | merged | @sabbour |
| 2026-04-15 | [#278](https://github.com/sabbour/kickstart/pull/278) | feat: Rewrite system prompt — unified narrative with Try-AKS conversation architecture | L | 1m | 100m | 1 | merged | @sabbour |
| 2026-04-15 | [#290](https://github.com/sabbour/kickstart/pull/290) | fix: Tabs component + unregistered component handling | M | 2m | 16m | 1 | merged | @sabbour |
| 2026-04-15 | [#291](https://github.com/sabbour/kickstart/pull/291) | fix: action button labels + ChoicePicker primary styling | S | 1m | 6m | 1 | merged | @sabbour |
| 2026-04-15 | [#293](https://github.com/sabbour/kickstart/pull/293) | fix: replace emoji status indicators with Fluent UI icons | M | 0m | 36m | 1 | merged | @sabbour |
| 2026-04-15 | [#292](https://github.com/sabbour/kickstart/pull/292) | fix: consistent assistant icon during streaming | S | 0m | 4m | 1 | merged | @sabbour |
| 2026-04-15 | [#297](https://github.com/sabbour/kickstart/pull/297) | fix(flow): end conversation at Review, add client: action routing (#271) | XL | 50m | 42m | 1 | merged | @sabbour |
| 2026-04-15 | [#294](https://github.com/sabbour/kickstart/pull/294) | fix: code block theme — dark palette, readable font, line numbers | L | 0m | 8m | 1 | merged | @sabbour |
| 2026-04-15 | [#303](https://github.com/sabbour/kickstart/pull/303) | fix(prompt): architecture diagram depth + KAITO full name | M | 1m | 45m | 1 | merged | @sabbour |
| 2026-04-15 | [#302](https://github.com/sabbour/kickstart/pull/302) | fix: restore chat surface ownership, phase bar rendering, and debug action log placement | XL | 100m | 11m | 1 | merged | @sabbour |
| 2026-04-15 | [#304](https://github.com/sabbour/kickstart/pull/304) | fix: normalize A2UI component titles to Subtitle1 | M | 0m | 9m | 1 | merged | @sabbour |
| 2026-04-15 | [#305](https://github.com/sabbour/kickstart/pull/305) | feat: secure GitHub handoff slice for #274 | XL | 3m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#309](https://github.com/sabbour/kickstart/pull/309) | fix: restore progressive conversation flow | L | 0m | 12m | 1 | merged | @sabbour |
| 2026-04-15 | [#306](https://github.com/sabbour/kickstart/pull/306) | feat(web): wire generated files into workspace | L | 0m | 11m | 1 | merged | @sabbour |
| 2026-04-15 | [#307](https://github.com/sabbour/kickstart/pull/307) | test: pacing directive regression tests for system prompt (#275) | L | 9m | 2m | 1 | merged | @sabbour |
| 2026-04-15 | [#308](https://github.com/sabbour/kickstart/pull/308) | feat: real Azure auth and deployment flow | XL | 50m | 10m | 1 | merged | @sabbour |
| 2026-04-15 | [#310](https://github.com/sabbour/kickstart/pull/310) | fix: ship real GitHub commit PR flow | L | 13m | 15m | 1 | merged | @sabbour |
| 2026-04-15 | [#312](https://github.com/sabbour/kickstart/pull/312) | fix: keep SWA API startup imports clean | S | 0m | 114m | 1 | merged | @sabbour |
| 2026-04-15 | [#311](https://github.com/sabbour/kickstart/pull/311) | feat: route converse generate phase to gpt-5.4 | L | 0m | 22m | 1 | merged | @sabbour |
| 2026-04-15 | [#314](https://github.com/sabbour/kickstart/pull/314) | feat: upgrade architecture diagram renderer | XL | 3m | 144m | 1 | merged | @sabbour |
| 2026-04-15 | [#317](https://github.com/sabbour/kickstart/pull/317) | fix: stop false heartbeat failures | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#315](https://github.com/sabbour/kickstart/pull/315) | test: add SWA post-deploy health smoke | M | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#316](https://github.com/sabbour/kickstart/pull/316) | feat: add live Azure session cost estimates | XL | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#318](https://github.com/sabbour/kickstart/pull/318) | test: sync Ralph heartbeat template | L | 3m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#320](https://github.com/sabbour/kickstart/pull/320) | fix: harden kickstart-app CodeQL hotspot | L | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#322](https://github.com/sabbour/kickstart/pull/322) | feat(chat): add token usage tracker | L | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#321](https://github.com/sabbour/kickstart/pull/321) | fix(deps): clear root dompurify alerts via monaco-editor pin | S | 5m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#323](https://github.com/sabbour/kickstart/pull/323) | fix: wire GitHub Packages auth into CI | S | 1m | 2m | 1 | merged | @sabbour |
| 2026-04-15 | [#324](https://github.com/sabbour/kickstart/pull/324) | fix: restore CostEstimate legacy compatibility | M | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#325](https://github.com/sabbour/kickstart/pull/325) | fix: tighten chat debug diagnostics | L | 0m | 56m | 1 | merged | @sabbour |
| 2026-04-15 | [#334](https://github.com/sabbour/kickstart/pull/334) | fix: stabilize file surfaces and workspace artifacts | XL | 9m | 10m | 1 | merged | @sabbour |
| 2026-04-15 | [#336](https://github.com/sabbour/kickstart/pull/336) | feat: keep setup generation in chat progress and workspace | XL | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-15 | [#337](https://github.com/sabbour/kickstart/pull/337) | feat: implement codex-backed setup generation | XL | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#339](https://github.com/sabbour/kickstart/pull/339) | release: v0.7.0 | M | 2m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#340](https://github.com/sabbour/kickstart/pull/340) | feat: validate Playground fat components | L | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#354](https://github.com/sabbour/kickstart/pull/354) | chore: enable stepwise-generation feature flag — set STEPWISE_GENERATION_V1 env var and document | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#346](https://github.com/sabbour/kickstart/pull/346) | Use canonical icon paths for ArchitectureDiagram | M | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-16 | [#344](https://github.com/sabbour/kickstart/pull/344) | Vendor ArchitectureDiagram assets locally | L | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#345](https://github.com/sabbour/kickstart/pull/345) | fix(auth): silence A2UI no-handler warning and suppress playground ARM 401s | XL | 470m | 76m | 1 | merged | @sabbour |
| 2026-04-16 | [#348](https://github.com/sabbour/kickstart/pull/348) | feat: align ArchitectureDiagram styling with Fluent 2 | L | 0m | 3m | 1 | merged | @sabbour |
| 2026-04-16 | [#356](https://github.com/sabbour/kickstart/pull/356) | feat: rename DeploymentProgress to GenerationProgress (#350) | M | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#358](https://github.com/sabbour/kickstart/pull/358) | feat: document that LLM can combine built-in + custom catalog components in A2UI | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#368](https://github.com/sabbour/kickstart/pull/368) | sec: add explicit permissions block to CI workflow | S | 0m | 28m | 1 | merged | @sabbour |
| 2026-04-16 | [#371](https://github.com/sabbour/kickstart/pull/371) | sec: replace Math.random with crypto.randomUUID in useSessions (#362) | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#372](https://github.com/sabbour/kickstart/pull/372) | fix: resolve next-card missing component (#352) | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#369](https://github.com/sabbour/kickstart/pull/369) | sec: pin serialize-javascript to 7.0.5 via overrides in docs-site | M | 16m | 12m | 1 | merged | @sabbour |
| 2026-04-16 | [#370](https://github.com/sabbour/kickstart/pull/370) | fix: stabilize Playground surfaceIds in JSON preview (#343) | M | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#374](https://github.com/sabbour/kickstart/pull/374) | test: add prompt-catalog contract tests (#355) | M | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#377](https://github.com/sabbour/kickstart/pull/377) | test: real auth integration test scaffolding — Phase 1 mock flows (#332) | L | 0m | 3m | 1 | merged | @sabbour |
| 2026-04-16 | [#373](https://github.com/sabbour/kickstart/pull/373) | sec: fix incomplete sanitization, bad tag filter, and ReDoS (#359 #360 #361) | M | 4m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#375](https://github.com/sabbour/kickstart/pull/375) | chore: upgrade hono and follow-redirects (#366 #367) | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-16 | [#376](https://github.com/sabbour/kickstart/pull/376) | chore: post-sprint retro — update decisions, clean prompts, agent histories | M | 1m | 5m | 1 | merged | @sabbour |
| 2026-04-16 | [#378](https://github.com/sabbour/kickstart/pull/378) | feat: A2UI custom component expansion — audit and quick-wins (#351) | L | 2m | 3m | 1 | merged | @sabbour |
| 2026-04-16 | [#382](https://github.com/sabbour/kickstart/pull/382) | feat(core): make conversation flow LLM-driven instead of scripted | L | 0m | 25m | 1 | merged | @sabbour |
| 2026-04-16 | [#379](https://github.com/sabbour/kickstart/pull/379) | docs: clarify FileEditor A2UI vs sidebar architecture | S | 0m | 6m | 1 | merged | @sabbour |
| 2026-04-16 | [#381](https://github.com/sabbour/kickstart/pull/381) | feat: render architecture diagrams inside FileEditor | L | 0m | 29m | 1 | merged | @sabbour |
| 2026-04-16 | [#383](https://github.com/sabbour/kickstart/pull/383) | docs: engineering accuracy rewrite — prompt pipeline, FSM, skill injection | XL | 1m | 189m | 1 | merged | @sabbour |
| 2026-04-16 | [#385](https://github.com/sabbour/kickstart/pull/385) | refactor(core): remove FSM — plain state variables | L | 10m | 197m | 1 | merged | @sabbour |
| 2026-04-16 | [#386](https://github.com/sabbour/kickstart/pull/386) | chore(squad): enable per-session worktree isolation | L | 0m | 32m | 1 | merged | @sabbour |
| 2026-04-17 | [#392](https://github.com/sabbour/kickstart/pull/392) | feat(playground): Workspace tab, Codespaces buttons, Ideas cleanup | XL | 0m | 280m | 1 | merged | @sabbour |
| 2026-04-16 | [#390](https://github.com/sabbour/kickstart/pull/390) | fix(e2e): update playground AuthCard tests to match reorganized tab layout | S | 82m | 117m | 1 | merged | @sabbour |
| 2026-04-16 | [#391](https://github.com/sabbour/kickstart/pull/391) | test(e2e): harden Playwright E2E tests — auth route mock + openScenario robustness | S | 0m | 119m | 1 | merged | @sabbour |
| 2026-04-16 | [#393](https://github.com/sabbour/kickstart/pull/393) | fix(docs): remove invalid MDX heading anchor that breaks Docusaurus build | S | 0m | 4m | 1 | merged | @sabbour |
| 2026-04-17 | [#412](https://github.com/sabbour/kickstart/pull/412) | cleanup: finish FSM removal — remove engineState and dead phase fields | L | 0m | 5m | 1 | merged | @sabbour |
| 2026-04-17 | [#407](https://github.com/sabbour/kickstart/pull/407) | cleanup: explicitly gitignore packages/core/dist (workspace-only build output) | S | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-17 | [#408](https://github.com/sabbour/kickstart/pull/408) | docs: pick canonical docs tree — collapse docs/ into docs-site/docs/ | XL | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-17 | [#415](https://github.com/sabbour/kickstart/pull/415) | refactor: narrow @kickstart/core skill-resolver public API | L | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-17 | [#416](https://github.com/sabbour/kickstart/pull/416) | refactor: unify skill-injection keyword vocabulary into shared module | L | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-17 | [#418](https://github.com/sabbour/kickstart/pull/418) | refactor: deduplicate advancePhase() — move to @kickstart/core | S | 0m | 13m | 1 | merged | @sabbour |
| 2026-04-17 | [#421](https://github.com/sabbour/kickstart/pull/421) | docs: fix phantom paths in getting-started + contributing | M | 0m | 1m | 1 | merged | @sabbour |
| 2026-04-17 | [#420](https://github.com/sabbour/kickstart/pull/420) | docs: remove stale 'typed skill path dormant' warning | S | 0m | 9m | 1 | merged | @sabbour |
| 2026-04-17 | [#422](https://github.com/sabbour/kickstart/pull/422) | docs: fix component-count drift (33 base, 22 custom) | S | 0m | 2m | 1 | merged | @sabbour |
| 2026-04-17 | [#426](https://github.com/sabbour/kickstart/pull/426) | docs: rewrite FSM docs to reflect completed cleanup | L | 0m | 13m | 1 | merged | @sabbour |
| 2026-04-17 | [#424](https://github.com/sabbour/kickstart/pull/424) | docs: rewrite api-reference — document all 19 endpoints | L | 0m | 8m | 1 | merged | @sabbour |
| 2026-04-17 | [#427](https://github.com/sabbour/kickstart/pull/427) | fix: replace required-approval gate with label-based squad/review-gate | L | 1m | 25m | 1 | merged | @sabbour |
| 2026-04-17 | [#437](https://github.com/sabbour/kickstart/pull/437) | fix(core): inject appDefinition, azureContext, repoInfo into system prompt | S | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-17 | [#439](https://github.com/sabbour/kickstart/pull/439) | fix(core): guard advancePhase() against invalid phase strings | M | 0m | 0m | 1 | merged | @sabbour |
| 2026-04-17 | [#438](https://github.com/sabbour/kickstart/pull/438) | fix(core): make vocabulary arrays readonly; keep as internal-only exports | S | 1m | 0m | 1 | merged | @sabbour |
| 2026-04-17 | [#440](https://github.com/sabbour/kickstart/pull/440) | docs: fix stale skill-path claims in architecture docs | S | 1m | 0m | 1 | merged | @sabbour-squad-frontend[bot] |
| 2026-04-17 | [#442](https://github.com/sabbour/kickstart/pull/442) | docs: replace hardcoded Azure env values with placeholders (#432) | S | 4m | 12m | 1 | merged | @sabbour-squad-frontend[bot] |
| 2026-04-17 | [#441](https://github.com/sabbour/kickstart/pull/441) | fix(docs): correct conversation-phases and contributing accuracy (#435) | L | 9m | 13m | 1 | merged | @sabbour |
| 2026-04-17 | [#443](https://github.com/sabbour/kickstart/pull/443) | test: custom component count contract test | M | 1m | 0m | 1 | merged | @sabbour-squad-tester[bot] |
| 2026-04-17 | [#444](https://github.com/sabbour/kickstart/pull/444) | fix(docs): correct 19 API reference inaccuracies vs actual implementation | M | 0m | 8m | 1 | merged | @sabbour-squad-frontend[bot] |
| 2026-04-17 | [#447](https://github.com/sabbour/kickstart/pull/447) | feat(api): OpenAI Agents SDK backend runtime adapter | XL | 39m | 0m | 1 | merged | @sabbour |
| 2026-04-17 | [#455](https://github.com/sabbour/kickstart/pull/455) | feat(web): Agents SDK UI adaptation — route state consumption + E2E | L | 98m | 23m | 1 | merged | @sabbour-squad-frontend[bot] |
| 2026-04-17 | [#457](https://github.com/sabbour/kickstart/pull/457) | feat(web): add DebugA2UITree component for A2UI message visualization | L | 1m | 4m | 1 | merged | @sabbour |
| 2026-04-17 | [#458](https://github.com/sabbour/kickstart/pull/458) | feat(api): add systemPrompt to DebugMetadata for debug panel | M | 1m | 11m | 1 | merged | @sabbour |
| 2026-04-17 | [#461](https://github.com/sabbour/kickstart/pull/461) | feat(web): add systemPrompt collapsible section to DebugPanel | S | 0m | 6m | 1 | merged | @sabbour |
| 2026-04-17 | [#465](https://github.com/sabbour/kickstart/pull/465) | docs(connectors): document client vs proxy execution model | S | 1m | 18m | 1 | merged | @sabbour-squad-tester[bot] |
| 2026-04-17 | [#464](https://github.com/sabbour/kickstart/pull/464) | fix(web): resolve FileViewer empty black space in Workspace tab | S | 0m | 7m | 1 | merged | @sabbour |
| 2026-04-17 | [#543](https://github.com/sabbour/kickstart/pull/543) | Redirect ceremony-reference.md pointers to .squad/ceremonies.md | S | 0m | 3m | 1 | merged | @sabbour |
| 2026-04-17 | [#481](https://github.com/sabbour/kickstart/pull/481) | Address Copilot review feedback from #471 | L | 1m | 34m | 1 | merged | @sabbour |
| 2026-04-17 | [#552](https://github.com/sabbour/kickstart/pull/552) | fix(workflows): fix YAML syntax errors in squad ceremony workflows | M | 0m | 43m | 1 | merged | @sabbour |
| 2026-04-17 | [#555](https://github.com/sabbour/kickstart/pull/555) | fix(retro-log): side branch + PR approach with CI bypass | M | 4m | 16m | 1 | merged | @sabbour |
| 2026-04-17 | [#736](https://github.com/sabbour/kickstart/pull/736) | docs: Step 13 — scrub Azure identifiers, delete v1 refs, update docs (#488) | XL | 1m | 3m | 1 | merged | @sabbour |

- 2026-04-22 | #1091 "fix(#1087): token-leak prevention & governance hardening" | XL | impl=4m | review=37m | cycles=3 | merged-with-rework | @sabbour-squad-frontend[bot] | first_review=5m | ci=8m | reviewer=human | human_comments=1 | issue=#1087 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1089 "fix(#1087): token-leak prevention & governance hardening" | XL | impl=1m | review=2m | cycles=1 | closed | @sabbour | first_review=n/a | ci=3m | reviewer=none | human_comments=0 | issue=#1087 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1086 "feat(harness): core.read_skill pull-based skill loading (D5) — closes #1070" | XL | impl=1m | review=39m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=5m | ci=16m | reviewer=bot | human_comments=1 | issue=#1070 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1085 "feat(harness): cold-session hydration from client messages (D3) — closes #1074" | XL | impl=1m | review=27m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=6m | ci=32m | reviewer=human | human_comments=2 | issue=#1074 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

- 2026-04-22 | #1084 "fix(pack-core): emit_ui idempotent by surfaceId + live-surface cap (D11) — closes #1075" | L | impl=1m | review=11m | cycles=1 | merged | @sabbour-squad-backend[bot] | first_review=9m | ci=9m | reviewer=bot | human_comments=0 | issue=#1075 | estimate=unknown | rejections_by_reviewer=nibbler:0,leela:0,zapp:0 | reverted=false

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
