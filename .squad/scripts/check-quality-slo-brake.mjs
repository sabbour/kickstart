#!/usr/bin/env node
// Quality SLO safety brake for the squad review-gate.
//
// Reads `.squad/velocity.md`, locates the newest `### Quality SLO panel`
// table, and reports whether any signal is 🔴. Driven by PR labels:
//
//   - Only evaluated when the PR carries `process:velocity`.
//   - `process:quality`, `process:incident`, `process:revert` always bypass.
//   - Any other PR is an explicit no-op (skip).
//
// Usage:
//   node .squad/scripts/check-quality-slo-brake.mjs \
//       --velocity-file=.squad/velocity.md \
//       --labels="process:velocity,type:feat"
//
// Writes a job summary block to the file named by $GITHUB_STEP_SUMMARY when
// set, and exits non-zero only when the brake actually engages.
//
// Self-test:
//   node .squad/scripts/check-quality-slo-brake.mjs --self-test
//
// Only Node.js built-ins — no npm dependencies.

import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { argv, exit, env, stdout } from "node:process";

const BYPASS_LABELS = ["process:quality", "process:incident", "process:revert"];
const GUARDED_LABEL = "process:velocity";

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Locate the newest `### Quality SLO panel` block in a velocity.md snapshot
 * and return the rows of its markdown table, split into cells.
 *
 * The newest snapshot is first in the file because the Scribe prepends.
 *
 * @param {string} text
 * @returns {{ rows: string[][], snapshotHeading: string | null } | null}
 */
export function parseQualitySloPanel(text) {
  const lines = text.split(/\r?\n/);
  let panelStart = -1;
  let snapshotHeading = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Track the most recent `## Snapshot · …` heading seen so we can report
    // which snapshot the brake inspected.
    if (/^##\s+Snapshot\b/i.test(line)) {
      snapshotHeading = line.replace(/^##\s+/, "").trim();
    }
    if (/^###\s+Quality SLO panel\s*$/i.test(line)) {
      panelStart = i + 1;
      break;
    }
  }

  if (panelStart === -1) {
    return null;
  }

  // Walk forward to the first markdown table row (pipe-delimited).
  let i = panelStart;
  while (i < lines.length && !lines[i].trim().startsWith("|")) {
    // Stop if we hit another heading before finding a table.
    if (/^#{1,6}\s/.test(lines[i])) return { rows: [], snapshotHeading };
    i++;
  }

  const rows = [];
  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "") break;
    if (!trimmed.startsWith("|")) break;
    if (/^#{1,6}\s/.test(line)) break;
    // Skip the header separator row like `| --- | ---: | ---: | --- |`.
    if (/^\|[\s:\-|]+\|\s*$/.test(trimmed)) continue;
    const cells = trimmed
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }

  // First row is the table header (`Signal | Actual | Target | Status`).
  // Drop it so callers only see data rows.
  if (rows.length > 0) rows.shift();

  return { rows, snapshotHeading };
}

/**
 * Classify a status cell. 🔴 (or literal `red`/`breached`) trips the brake.
 * 🟡 / 🟢 / unknown do not.
 *
 * @param {string} statusCell
 * @returns {"red" | "yellow" | "green" | "unknown"}
 */
export function classifyStatus(statusCell) {
  const s = statusCell.toLowerCase();
  if (s.includes("🔴") || /\b(red|breached)\b/.test(s)) return "red";
  if (s.includes("🟡")) return "yellow";
  if (s.includes("🟢")) return "green";
  return "unknown";
}

/**
 * Evaluate the brake given the parsed panel rows and the PR's labels.
 * Pure function — no I/O — so it is trivially testable.
 *
 * @param {{ rows: string[][], snapshotHeading: string | null } | null} panel
 * @param {string[]} labels
 * @returns {{ decision: "fail" | "bypass" | "skip" | "pass", reason: string, redRows: { signal: string, actual: string, target: string, status: string }[], snapshotHeading: string | null }}
 */
