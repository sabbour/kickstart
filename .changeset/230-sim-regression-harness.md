---
"@aks-kickstart/sim-test": minor
---

feat(sim-test): add sim-as-regression-test harness

Implements the Phase 2.2 sim-as-regression-test harness (issue #230):

- **Sim transcript parser** (`packages/sim-test/src/parser.ts`): reads `.md` sim
  fixtures with YAML frontmatter and extracts expected tool calls, recipes, question
  budgets, and behaviour flags into a strongly-typed `SimTranscript` object.
- **Match scorer** (`packages/sim-test/src/scorer.ts`): compares an `ActualOutput`
  against a `SimTranscript` and produces a `SimScore` with per-criterion breakdown
  (tool calls, recipes, question budget, behaviours) and an overall 0–100 weighted
  score (pass ≥ 70).
- **CLI runner** (`scripts/sim-test.ts`): `npm run sim-test -- --sim <file>` prints
  the Phase 1 reviewer checklist; `--actual <output.json>` scores automatically.
- **3 golden fixtures** (`sims/`):
  - `sim-01-sam-nextjs.md` — floor case: zero questions, R1 + R17.
  - `sim-02-mike-manifests.md` — migration-readiness: ReviewCard + R17.
  - `sim-03-alex-cold-start.md` — scale-to-zero: R7 + R20 + R17.
- **25 unit tests** across parser and scorer (all passing).
