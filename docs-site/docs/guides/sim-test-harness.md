---
sidebar_position: 2
---

# Sim-Test Harness

The `@aks-kickstart/sim-test` package is a lightweight regression-testing harness that captures agent behaviour during a live run and scores it against a golden fixture.

It powers `npm run chat -- --output results.json` and the sim scoring pipeline.

---

## Core concepts

| Concept | Description |
|---|---|
| **Sim fixture** | A Markdown file with YAML frontmatter that declares what the agent *should* do for a given scenario. |
| **ActualOutput** | The recorded output from a real agent run — tool calls, recipes emitted, question count, behaviour flags. |
| **SimScore** | A per-criterion breakdown (0–100) plus a weighted overall score. Pass threshold: 70. |

---

## Fixture format

Fixtures are Markdown files with YAML frontmatter. Create one per scenario:

```markdown
---
sim: sim-01
title: "Sam — Next.js greenfield (floor case)"
agent: core.triage
description: "Minimal prompt — agent should route without asking any questions."
expected:
  toolCalls:
    ordered: false
    required:
      - name: core.emit_ui
      - name: core.show_card
  recipes:
    required: [R1, R17]
  questionBudget:
    max: 0
  behaviors:
    - id: zero-questions
      description: "Agent routes without any clarifying questions"
  weights:
    toolCalls: 20
    recipes: 40
    questionBudget: 20
    behaviors: 20
---

Sam is deploying a Next.js app. She wants zero friction — just get it running on AKS.
```

### Frontmatter fields

| Field | Required | Description |
|---|---|---|
| `sim` | ✅ | Unique fixture ID (e.g. `sim-01`) |
| `title` | ✅ | Human-readable scenario title |
| `agent` | ✅ | Target agent ID (e.g. `core.triage`) |
| `description` | ✅ | Short scenario description |
| `expected.toolCalls.required` | ✅ | List of tool names that must be called |
| `expected.toolCalls.ordered` | ✅ | `true` to enforce call order |
| `expected.recipes.required` | ✅ | Recipe IDs that must be emitted (e.g. `R1`, `R17`) |
| `expected.questionBudget.max` | ✅ | Maximum questions allowed (`0` = zero-question routing) |
| `expected.behaviors` | ✅ | Named behaviour flags to check (array of `{id, description}`) |
| `expected.weights` | ❌ | Override scoring weights (must sum to 100; defaults: toolCalls=20, recipes=40, questionBudget=20, behaviors=20) |

---

## Scoring dimensions

| Criterion | Default weight | Pass condition |
|---|---|---|
| `toolCalls` | 20 | All required tools were called (in order if `ordered: true`) |
| `recipes` | 40 | All required recipe IDs were emitted |
| `questionBudget` | 20 | `questionCount ≤ max` |
| `behaviors` | 20 | All required behaviour flags observed |

Overall score = weighted average of the four criteria (0–100). A run **passes** at ≥ 70.

---

## Running a sim

### 1. Record an actual output

Use the Chat CLI to run a scenario and capture its SSE stream:

```bash
npm run chat -- --message "$(cat my-fixture.md)" --output actual.json
```

Or for interactive recording:

```bash
npm run chat -- --interactive --output actual.json
```

See [Chat CLI Reference](../getting-started/chat-cli.md) for all options.

### 2. Score the output

```ts
import { parseSimTranscriptFile, scoreSimRun } from '@aks-kickstart/sim-test';
import actual from './actual.json';

const transcript = parseSimTranscriptFile('./fixtures/sim-01.md');
const score = scoreSimRun(transcript, actual);

console.log(`Overall: ${score.overallScore}/100 — ${score.pass ? 'PASS' : 'FAIL'}`);
for (const c of score.criteria) {
  console.log(`  ${c.name}: ${c.score} (weight ${c.weight})`);
}
```

### 3. Run all fixtures

The sim-test suite is wired into `npm test`:

```bash
npm test
```

Individual fixture files live in `packages/sim-test/src/*.test.ts`.

---

## Programmatic API

```ts
import {
  parseSimTranscript,      // parse markdown string → SimTranscript
  parseSimTranscriptFile,  // parse file path → SimTranscript
  scoreSimRun,             // score ActualOutput against SimTranscript → SimScore
  SimRecorder,             // collect SSE events and extract ActualOutput
  SimParseError,           // thrown on malformed fixture frontmatter
} from '@aks-kickstart/sim-test';
```

### `SimRecorder`

`SimRecorder` attaches to the SSE stream during a live harness run and builds the `ActualOutput` automatically:

```ts
const recorder = new SimRecorder();
// recorder.onEvent(event) — call for each SSE event
// recorder.getActualOutput() — returns ActualOutput after the run
```

Recipe IDs are inferred from `a2ui` component text using keyword patterns from `config/recipes.json`. Behaviour flags (`zero-questions`, `r17-close`, etc.) are derived automatically from question count and recipe emissions.

---

## Adding a new fixture

1. Create `packages/sim-test/src/fixtures/sim-NN.md` following the format above.
2. Add a test file `packages/sim-test/src/sim-NN.test.ts` that calls `parseSimTranscriptFile` + `scoreSimRun`.
3. Run `npm test` to confirm the fixture parses and scores correctly.
4. Commit both files together.
