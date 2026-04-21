// Process-experiment grader for issues labelled `process`.
//
// Exposes pure helpers (parseHypothesis, parseVelocity, gradeHypothesis,
// buildCommentBody, buildInboxEntry) for unit testing, plus a `runGrader`
// orchestrator invoked from `.github/workflows/squad-process-grader.yml` via
// `actions/github-script`. The orchestrator is intentionally side-effecting
// but does not depend on the filesystem except through the injected `fs`
// dependency so tests can substitute in-memory stand-ins.

import yaml from 'js-yaml';

export const MAX_ISSUES_PER_RUN = 25;
export const MIN_RATE_LIMIT_REMAINING = 200;
export const NOISE_BAND_PERCENT_REL = 5; // percent-type signals
export const NOISE_BAND_DURATION_REL = 10; // duration / throughput
export const MIN_SAMPLE_PRS = 5;
export const MAX_REVISIT_EXTENSIONS = 2;
export const REVISIT_EXTENSION_DAYS = 14;

export const OUTCOME_LABELS = {
  succeeded: 'process:succeeded',
  'no-effect': 'process:no-effect',
  reverted: 'process:reverted',
};

export const ALL_OUTCOME_LABELS = Object.values(OUTCOME_LABELS);

// Supported signal vocabulary. `kind` controls noise-band selection.
// `direction` indicates whether lower or higher values are improvements.
export const SIGNAL_REGISTRY = {
  rework_rate: { kind: 'percent', direction: 'lower', label: 'Rework rate' },
  zapp_rejected_rate: { kind: 'percent', direction: 'lower', label: 'Zapp rejected rate' },
  revert_rate: { kind: 'percent', direction: 'lower', label: 'Revert rate' },
  median_throughput: { kind: 'throughput', direction: 'higher', label: 'Median throughput' },
};
for (const size of ['S', 'M', 'L', 'XL']) {
  SIGNAL_REGISTRY[`lead_time_p50_${size}`] = {
    kind: 'duration', direction: 'lower', label: `Lead time P50 (${size})`,
  };
  SIGNAL_REGISTRY[`lead_time_p90_${size}`] = {
    kind: 'duration', direction: 'lower', label: `Lead time P90 (${size})`,
  };
  SIGNAL_REGISTRY[`estimate_accuracy_${size}`] = {
    kind: 'percent', direction: 'higher', label: `Estimate accuracy (${size})`,
  };
}

// ---------- frontmatter / hypothesis ----------

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function parseHypothesis(body) {
  if (!body || typeof body !== 'string') {
    return { ok: false, reason: 'no-body' };
  }
  const match = body.match(FRONTMATTER_RE);
  if (!match) return { ok: false, reason: 'missing-frontmatter' };
  let doc;
  try {
    doc = yaml.load(match[1]);
  } catch (err) {
    return { ok: false, reason: 'yaml-parse-error', error: String(err.message || err) };
  }
  if (!doc || typeof doc !== 'object') {
    return { ok: false, reason: 'frontmatter-not-object' };
  }
  const required = ['Signal', 'Baseline', 'Target', 'Revisit'];
  const missing = required.filter((k) => doc[k] === undefined || doc[k] === null || doc[k] === '');
  if (missing.length) return { ok: false, reason: 'missing-fields', missing };

  const baselineText = String(doc.Baseline).trim();
  const baselineMatch = baselineText.match(/-?\d+(?:\.\d+)?/);
  const baseline = baselineMatch ? Number(baselineMatch[0]) : NaN;
  if (!Number.isFinite(baseline)) return { ok: false, reason: 'baseline-not-numeric' };

  const target = parseTarget(doc.Target);
  if (!target) return { ok: false, reason: 'target-unparseable' };

  const revisit = normalizeDate(doc.Revisit);
  if (!revisit) return { ok: false, reason: 'revisit-not-date' };

  const baselineDate = doc.BaselineDate ? normalizeDate(doc.BaselineDate) : null;

  return {
    ok: true,
    signal: String(doc.Signal).trim(),
    baseline,
    baselineDate,
    target,
    revisit,
    extensions: Number.isFinite(Number(doc.Extensions)) ? Number(doc.Extensions) : 0,
    raw: doc,
  };
}

