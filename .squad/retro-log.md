# Squad Retro Log

Append-only record of every merged or closed PR. One row per entry. Owned by Scribe (via `.github/workflows/squad-pr-retro.yml`). Do not hand-edit.

Legend:
- **Size** — S / M / L / XL based on lines changed (S ≤50, M ≤250, L ≤1000, XL >1000)
- **Impl** — time from branch first-commit to PR opened
- **Review** — time from PR ready-for-review to merge/close
- **Cycles** — number of review-then-push loops
- **Outcome** — `merged` / `closed` / `merged-with-rework`
- **Author** — GitHub login

---

<!-- entries below this line, newest at top -->
| Date | PR | Title | Size | Impl | Review | Cycles | Outcome | Author |
|------|-----|-------|------|------|--------|--------|---------|--------|
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
