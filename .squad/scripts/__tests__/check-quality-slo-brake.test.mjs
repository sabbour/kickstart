import { describe, it, expect } from 'vitest';
import {
  parseQualitySloPanel,
  classifyStatus,
  evaluateBrake,
} from '../check-quality-slo-brake.mjs';

describe('check-quality-slo-brake', () => {
  describe('parseQualitySloPanel', () => {
    it('parses a velocity.md snapshot with red signals', () => {
      const text = `# Squad Velocity

## Snapshot · 2026-04-20

### Quality SLO panel
| Signal | Actual | Target | Status |
| --- | ---: | ---: | --- |
| Rework rate | 35.0% | ≤ 20.0% | 🔴 breached |
| Zapp rejected rate | n/a | ≤ 5.0% | 🟡 insufficient-data |
| Revert rate | 0.0% | ≤ 2.0% | 🟢 on-target |
`;
      const panel = parseQualitySloPanel(text);
      expect(panel).not.toBeNull();
      expect(panel.rows).toHaveLength(3);
      expect(panel.rows[0][0]).toBe('Rework rate');
      expect(panel.snapshotHeading).toBe('Snapshot · 2026-04-20');
    });

    it('returns null when Quality SLO panel is absent', () => {
      const text = `# Squad Velocity

## Snapshot · 2026-04-20

### Weekly throughput
| Week ending | Merged PRs |
| --- | ---: |
| 2026-04-20 | 11 |
`;
      const panel = parseQualitySloPanel(text);
      expect(panel).toBeNull();
    });

    it('uses the newest (first) snapshot when multiple are present', () => {
      const text = `# Squad Velocity

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
      const panel = parseQualitySloPanel(text);
      expect(panel).not.toBeNull();
      expect(panel.rows).toHaveLength(1);
      expect(classifyStatus(panel.rows[0][3])).toBe('green');
      expect(panel.snapshotHeading).toBe('Snapshot · 2026-04-27');
    });
  });

  describe('classifyStatus', () => {
    it('detects red signals by emoji or text', () => {
      expect(classifyStatus('🔴 breached')).toBe('red');
      expect(classifyStatus('red')).toBe('red');
      expect(classifyStatus('BREACHED')).toBe('red');
    });

    it('detects yellow signals', () => {
      expect(classifyStatus('🟡 insufficient-data')).toBe('yellow');
    });

    it('detects green signals', () => {
      expect(classifyStatus('🟢 on-target')).toBe('green');
    });

    it('returns unknown for unrecognized status', () => {
      expect(classifyStatus('unknown')).toBe('unknown');
    });
  });

  describe('evaluateBrake', () => {
    const redPanel = {
      rows: [
        ['Rework rate', '35.0%', '≤ 20.0%', '🔴 breached'],
        ['Zapp rejected rate', 'n/a', '≤ 5.0%', '🟡 insufficient-data'],
        ['Revert rate', '0.0%', '≤ 2.0%', '🟢 on-target'],
      ],
      snapshotHeading: 'Snapshot · 2026-04-20',
    };

    const greenPanel = {
      rows: [
        ['Rework rate', '10.0%', '≤ 20.0%', '🟢 on-target'],
        ['Zapp rejected rate', 'n/a', '≤ 5.0%', '🟡 insufficient-data'],
      ],
      snapshotHeading: 'Snapshot · 2026-04-27',
    };

    it('AC1: process:velocity + red SLO → fail', () => {
      const result = evaluateBrake(redPanel, [
        'process:velocity',
        'type:feat',
      ]);
      expect(result.decision).toBe('fail');
      expect(result.redRows).toHaveLength(1);
      expect(result.redRows[0].signal).toBe('Rework rate');
    });

    it('AC2a: process:quality bypasses even with red SLOs', () => {
      const result = evaluateBrake(redPanel, [
        'process:velocity',
        'process:quality',
      ]);
      expect(result.decision).toBe('bypass');
      expect(result.reason).toBe('bypass: process:quality');
    });

    it('AC2b: process:incident bypasses even with red SLOs', () => {
      const result = evaluateBrake(redPanel, [
        'process:velocity',
        'process:incident',
      ]);
      expect(result.decision).toBe('bypass');
    });

    it('AC2c: process:revert bypasses even with red SLOs', () => {
      const result = evaluateBrake(redPanel, [
        'process:velocity',
        'process:revert',
      ]);
      expect(result.decision).toBe('bypass');
    });

    it('AC3: non-process PR is skipped regardless of SLOs', () => {
      const result = evaluateBrake(redPanel, ['type:feat', 'squad:bender']);
      expect(result.decision).toBe('skip');
      expect(result.reason).toBe('not a process:velocity PR');
    });

    it('AC3b: PR with only non-velocity process labels is skipped', () => {
      const result = evaluateBrake(redPanel, ['process:quality']);
      expect(result.decision).toBe('skip');
    });

    it('process:velocity + green SLOs → pass', () => {
      const result = evaluateBrake(greenPanel, ['process:velocity']);
      expect(result.decision).toBe('pass');
    });

    it('process:velocity + missing panel → pass with note', () => {
      const result = evaluateBrake(null, ['process:velocity']);
      expect(result.decision).toBe('pass');
      expect(result.reason).toContain('no Quality SLO panel found');
    });
  });
});
