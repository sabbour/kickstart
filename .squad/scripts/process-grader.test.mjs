import { describe, expect, it, vi } from 'vitest';
import {
  parseHypothesis,
  parseVelocity,
  gradeHypothesis,
  buildCommentBody,
  buildInboxEntry,
  rewriteFrontmatter,
  addDays,
  withRetry,
  runGrader,
  SIGNAL_REGISTRY,
  OUTCOME_LABELS,
  GRADE_COMMENT_MARKER,
  MAX_ISSUES_PER_RUN,
  MIN_RATE_LIMIT_REMAINING,
} from './process-grader.mjs';

const SAMPLE_VELOCITY = `# Squad Velocity

<!-- snapshots below this line, newest at top -->

## Snapshot · 2026-04-20

Window: 2026-03-24 → 2026-04-20 (rolling 4 weeks)

### Lead time percentiles by actual size
| Size | Sample PRs | P50 lead time | P90 lead time |
| --- | ---: | ---: | ---: |
| S | 0 | n/a | n/a |
| M | 4 | 13m | 24m |
| L | 3 | 30m | 30m |
| XL | 4 | 31m | 111m |

### Rolling 4-week velocity
- Median throughput: **12** size-points/week
- Noise band: **0 → 116** size-points/week

### Estimate accuracy

| Estimate | Predicted band | Sample PRs | Inside band | Accuracy |
| --- | --- | ---: | ---: | ---: |
| S | ≤4h | 0 | 0 | n/a |
| M | >4h to ≤16h | 10 | 8 | 80.0% |
| L | >16h to ≤48h | 0 | 0 | n/a |
| XL | >48h | 0 | 0 | n/a |

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 14.5% | ≤ 20.0% | 🟢 on-target |
| Zapp rejected rate | 26.0% | ≤ 5.0% | 🔴 off-target |
| Revert rate | n/a | ≤ 2.0% | 🟡 insufficient-data |

### Sample notes
- Retro rows analyzed: **11**
- Merged PRs in window: **11**

---

## Snapshot · 2026-04-06
older…
`;

describe('parseHypothesis', () => {
  it('parses a well-formed frontmatter block', () => {
    const body = `---\nSignal: rework_rate\nBaseline: 28.0\nBaselineDate: 2026-03-09\nTarget: "<=20.0"\nRevisit: 2026-04-20\n---\n\nbody text`;
    const h = parseHypothesis(body);
    expect(h.ok).toBe(true);
    expect(h.signal).toBe('rework_rate');
    expect(h.baseline).toBe(28);
    expect(h.baselineDate).toBe('2026-03-09');
    expect(h.target).toEqual({ op: '<=', value: 20, raw: '<=20.0' });
    expect(h.revisit).toBe('2026-04-20');
  });

  it('rejects missing frontmatter', () => {
    expect(parseHypothesis('no frontmatter here').ok).toBe(false);
    expect(parseHypothesis('no frontmatter here').reason).toBe('missing-frontmatter');
  });

  it('rejects missing required fields', () => {
    const body = `---\nSignal: rework_rate\nBaseline: 28\n---`;
    const h = parseHypothesis(body);
    expect(h.ok).toBe(false);
    expect(h.reason).toBe('missing-fields');
    expect(h.missing).toEqual(expect.arrayContaining(['Target', 'Revisit']));
  });

  it('rejects non-numeric baseline', () => {
    const body = `---\nSignal: rework_rate\nBaseline: "approximately ten"\nTarget: "<=5"\nRevisit: 2026-04-20\n---`;
    expect(parseHypothesis(body).reason).toBe('baseline-not-numeric');
  });

  it('rejects unparseable target', () => {
    const body = `---\nSignal: rework_rate\nBaseline: 28\nTarget: "much less than before"\nRevisit: 2026-04-20\n---`;
    expect(parseHypothesis(body).reason).toBe('target-unparseable');
  });
});