function parseTarget(value) {
  const text = String(value).trim();
  const m = text.match(/^(<=|>=|<|>|=)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  return { op: m[1] || '<=', value: Number(m[2]), raw: text };
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// ---------- velocity parsing ----------

// Returns the signals pulled from the newest snapshot block. Snapshots are
// separated by `## Snapshot · YYYY-MM-DD` headers, newest first.
export function parseVelocity(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return { ok: false, reason: 'empty' };
  }
  const headerRe = /^## Snapshot · (\d{4}-\d{2}-\d{2})/m;
  const match = markdown.match(headerRe);
  if (!match) return { ok: false, reason: 'no-snapshot' };
  const snapshotDate = match[1];
  const start = match.index;
  const rest = markdown.slice(start);
  const nextIdx = rest.slice(1).search(/^## Snapshot · /m);
  const snapshot = nextIdx === -1 ? rest : rest.slice(0, nextIdx + 1);

  const window = (snapshot.match(/Window:\s*([^\n]+)/) || [])[1]?.trim() || null;

  const signals = {};
  // Quality SLO table rows like: | Rework rate | 0.0% | ≤ 20.0% | 🟢 ... |
  const sloRe = /\|\s*([A-Za-z ]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  for (const row of snapshot.matchAll(sloRe)) {
    const name = row[1].trim();
    const actual = parsePercent(row[2]);
    if (actual == null) continue;
    if (/^Rework rate$/i.test(name)) signals.rework_rate = { value: actual };
    else if (/^Zapp rejected rate$/i.test(name)) signals.zapp_rejected_rate = { value: actual };
    else if (/^Revert rate$/i.test(name)) signals.revert_rate = { value: actual };
  }

  // Median throughput line: "- Median throughput: **0** size-points/week"
  const medianMatch = snapshot.match(/Median throughput:\s*\*\*([\d.]+)\*\*/i);
  if (medianMatch) signals.median_throughput = { value: Number(medianMatch[1]) };

  // Lead time percentile table: | S | 0 | n/a | n/a |
  const leadSection = snapshot.split(/### Lead time percentiles[^\n]*/i)[1] || '';
  const leadTableEnd = leadSection.search(/\n### /);
  const leadTable = leadTableEnd === -1 ? leadSection : leadSection.slice(0, leadTableEnd);
  const leadRowRe = /\|\s*(S|M|L|XL)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
  for (const row of leadTable.matchAll(leadRowRe)) {
    const size = row[1];
    const p50 = parseDurationMinutes(row[3]);
    const p90 = parseDurationMinutes(row[4]);
    if (p50 != null) signals[`lead_time_p50_${size}`] = { value: p50, unit: 'minutes' };
    if (p90 != null) signals[`lead_time_p90_${size}`] = { value: p90, unit: 'minutes' };
  }

  // Estimate accuracy table: | S | ≤4h | 0 | 0 | n/a |
  const estSection = snapshot.split(/### Estimate accuracy[^\n]*/i)[1] || '';
  const estEnd = estSection.search(/\n### /);
  const estTable = estEnd === -1 ? estSection : estSection.slice(0, estEnd);
  const estRowRe = /\|\s*(S|M|L|XL)\s*\|[^|]*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|/g;
  for (const row of estTable.matchAll(estRowRe)) {
    const size = row[1];
    const acc = parsePercent(row[4]);
    if (acc != null) signals[`estimate_accuracy_${size}`] = { value: acc };
  }

  // Sample size
  const sampleMatch = snapshot.match(/Merged PRs in window:\s*\*\*(\d+)\*\*/i);
  const samplePRs = sampleMatch ? Number(sampleMatch[1]) : null;

  return { ok: true, snapshotDate, window, signals, samplePRs };
}

function parsePercent(text) {
  const t = String(text).trim();
  if (/n\/a/i.test(t)) return null;
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*%?/);
  if (!m) return null;
  return Number(m[1]);
}

function parseDurationMinutes(text) {
  const t = String(text).trim();
  if (/n\/a/i.test(t)) return null;
  // Accept "13m", "2h", "1h30m", "90"
  const h = t.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = t.match(/(\d+(?:\.\d+)?)\s*m/);
  if (h || m) return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  const raw = Number(t);
  return Number.isFinite(raw) ? raw : null;
}

// ---------- grading ----------

export function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isDue(revisit, today) {
  return revisit <= today;
}

function hitsTarget({ op, value }, actual, direction) {
  switch (op) {
    case '<': return actual < value;
    case '<=': return actual <= value;
    case '>': return actual > value;
    case '>=': return actual >= value;
    case '=': return actual === value;
    default: return direction === 'lower' ? actual <= value : actual >= value;
  }
}

function isWorse(baseline, actual, direction) {
  if (direction === 'lower') return actual > baseline;
  return actual < baseline;
}

export function gradeHypothesis(hypothesis, velocity, { today, samplePRs } = {}) {
  const signalKey = hypothesis.signal;
  const signalMeta = SIGNAL_REGISTRY[signalKey];
  if (!signalMeta) {
    return { status: 'signal-not-recognized', signalKey };
  }
  const actualEntry = velocity.signals[signalKey];
  if (!actualEntry || actualEntry.value == null) {
    return { status: 'signal-missing-in-snapshot', signalKey };
  }

  const baseline = hypothesis.baseline;
  const target = hypothesis.target;
  const actual = actualEntry.value;
  const deltaAbs = actual - baseline;
  const deltaPctRel = baseline !== 0 ? (deltaAbs / Math.abs(baseline)) * 100 : (actual === 0 ? 0 : Infinity);

  const noiseBand = signalMeta.kind === 'percent' ? NOISE_BAND_PERCENT_REL : NOISE_BAND_DURATION_REL;
  const effectiveSample = samplePRs ?? velocity.samplePRs ?? null;
  const lowSample = effectiveSample != null && effectiveSample < MIN_SAMPLE_PRS;
  const insideNoiseBand = Math.abs(deltaPctRel) < noiseBand;

  const onTarget = hitsTarget(target, actual, signalMeta.direction);
  const worseThanBaseline = isWorse(baseline, actual, signalMeta.direction);

  let outcome;
  if (insideNoiseBand || lowSample) outcome = 'no-effect';
  else if (onTarget) outcome = 'succeeded';
  else if (worseThanBaseline) outcome = 'reverted';
  else outcome = 'no-effect';

  const extensionsUsed = hypothesis.extensions || 0;
  const canExtend = outcome === 'no-effect' && extensionsUsed < MAX_REVISIT_EXTENSIONS;
  const nextRevisit = canExtend ? addDays(today, REVISIT_EXTENSION_DAYS) : null;
  const exhaustedExtensions = outcome === 'no-effect' && !canExtend;

  return {
    status: 'graded',
    outcome,
    signalKey,
    signalMeta,
    baseline,
    target,
    actual,
    actualDate: velocity.snapshotDate,
    baselineDate: hypothesis.baselineDate,
    deltaAbs,
    deltaPctRel,
    noiseBand,
    insideNoiseBand,
    lowSample,
    effectiveSample,
    window: velocity.window,
    nextRevisit,
    exhaustedExtensions,
    extensionsUsed,
  };
}

// ---------- comment + inbox rendering ----------

function fmt(n, digits = 1) {
  if (!Number.isFinite(n)) return 'n/a';
  return n.toFixed(digits);
}

function emojiFor(outcome) {
  return outcome === 'succeeded' ? '✅' : outcome === 'reverted' ? '🔴' : '🟡';
}

export const GRADE_COMMENT_MARKER = '<!-- squad-process-grader -->';

export function buildCommentBody(grade, { issueNumber, snapshotDate } = {}) {
  if (grade.status === 'signal-not-recognized') {
    return `${GRADE_COMMENT_MARKER}\n### 🟡 signal-not-recognized\n\nThe \`Signal: ${grade.signalKey}\` in this issue's hypothesis frontmatter does not map to any recognized row in \`.squad/velocity.md\`. Supported keys: \`${Object.keys(SIGNAL_REGISTRY).join('`, `')}\`. Skipping grade — no outcome label applied.`;
  }
  if (grade.status === 'signal-missing-in-snapshot') {
    return `${GRADE_COMMENT_MARKER}\n### 🟡 signal-not-in-snapshot\n\nSignal \`${grade.signalKey}\` is recognized but the current velocity snapshot does not report a value (likely \`n/a\` / insufficient data). Skipping grade — no outcome label applied.`;
  }
  const { outcome, signalKey, baseline, target, actual, deltaAbs, deltaPctRel, window, baselineDate, actualDate, insideNoiseBand, lowSample, effectiveSample, nextRevisit, exhaustedExtensions } = grade;
  const baselineLine = baselineDate ? `${fmt(baseline)}   (snapshot ${baselineDate})` : `${fmt(baseline)}`;
  const targetLine = `${target.op} ${fmt(target.value)}`;
  const actualLine = `${fmt(actual)}   (snapshot ${actualDate})`;
  const sign = deltaAbs >= 0 ? '+' : '';
  const deltaLine = `${sign}${fmt(deltaAbs)} (${sign}${fmt(deltaPctRel)}%)`;
  const sampleLine = effectiveSample == null ? 'sample: n/a' : `sample: ${effectiveSample} merged PRs in window`;
  const noiseLine = insideNoiseBand ? 'inside noise band' : 'outside noise band';
  const extendNote = outcome === 'no-effect' && nextRevisit
    ? `\n\n**Extending \`Revisit:\` by ${REVISIT_EXTENSION_DAYS} days → ${nextRevisit} (extension ${grade.extensionsUsed + 1}/${MAX_REVISIT_EXTENSIONS}).**`
    : exhaustedExtensions
      ? `\n\n**Revisit extensions exhausted (${grade.extensionsUsed}/${MAX_REVISIT_EXTENSIONS}). Marking as inconclusive.**`
      : '';
  return `${GRADE_COMMENT_MARKER}\n### ${emojiFor(outcome)} Process grade: \`${outcome}\`\n\n\`\`\`\nsignal:   ${signalKey}\nbaseline: ${baselineLine}\ntarget:   ${targetLine}\nactual:   ${actualLine}\ndelta:    ${deltaLine}\nwindow:   ${window || 'n/a'}\n${sampleLine}\nnoise:    ${noiseLine} (${fmt(grade.noiseBand)}% threshold)\nverdict:  ${outcome}\n\`\`\`${extendNote}\n\n<sub>Applied label \`${OUTCOME_LABELS[outcome]}\`. Scribe inbox entry: \`.squad/decisions/inbox/process-grade-${issueNumber}-${actualDate}.md\`.</sub>`;
}

export function inboxFilename(issueNumber, snapshotDate) {
  return `.squad/decisions/inbox/process-grade-${issueNumber}-${snapshotDate}.md`;
}

export function buildInboxEntry({ issue, hypothesis, grade, commentUrl, repo }) {
  const today = grade.actualDate;
  return `# Decision: Process experiment graded — #${issue.number} ${issue.title}

**Author:** Process grader workflow (bender)
**Date:** ${today}
**Status:** Graded — \`${grade.outcome}\`
**Relates to:** [#${issue.number}](${issue.html_url || `https://github.com/${repo}/issues/${issue.number}`})

## Hypothesis

\`\`\`yaml
Signal: ${hypothesis.signal}
Baseline: ${hypothesis.baseline}${hypothesis.baselineDate ? `\nBaselineDate: ${hypothesis.baselineDate}` : ''}
Target: "${hypothesis.target.raw}"
Revisit: ${hypothesis.revisit}
\`\`\`

## Measurement

- **Signal:** \`${grade.signalKey}\` (${grade.signalMeta.label}, ${grade.signalMeta.direction}-is-better)
- **Window:** ${grade.window || 'n/a'}
- **Snapshot date:** ${grade.actualDate}
- **Sample:** ${grade.effectiveSample == null ? 'n/a' : `${grade.effectiveSample} merged PRs`}
- **Baseline → Actual:** ${fmt(grade.baseline)} → ${fmt(grade.actual)} (delta ${grade.deltaAbs >= 0 ? '+' : ''}${fmt(grade.deltaAbs)}, ${fmt(grade.deltaPctRel)}% rel)
- **Target:** ${grade.target.op} ${fmt(grade.target.value)}
- **Noise band:** ±${fmt(grade.noiseBand)}% relative (${grade.insideNoiseBand ? 'inside' : 'outside'})${grade.lowSample ? ' — low sample' : ''}

## Verdict

\`${grade.outcome}\` → label \`${OUTCOME_LABELS[grade.outcome]}\`${grade.nextRevisit ? `\n\nRevisit extended to **${grade.nextRevisit}** (extension ${grade.extensionsUsed + 1}/${MAX_REVISIT_EXTENSIONS}).` : grade.exhaustedExtensions ? '\n\nRevisit extensions exhausted — experiment is inconclusive.' : ''}

## Grade comment

${commentUrl ? `[View grade comment on issue](${commentUrl})` : '(comment URL not captured)'}
`;
}

// ---------- orchestrator ----------

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(fn, { retries = 3, baseMs = 1000, logger } = {}) {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = err.status || err.response?.status;
      const retriable = status === 403 || status === 429 || status >= 500;
      if (!retriable || attempt >= retries) throw err;
      const waitMs = baseMs * Math.pow(2, attempt);
      logger?.warning?.(`API call failed (status=${status}); retrying in ${waitMs}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(waitMs);
      attempt += 1;
    }
  }
}

// Replace the YAML frontmatter in a process issue body with updated fields.
export function rewriteFrontmatter(body, patch) {
  const match = body.match(FRONTMATTER_RE);
  if (!match) return body;
  let doc = yaml.load(match[1]) || {};
  doc = { ...doc, ...patch };
  const dumped = yaml.dump(doc, { lineWidth: 120 }).trimEnd();
  return body.replace(FRONTMATTER_RE, `---\n${dumped}\n---`);
}

// Orchestrates a grading pass. Injected dependencies keep it testable.
// - `github`: octokit rest client (required)
// - `context`: `{ repo: { owner, repo } }`
// - `core`: action-core logger (info/warning/setFailed) — optional in tests
// - `fs`: node:fs/promises (required)
// - `today`: 'YYYY-MM-DD' override for determinism in tests (optional)
export async function runGrader({ github, context, core, fs, today } = {}) {
  const log = core || { info: () => {}, warning: () => {}, notice: () => {}, setFailed: (m) => { throw new Error(m); } };
  const { owner, repo } = context.repo;
  const runToday = today || new Date().toISOString().slice(0, 10);

  // Pre-flight rate limit abort.
  const { data: rl } = await withRetry(() => github.rest.rateLimit.get(), { logger: log });
  if (rl.resources.core.remaining < MIN_RATE_LIMIT_REMAINING) {
    log.warning(`Rate limit remaining ${rl.resources.core.remaining} < ${MIN_RATE_LIMIT_REMAINING}; aborting grader run.`);
    return { aborted: true, reason: 'rate-limit' };
  }

  const velocityRaw = await fs.readFile('.squad/velocity.md', 'utf8');
  const velocity = parseVelocity(velocityRaw);
  if (!velocity.ok) {
    log.warning(`Cannot parse .squad/velocity.md: ${velocity.reason}; aborting.`);
    return { aborted: true, reason: `velocity-${velocity.reason}` };
  }
  log.info(`Velocity snapshot ${velocity.snapshotDate}; ${Object.keys(velocity.signals).length} signals available.`);

  const issues = await withRetry(() =>
    github.paginate(github.rest.issues.listForRepo, {
      owner, repo, state: 'open', labels: 'process', per_page: 100,
    }), { logger: log });

  const candidates = [];
  for (const issue of issues) {
    if (issue.pull_request) continue;
    // Dedup: skip if already has a non-stale outcome label from this snapshot.
    // Per-hypothesis dedup (same snapshot date) handled via comment marker below.
    const hypothesis = parseHypothesis(issue.body || '');
    if (!hypothesis.ok) {
      candidates.push({ issue, hypothesis });
      continue;
    }
    if (!isDue(hypothesis.revisit, runToday)) continue;
    candidates.push({ issue, hypothesis });
  }

  // Oldest revisit first, bounded.
  candidates.sort((a, b) => {
    const ra = a.hypothesis.ok ? a.hypothesis.revisit : '9999-12-31';
    const rb = b.hypothesis.ok ? b.hypothesis.revisit : '9999-12-31';
    return ra.localeCompare(rb);
  });
  const toGrade = candidates.slice(0, MAX_ISSUES_PER_RUN);
  const deferred = candidates.slice(MAX_ISSUES_PER_RUN);
  if (deferred.length) log.notice(`Deferring ${deferred.length} due process issue(s) to next run (budget=${MAX_ISSUES_PER_RUN}).`);

  const results = [];
  for (const { issue, hypothesis } of toGrade) {
    try {
      const res = await gradeOne({ github, owner, repo, issue, hypothesis, velocity, runToday, fs, log });
      results.push(res);
    } catch (err) {
      log.warning(`Skipping issue #${issue.number}: ${err.message}`);
      results.push({ issueNumber: issue.number, skipped: true, error: err.message });
    }
  }
  return { aborted: false, graded: results, deferredCount: deferred.length, snapshotDate: velocity.snapshotDate };
}

async function gradeOne({ github, owner, repo, issue, hypothesis, velocity, runToday, fs, log }) {
  // Dedup — look for an existing grade comment for this snapshot date.
  const { data: comments } = await withRetry(() =>
    github.rest.issues.listComments({ owner, repo, issue_number: issue.number, per_page: 100 }),
    { logger: log });
  const graderComments = comments.filter((c) => c.body?.includes(GRADE_COMMENT_MARKER));
  const alreadyGraded = graderComments.some((c) => c.body.includes(`snapshot ${velocity.snapshotDate}`));
  if (alreadyGraded) {
    log.info(`#${issue.number}: already graded for snapshot ${velocity.snapshotDate}; skipping.`);
    return { issueNumber: issue.number, skipped: true, reason: 'dedup' };
  }

  if (!hypothesis.ok) {
    // Only post an unparseable notice if none exists newer than the last issue edit.
    const issueUpdatedAt = issue.updated_at ? new Date(issue.updated_at).getTime() : 0;
    const hasFreshNotice = graderComments.some((c) =>
      /hypothesis-unparseable|signal-not-recognized/.test(c.body || '') &&
      new Date(c.created_at).getTime() >= issueUpdatedAt);
    if (hasFreshNotice) {
      log.info(`#${issue.number}: unparseable hypothesis already flagged; skipping re-comment.`);
      return { issueNumber: issue.number, skipped: true, reason: `dedup-${hypothesis.reason}` };
    }
    const body = `${GRADE_COMMENT_MARKER}\n### 🟡 hypothesis-unparseable\n\nCould not parse the YAML frontmatter for this process experiment: \`${hypothesis.reason}\`${hypothesis.missing ? ` (missing: ${hypothesis.missing.join(', ')})` : ''}. Fix the hypothesis block and re-run \`squad-process-grader\` via workflow_dispatch.`;
    await withRetry(() => github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body }), { logger: log });
    return { issueNumber: issue.number, skipped: true, reason: hypothesis.reason };
  }

  const grade = gradeHypothesis(hypothesis, velocity, { today: runToday });
  const body = buildCommentBody(grade, { issueNumber: issue.number, snapshotDate: velocity.snapshotDate });
  const { data: created } = await withRetry(() =>
    github.rest.issues.createComment({ owner, repo, issue_number: issue.number, body }),
    { logger: log });

  if (grade.status === 'graded') {
    // Remove any stale outcome labels, then apply current outcome label.
    const existing = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l.name));
    for (const stale of ALL_OUTCOME_LABELS) {
      if (existing.includes(stale) && stale !== OUTCOME_LABELS[grade.outcome]) {
        await withRetry(() => github.rest.issues.removeLabel({ owner, repo, issue_number: issue.number, name: stale }),
          { logger: log }).catch((e) => log.warning(`removeLabel ${stale} on #${issue.number} failed: ${e.message}`));
      }
    }
    await withRetry(() => github.rest.issues.addLabels({ owner, repo, issue_number: issue.number, labels: [OUTCOME_LABELS[grade.outcome]] }),
      { logger: log });

    // Extend revisit date in-place on no-effect (if budget remains).
    if (grade.outcome === 'no-effect' && grade.nextRevisit) {
      const updatedBody = rewriteFrontmatter(issue.body || '', {
        Revisit: grade.nextRevisit,
        Extensions: (hypothesis.extensions || 0) + 1,
      });
      if (updatedBody !== issue.body) {
        await withRetry(() => github.rest.issues.update({ owner, repo, issue_number: issue.number, body: updatedBody }),
          { logger: log });
      }
    }

    // Write Scribe inbox entry.
    const entry = buildInboxEntry({ issue, hypothesis, grade, commentUrl: created.html_url, repo: `${owner}/${repo}` });
    const filename = inboxFilename(issue.number, velocity.snapshotDate);
    await fs.mkdir('.squad/decisions/inbox', { recursive: true });
    await fs.writeFile(filename, entry, 'utf8');
    log.info(`#${issue.number}: graded ${grade.outcome}; inbox=${filename}`);
    return { issueNumber: issue.number, outcome: grade.outcome, inbox: filename, commentUrl: created.html_url };
  }

  log.info(`#${issue.number}: ${grade.status}; no label applied.`);
  return { issueNumber: issue.number, skipped: true, reason: grade.status };
}
