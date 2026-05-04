// Tests for copilot-instructions patching logic in init.mjs (Nibbler PR #358 concern).
// Covers readInstalledWorkflowsVersion, INSTRUCTIONS_MARKER_START_RE, and buildInstructionBlock.
import { describe, it, expect } from 'vitest';
import {
  readInstalledWorkflowsVersion,
  buildInstructionBlock,
  INSTRUCTIONS_MARKER_START_RE,
} from '../init.mjs';

describe('init.mjs — readInstalledWorkflowsVersion', () => {
  it('returns the version from a start marker with version', () => {
    const content = `<!-- squad-workflows: start v1.4.1 -->\nsome content\n<!-- squad-workflows: end -->`;
    expect(readInstalledWorkflowsVersion(content)).toBe('1.4.1');
  });

  it('returns null from a bare start marker (no version)', () => {
    const content = `<!-- squad-workflows: start -->\nsome content`;
    expect(readInstalledWorkflowsVersion(content)).toBe(null);
  });

  it('returns null when content has no squad-workflows marker', () => {
    expect(readInstalledWorkflowsVersion('# Some other file')).toBe(null);
  });

  it('returns null when content is null or undefined', () => {
    expect(readInstalledWorkflowsVersion(null)).toBe(null);
    expect(readInstalledWorkflowsVersion(undefined)).toBe(null);
  });

  it('handles flexible whitespace in the marker', () => {
    const content = `<!--  squad-workflows:  start  v2.0.0  -->`;
    expect(readInstalledWorkflowsVersion(content)).toBe('2.0.0');
  });
});

describe('init.mjs — INSTRUCTIONS_MARKER_START_RE', () => {
  it('matches versioned start marker', () => {
    expect(INSTRUCTIONS_MARKER_START_RE.test('<!-- squad-workflows: start v1.4.1 -->')).toBe(true);
  });

  it('matches bare start marker (no version)', () => {
    expect(INSTRUCTIONS_MARKER_START_RE.test('<!-- squad-workflows: start -->')).toBe(true);
  });

  it('does not match an end marker', () => {
    expect(INSTRUCTIONS_MARKER_START_RE.test('<!-- squad-workflows: end -->')).toBe(false);
  });

  it('does not match unrelated HTML comments', () => {
    expect(INSTRUCTIONS_MARKER_START_RE.test('<!-- some other comment -->')).toBe(false);
  });
});

describe('init.mjs — buildInstructionBlock', () => {
  it('returns a string containing the squad-workflows start marker', () => {
    const config = {
      designProposal: { fastLaneLabels: ['estimate:S', 'squad:chore-auto'] },
      fastLaneScope: ['changeset', 'design-proposal'],
      waves: { milestonePrefix: 'Wave', requireDemoCriteria: true, maxIssueEstimate: 'M' },
      branchModel: { base: 'dev' },
    };
    const block = buildInstructionBlock(config);
    expect(typeof block).toBe('string');
    expect(INSTRUCTIONS_MARKER_START_RE.test(block)).toBe(true);
  });

  it('block ends with the squad-workflows end marker', () => {
    const config = {
      designProposal: { fastLaneLabels: [] },
      fastLaneScope: [],
      waves: { milestonePrefix: 'Wave', requireDemoCriteria: false, maxIssueEstimate: 'M' },
      branchModel: { base: 'dev' },
    };
    const block = buildInstructionBlock(config);
    expect(block).toContain('<!-- squad-workflows: end -->');
  });
});