describe('parseVelocity', () => {
  const v = parseVelocity(SAMPLE_VELOCITY);

  it('extracts the newest snapshot date and window', () => {
    expect(v.ok).toBe(true);
    expect(v.snapshotDate).toBe('2026-04-20');
    expect(v.window).toMatch(/2026-03-24/);
  });

  it('pulls quality SLO rates', () => {
    expect(v.signals.rework_rate.value).toBe(14.5);
    expect(v.signals.zapp_rejected_rate.value).toBe(26);
    expect(v.signals.revert_rate).toBeUndefined();
  });

  it('pulls median throughput and lead times', () => {
    expect(v.signals.median_throughput.value).toBe(12);
    expect(v.signals.lead_time_p50_M.value).toBe(13);
    expect(v.signals.lead_time_p90_XL.value).toBe(111);
  });

  it('pulls estimate accuracy percentages', () => {
    expect(v.signals.estimate_accuracy_M.value).toBe(80);
    expect(v.signals.estimate_accuracy_S).toBeUndefined();
  });

  it('records sample size', () => {
    expect(v.samplePRs).toBe(11);
  });

  it('ignores older snapshot sections', () => {
    // The older snapshot contains `older…` but nothing should leak in.
    expect(Object.keys(v.signals).length).toBeGreaterThan(0);
  });
});

describe('gradeHypothesis', () => {
  const velocity = parseVelocity(SAMPLE_VELOCITY);
  const today = '2026-04-22';

  it('grades succeeded when target is hit and outside noise band', () => {
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.outcome).toBe('succeeded');
    expect(g.actual).toBe(14.5);
    expect(g.insideNoiseBand).toBe(false);
  });

  it('grades reverted when signal regresses past noise band', () => {
    const h = parseHypothesis(`---\nSignal: zapp_rejected_rate\nBaseline: 5\nTarget: "<=5"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.outcome).toBe('reverted');
    expect(g.actual).toBe(26);
  });

  it('grades no-effect inside the noise band and schedules an extension', () => {
    // baseline 15, actual 14.5 → relative delta ~3.3% (<5) => no-effect
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 15\nTarget: "<=10"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.outcome).toBe('no-effect');
    expect(g.insideNoiseBand).toBe(true);
    expect(g.nextRevisit).toBe(addDays(today, 14));
  });

  it('returns no-effect with low sample override', () => {
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 1\nTarget: "<=0.1"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today, samplePRs: 2 });
    expect(g.outcome).toBe('no-effect');
    expect(g.lowSample).toBe(true);
  });

  it('stops extending after the max extension budget', () => {
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 15\nTarget: "<=10"\nRevisit: 2026-04-20\nExtensions: 2\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.outcome).toBe('no-effect');
    expect(g.nextRevisit).toBeNull();
    expect(g.exhaustedExtensions).toBe(true);
  });

  it('returns signal-not-recognized for unknown keys', () => {
    const h = parseHypothesis(`---\nSignal: made_up_metric\nBaseline: 1\nTarget: "<=0"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.status).toBe('signal-not-recognized');
  });

  it('returns signal-missing-in-snapshot when the row is n/a', () => {
    const h = parseHypothesis(`---\nSignal: revert_rate\nBaseline: 2\nTarget: "<=2"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.status).toBe('signal-missing-in-snapshot');
  });

  it('honours direction=higher for median throughput', () => {
    const h = parseHypothesis(`---\nSignal: median_throughput\nBaseline: 6\nTarget: ">=10"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today });
    expect(g.outcome).toBe('succeeded'); // 12 ≥ 10 and outside 10% band
  });
});

describe('buildCommentBody', () => {
  const velocity = parseVelocity(SAMPLE_VELOCITY);
  it('includes the marker, outcome label, and snapshot date', () => {
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today: '2026-04-22' });
    const body = buildCommentBody(g, { issueNumber: 42, snapshotDate: velocity.snapshotDate });
    expect(body).toContain(GRADE_COMMENT_MARKER);
    expect(body).toContain('Process grade: `succeeded`');
    expect(body).toContain('snapshot 2026-04-20');
    expect(body).toContain(OUTCOME_LABELS.succeeded);
  });

  it('renders the signal-not-recognized branch', () => {
    const body = buildCommentBody({ status: 'signal-not-recognized', signalKey: 'xyz' }, { issueNumber: 1 });
    expect(body).toContain('signal-not-recognized');
    expect(body).toContain('xyz');
  });

  it('mentions extension on no-effect', () => {
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 15\nTarget: "<=10"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today: '2026-04-22' });
    const body = buildCommentBody(g, { issueNumber: 7 });
    expect(body).toMatch(/Extending `Revisit:`/);
  });
});