export function evaluateBrake(panel, labels) {
  const labelSet = new Set(labels);
  const snapshotHeading = panel?.snapshotHeading ?? null;

  if (!labelSet.has(GUARDED_LABEL)) {
    return {
      decision: "skip",
      reason: `not a ${GUARDED_LABEL} PR`,
      redRows: [],
      snapshotHeading,
    };
  }

  const bypass = BYPASS_LABELS.find((l) => labelSet.has(l));
  if (bypass) {
    return {
      decision: "bypass",
      reason: `bypass: ${bypass}`,
      redRows: [],
      snapshotHeading,
    };
  }

  if (!panel) {
    // No SLO panel found at all → not a failure, but surface it.
    return {
      decision: "pass",
      reason: "no Quality SLO panel found in .squad/velocity.md",
      redRows: [],
      snapshotHeading,
    };
  }

  const redRows = panel.rows
    .filter((cells) => cells.length >= 4 && classifyStatus(cells[3]) === "red")
    .map((cells) => ({
      signal: cells[0] ?? "",
      actual: cells[1] ?? "",
      target: cells[2] ?? "",
      status: cells[3] ?? "",
    }));

  if (redRows.length === 0) {
    return {
      decision: "pass",
      reason: "all Quality SLOs are 🟢 or 🟡 (no red signals)",
      redRows: [],
      snapshotHeading,
    };
  }

  return {
    decision: "fail",
    reason: `${redRows.length} red Quality SLO signal(s)`,
    redRows,
    snapshotHeading,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderJobSummary(result) {
  const { decision, reason, redRows, snapshotHeading } = result;
  const lines = [];
  lines.push("## Review-gate safety brake — Quality SLOs");
  lines.push("");

  if (decision === "skip") {
    lines.push(`➖ **Skipped** — ${reason}.`);
  } else if (decision === "bypass") {
    lines.push(`✅ **Bypassed** — ${reason}.`);
  } else if (decision === "pass") {
    lines.push(`✅ **Passed** — ${reason}.`);
  } else {
    lines.push("🛑 **Review-gate safety brake engaged**");
    lines.push("");
    lines.push(
      `This PR is labeled \`${GUARDED_LABEL}\`, but the latest Quality SLO snapshot in \`.squad/velocity.md\` reports one or more red signals:`,
    );
    for (const r of redRows) {
      lines.push(`- \`${r.signal}\`: \`${r.actual}\` vs target \`${r.target}\` — ${r.status}`);
    }
    lines.push("");
    lines.push(
      "Velocity-oriented process changes are paused until quality SLOs recover. To proceed, either:",
    );
    lines.push(
      "- land a `process:quality` / `process:incident` / `process:revert` PR that returns the signal to 🟢, **or**",
    );
    lines.push(
      `- remove the \`${GUARDED_LABEL}\` label if this PR is not a velocity-oriented process change.`,
    );
  }

  if (snapshotHeading) {
    lines.push("");
    lines.push(`Snapshot read: \`${snapshotHeading}\`.`);
  }
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(args) {
  const out = { velocityFile: ".squad/velocity.md", labels: [], selfTest: false };
  for (const a of args) {
    if (a === "--self-test") out.selfTest = true;
    else if (a.startsWith("--velocity-file=")) out.velocityFile = a.slice("--velocity-file=".length);
    else if (a.startsWith("--labels=")) {
      out.labels = a
        .slice("--labels=".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return out;
}

function runCli() {
  const args = parseArgs(argv.slice(2));

  if (args.selfTest) {
    return runSelfTest();
  }

  let text = "";
  if (existsSync(args.velocityFile)) {
    text = readFileSync(args.velocityFile, "utf8");
  } else {
    // Treat a missing velocity file like "no panel found" — never a failure.
    stdout.write(
      `warn: velocity file not found at ${args.velocityFile}; treating as no-panel.\n`,
    );
  }

  const panel = text ? parseQualitySloPanel(text) : null;
  const result = evaluateBrake(panel, args.labels);
  const summary = renderJobSummary(result);

  stdout.write(summary + "\n");
  if (env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, summary + "\n");
    } catch (err) {
      stdout.write(`warn: could not append to GITHUB_STEP_SUMMARY: ${err.message}\n`);
    }
  }

  if (result.decision === "fail") exit(1);
  exit(0);
}

// ---------------------------------------------------------------------------
// Self-test (fixtures cover all acceptance criteria)
// ---------------------------------------------------------------------------

function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`assertion failed: ${message}\n  expected: ${e}\n  actual:   ${a}`);
  }
}

const FIXTURE_RED = `# Squad Velocity

## Snapshot · 2026-04-20

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 35.0% | ≤ 20.0% | 🔴 breached |
| Zapp rejected rate | n/a | ≤ 5.0% | 🟡 insufficient-data |
| Revert rate | 0.0% | ≤ 2.0% | 🟢 on-target |

### Sample notes
- rows: 11
`;

const FIXTURE_GREEN = `# Squad Velocity

## Snapshot · 2026-04-20

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 0.0% | ≤ 20.0% | 🟢 on-target |
| Zapp rejected rate | n/a | ≤ 5.0% | 🟡 insufficient-data |
| Revert rate | n/a | ≤ 2.0% | 🟡 insufficient-data |
`;

const FIXTURE_NO_PANEL = `# Squad Velocity

## Snapshot · 2026-04-20

### Weekly throughput
| Week ending | Merged PRs |
| --- | ---: |
| 2026-04-20 | 11 |
`;

const FIXTURE_MULTI_SNAPSHOT = `# Squad Velocity

## Snapshot · 2026-04-27

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 10.0% | ≤ 20.0% | 🟢 on-target |

---

## Snapshot · 2026-04-20

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 35.0% | ≤ 20.0% | 🔴 breached |
`;

function runSelfTest() {
  let failures = 0;
  const tests = [];

  function test(name, fn) {
    try {
      fn();
      tests.push({ name, ok: true });
    } catch (err) {
      tests.push({ name, ok: false, err });
      failures++;
    }
  }

  // Parser tests
  test("parses red panel rows", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    assertEqual(panel.rows.length, 3, "expected 3 data rows");
    assertEqual(panel.rows[0][0], "Rework rate", "row 0 signal");
    assertEqual(classifyStatus(panel.rows[0][3]), "red", "row 0 red");
    assertEqual(classifyStatus(panel.rows[1][3]), "yellow", "row 1 yellow");
    assertEqual(classifyStatus(panel.rows[2][3]), "green", "row 2 green");
    assertEqual(panel.snapshotHeading, "Snapshot · 2026-04-20", "snapshot");
  });

  test("parses green panel (no red)", () => {
    const panel = parseQualitySloPanel(FIXTURE_GREEN);
    assertEqual(panel.rows.length, 3, "expected 3 data rows");
    const reds = panel.rows.filter((r) => classifyStatus(r[3]) === "red");
    assertEqual(reds.length, 0, "no red rows expected");
  });

  test("returns null when panel heading absent", () => {
    const panel = parseQualitySloPanel(FIXTURE_NO_PANEL);
    assertEqual(panel, null, "no panel found");
  });

  test("uses newest (first) snapshot when multiple present", () => {
    const panel = parseQualitySloPanel(FIXTURE_MULTI_SNAPSHOT);
    assertEqual(panel.rows.length, 1, "only newest panel's rows");
    assertEqual(classifyStatus(panel.rows[0][3]), "green", "newest panel is green");
  });

  // classifyStatus edge cases
  test("classifyStatus handles text variants", () => {
    assertEqual(classifyStatus("🔴 breached"), "red", "emoji red");
    assertEqual(classifyStatus("red"), "red", "literal red");
    assertEqual(classifyStatus("BREACHED"), "red", "literal breached uppercase");
    assertEqual(classifyStatus("🟡 insufficient-data"), "yellow", "yellow");
    assertEqual(classifyStatus("🟢 on-target"), "green", "green");
    assertEqual(classifyStatus("unknown"), "unknown", "unknown");
  });

  // Acceptance-criteria scenarios
  test("AC1: process:velocity + red SLO → fail", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:velocity", "type:feat"]);
    assertEqual(result.decision, "fail", "decision");
    assertEqual(result.redRows.length, 1, "one red row reported");
    assertEqual(result.redRows[0].signal, "Rework rate", "signal name");
  });

  test("AC2a: process:quality bypasses even with red", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:velocity", "process:quality"]);
    assertEqual(result.decision, "bypass", "decision");
    assertEqual(result.reason, "bypass: process:quality", "reason");
  });

  test("AC2b: process:incident bypasses even with red", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:velocity", "process:incident"]);
    assertEqual(result.decision, "bypass", "decision");
    assertEqual(result.reason, "bypass: process:incident", "reason");
  });

  test("AC2c: process:revert bypasses even with red", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:velocity", "process:revert"]);
    assertEqual(result.decision, "bypass", "decision");
  });

  test("AC3: non-process PR is skipped regardless of SLOs", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["type:feat", "squad:bender"]);
    assertEqual(result.decision, "skip", "decision");
  });

  test("AC3b: PR with only non-velocity process labels is skipped", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:quality"]);
    assertEqual(result.decision, "skip", "decision");
  });

  test("process:velocity + green SLOs → pass", () => {
    const panel = parseQualitySloPanel(FIXTURE_GREEN);
    const result = evaluateBrake(panel, ["process:velocity"]);
    assertEqual(result.decision, "pass", "decision");
  });

  test("process:velocity + missing panel → pass with note", () => {
    const panel = parseQualitySloPanel(FIXTURE_NO_PANEL);
    const result = evaluateBrake(panel, ["process:velocity"]);
    assertEqual(result.decision, "pass", "decision");
  });

  test("AC4: brake message mentions bypass labels and signal", () => {
    const panel = parseQualitySloPanel(FIXTURE_RED);
    const result = evaluateBrake(panel, ["process:velocity"]);
    const summary = renderJobSummary(result);
    if (!summary.includes("Review-gate safety brake engaged")) {
      throw new Error("summary missing brake-engaged header");
    }
    if (!summary.includes("process:quality")) throw new Error("summary missing process:quality bypass hint");
    if (!summary.includes("process:incident")) throw new Error("summary missing process:incident bypass hint");
    if (!summary.includes("process:revert")) throw new Error("summary missing process:revert bypass hint");
    if (!summary.includes("Rework rate")) throw new Error("summary missing signal name");
  });

  // Output
  for (const t of tests) {
    if (t.ok) {
      stdout.write(`  ok  ${t.name}\n`);
    } else {
      stdout.write(`  FAIL  ${t.name}\n    ${t.err.message}\n`);
    }
  }
  stdout.write(`\n${tests.length - failures}/${tests.length} passed\n`);
  exit(failures === 0 ? 0 : 1);
}

// Only run the CLI when invoked directly, so unit tests can import the
// exports above without side effects.
const invokedDirectly = argv[1] && fileURLToPath(import.meta.url) === argv[1];
if (invokedDirectly) {
  runCli();
}