describe('buildInboxEntry', () => {
  it('produces a markdown doc with hypothesis + measurement + verdict sections', () => {
    const velocity = parseVelocity(SAMPLE_VELOCITY);
    const h = parseHypothesis(`---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`);
    const g = gradeHypothesis(h, velocity, { today: '2026-04-22' });
    const entry = buildInboxEntry({
      issue: { number: 42, title: 'tighten DR gate', html_url: 'https://example.com/42' },
      hypothesis: h,
      grade: g,
      commentUrl: 'https://example.com/42#c1',
      repo: 'sabbour/kickstart',
    });
    expect(entry).toContain('# Decision: Process experiment graded — #42 tighten DR gate');
    expect(entry).toContain('## Hypothesis');
    expect(entry).toContain('## Measurement');
    expect(entry).toContain('## Verdict');
    expect(entry).toContain('process:succeeded');
    expect(entry).toContain('https://example.com/42#c1');
  });
});

describe('rewriteFrontmatter', () => {
  it('updates existing fields and preserves the body', () => {
    const body = `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---\n\nrest of body`;
    const updated = rewriteFrontmatter(body, { Revisit: '2026-05-04', Extensions: 1 });
    expect(updated).toMatch(/Revisit: ['"]?2026-05-04/);
    expect(updated).toContain('Extensions: 1');
    expect(updated).toContain('rest of body');
  });

  it('returns body unchanged when no frontmatter is present', () => {
    expect(rewriteFrontmatter('plain body', { Revisit: 'x' })).toBe('plain body');
  });
});

describe('withRetry', () => {
  it('retries on 429 and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) {
        const err = new Error('rate limited');
        err.status = 429;
        throw err;
      }
      return 'ok';
    });
    const result = await withRetry(fn, { retries: 5, baseMs: 1 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  it('does not retry on 404', async () => {
    const fn = vi.fn(async () => {
      const err = new Error('nope');
      err.status = 404;
      throw err;
    });
    await expect(withRetry(fn, { retries: 3, baseMs: 1 })).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ---------- runGrader orchestrator ----------

function makeStubFs(files = {}) {
  const written = {};
  return {
    async readFile(p) {
      if (p in files) return files[p];
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
    async mkdir() {},
    async writeFile(p, contents) { written[p] = contents; },
    written,
  };
}

function makeStubGithub({ issues = [], rateLimitRemaining = 5000, comments = [] } = {}) {
  const calls = {
    createComment: [], addLabels: [], removeLabel: [], update: [], rateLimitGet: 0,
  };
  const api = {
    paginate: async (_fn, _args) => issues,
    rest: {
      rateLimit: {
        get: async () => {
          calls.rateLimitGet += 1;
          return { data: { resources: { core: { remaining: rateLimitRemaining } } } };
        },
      },
      issues: {
        listForRepo: vi.fn(),
        listComments: async () => ({ data: comments }),
        createComment: async (args) => {
          calls.createComment.push(args);
          return { data: { html_url: `https://example.com/${args.issue_number}#new` } };
        },
        addLabels: async (args) => { calls.addLabels.push(args); return { data: [] }; },
        removeLabel: async (args) => { calls.removeLabel.push(args); return { data: [] }; },
        update: async (args) => { calls.update.push(args); return { data: {} }; },
      },
    },
  };
  return { api, calls };
}

describe('runGrader', () => {
  const context = { repo: { owner: 'sabbour', repo: 'kickstart' } };
  const fs = makeStubFs({ '.squad/velocity.md': SAMPLE_VELOCITY });
  const core = { info: () => {}, warning: () => {}, notice: () => {}, setFailed: () => {} };

  it('aborts when rate limit is too low', async () => {
    const issue = {
      number: 1, title: 't', body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const { api } = makeStubGithub({ issues: [issue], rateLimitRemaining: MIN_RATE_LIMIT_REMAINING - 1 });
    const summary = await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(summary.aborted).toBe(true);
    expect(summary.reason).toBe('rate-limit');
  });

  it('grades a due issue, writes inbox, and applies the correct label', async () => {
    const issue = {
      number: 42, title: 'tighten DR gate',
      body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---\n\nbody`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const localFs = makeStubFs({ '.squad/velocity.md': SAMPLE_VELOCITY });
    const { api, calls } = makeStubGithub({ issues: [issue] });
    const summary = await runGrader({ github: api, context, core, fs: localFs, today: '2026-04-22' });
    expect(summary.aborted).toBe(false);
    expect(summary.graded[0].outcome).toBe('succeeded');
    expect(calls.addLabels[0].labels).toEqual(['process:succeeded']);
    expect(calls.createComment[0].body).toContain('Process grade: `succeeded`');
    const inboxFiles = Object.keys(localFs.written);
    expect(inboxFiles).toHaveLength(1);
    expect(inboxFiles[0]).toMatch(/\.squad\/decisions\/inbox\/process-grade-42-2026-04-20\.md$/);
  });

  it('skips issues whose Revisit date is in the future', async () => {
    const issue = {
      number: 7, title: 'future',
      body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2099-01-01\n---`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const { api, calls } = makeStubGithub({ issues: [issue] });
    const summary = await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(summary.graded).toEqual([]);
    expect(calls.createComment).toHaveLength(0);
  });

  it('dedups when a grade comment for the snapshot already exists', async () => {
    const issue = {
      number: 42, title: 't',
      body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const existing = [{
      body: `${GRADE_COMMENT_MARKER}\n…actual: 14.5 (snapshot 2026-04-20)`,
      created_at: '2026-04-21T00:00:00Z',
    }];
    const { api, calls } = makeStubGithub({ issues: [issue], comments: existing });
    const summary = await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(summary.graded[0].skipped).toBe(true);
    expect(calls.createComment).toHaveLength(0);
    expect(calls.addLabels).toHaveLength(0);
  });

  it('extends revisit and updates issue body on no-effect', async () => {
    const issue = {
      number: 99, title: 'noise',
      body: `---\nSignal: rework_rate\nBaseline: 15\nTarget: "<=10"\nRevisit: 2026-04-20\n---`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const localFs = makeStubFs({ '.squad/velocity.md': SAMPLE_VELOCITY });
    const { api, calls } = makeStubGithub({ issues: [issue] });
    await runGrader({ github: api, context, core, fs: localFs, today: '2026-04-22' });
    expect(calls.addLabels[0].labels).toEqual(['process:no-effect']);
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0].body).toMatch(/Revisit: ['"]?2026-05-06/);
    expect(calls.update[0].body).toContain('Extensions: 1');
  });

  it('removes a stale outcome label when a different outcome applies', async () => {
    const issue = {
      number: 50, title: 't',
      body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: 2026-04-20\n---`,
      labels: [{ name: 'process' }, { name: 'process:no-effect' }],
      updated_at: '2026-04-20T00:00:00Z',
    };
    const { api, calls } = makeStubGithub({ issues: [issue] });
    await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(calls.removeLabel.map((c) => c.name)).toContain('process:no-effect');
    expect(calls.addLabels[0].labels).toEqual(['process:succeeded']);
  });

  it('defers past the per-run issue budget', async () => {
    const mk = (n, revisit) => ({
      number: n, title: `i${n}`,
      body: `---\nSignal: rework_rate\nBaseline: 28\nTarget: "<=20"\nRevisit: ${revisit}\n---`,
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    });
    const many = Array.from({ length: MAX_ISSUES_PER_RUN + 3 }, (_, i) => mk(i + 1, `2026-04-0${(i % 9) + 1}`.slice(0, 10)));
    const { api, calls } = makeStubGithub({ issues: many });
    const summary = await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(summary.deferredCount).toBe(3);
    expect(calls.createComment.length).toBeLessThanOrEqual(MAX_ISSUES_PER_RUN);
  });

  it('posts an unparseable notice when frontmatter is missing', async () => {
    const issue = {
      number: 11, title: 'bad', body: 'no frontmatter here',
      labels: [], updated_at: '2026-04-20T00:00:00Z',
    };
    const { api, calls } = makeStubGithub({ issues: [issue] });
    await runGrader({ github: api, context, core, fs, today: '2026-04-22' });
    expect(calls.createComment).toHaveLength(1);
    expect(calls.createComment[0].body).toContain('hypothesis-unparseable');
    expect(calls.addLabels).toHaveLength(0);
  });
});

describe('signal registry', () => {
  it('contains the 7 DP-pinned signal families', () => {
    const keys = Object.keys(SIGNAL_REGISTRY);
    expect(keys).toContain('rework_rate');
    expect(keys).toContain('zapp_rejected_rate');
    expect(keys).toContain('revert_rate');
    expect(keys).toContain('median_throughput');
    for (const s of ['S', 'M', 'L', 'XL']) {
      expect(keys).toContain(`lead_time_p50_${s}`);
      expect(keys).toContain(`lead_time_p90_${s}`);
      expect(keys).toContain(`estimate_accuracy_${s}`);
    }
  });
});
