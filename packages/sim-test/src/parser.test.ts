import { describe, it, expect } from 'vitest';
import { parseSimTranscript, SimParseError } from './parser.js';

const MINIMAL_VALID = `---
sim: sim-01
title: "Sam — Next.js greenfield"
agent: core.triage
description: "Single Next.js container, zero questions expected."
expected:
  toolCalls:
    ordered: false
    required:
      - name: core.emit_ui
  recipes:
    required:
      - R1
      - R17
  questionBudget:
    max: 0
  behaviors:
    - id: zero-questions
      description: "Agent routes without asking any clarifying questions"
    - id: r17-close
      description: "R17 closing card fires"
---

# Sim #1 — Sam, Next.js Greenfield

User says: "I have a Next.js app I'd like to deploy to AKS."
`;

describe('parseSimTranscript()', () => {
  it('parses a valid minimal transcript', () => {
    const result = parseSimTranscript(MINIMAL_VALID);
    expect(result.id).toBe('sim-01');
    expect(result.title).toBe('Sam — Next.js greenfield');
    expect(result.agent).toBe('core.triage');
    expect(result.description).toBe('Single Next.js container, zero questions expected.');
    expect(result.expected.toolCalls.ordered).toBe(false);
    expect(result.expected.toolCalls.required).toHaveLength(1);
    expect(result.expected.toolCalls.required[0].name).toBe('core.emit_ui');
    expect(result.expected.recipes.required).toEqual(['R1', 'R17']);
    expect(result.expected.questionBudget.max).toBe(0);
    expect(result.expected.behaviors).toHaveLength(2);
    expect(result.expected.behaviors[0].id).toBe('zero-questions');
    expect(result.expected.behaviors[1].id).toBe('r17-close');
  });

  it('accepts tool call requirements as plain strings', () => {
    const content = `---
sim: sim-x
title: "Test"
agent: core.triage
description: "Test sim"
expected:
  toolCalls:
    ordered: false
    required:
      - core.emit_ui
      - core.inspect_repo
  recipes:
    required: []
  questionBudget:
    max: 3
  behaviors: []
---

Body.
`;
    const result = parseSimTranscript(content);
    expect(result.expected.toolCalls.required).toHaveLength(2);
    expect(result.expected.toolCalls.required[0].name).toBe('core.emit_ui');
    expect(result.expected.toolCalls.required[1].name).toBe('core.inspect_repo');
  });

  it('parses ordered tool calls with position indices', () => {
    const content = `---
sim: sim-x
title: "Test"
agent: core.triage
description: "Ordered tools test"
expected:
  toolCalls:
    ordered: true
    required:
      - name: core.inspect_repo
        order: 0
      - name: core.emit_ui
        order: 1
  recipes:
    required: [R1]
  questionBudget:
    max: 1
  behaviors: []
---

Body.
`;
    const result = parseSimTranscript(content);
    expect(result.expected.toolCalls.ordered).toBe(true);
    expect(result.expected.toolCalls.required[0].order).toBe(0);
    expect(result.expected.toolCalls.required[1].order).toBe(1);
  });

  it('parses optional weights', () => {
    const content = `---
sim: sim-x
title: "Test"
agent: core.triage
description: "Weights test"
expected:
  toolCalls:
    ordered: false
    required: []
  recipes:
    required: []
  questionBudget:
    max: 3
  behaviors: []
  weights:
    toolCalls: 10
    recipes: 50
    questionBudget: 20
    behaviors: 20
---

Body.
`;
    const result = parseSimTranscript(content);
    expect(result.expected.weights?.toolCalls).toBe(10);
    expect(result.expected.weights?.recipes).toBe(50);
  });

  it('body is returned without frontmatter', () => {
    const result = parseSimTranscript(MINIMAL_VALID);
    expect(result.body).toContain('# Sim #1');
    expect(result.body).not.toContain('sim: sim-01');
  });

  it('throws SimParseError when frontmatter delimiter is missing', () => {
    expect(() => parseSimTranscript('no frontmatter here\n')).toThrow(SimParseError);
  });

  it('throws SimParseError when closing --- is absent', () => {
    expect(() => parseSimTranscript('---\nsim: sim-x\ntitle: "T"\n')).toThrow(SimParseError);
  });

  it('throws SimParseError when required string fields are missing', () => {
    const missingTitle = `---
sim: sim-x
agent: core.triage
description: "Test"
expected:
  toolCalls:
    ordered: false
    required: []
  recipes:
    required: []
  questionBudget:
    max: 0
  behaviors: []
---
Body.
`;
    expect(() => parseSimTranscript(missingTitle)).toThrow(SimParseError);
  });

  it('throws SimParseError when questionBudget.max is negative', () => {
    const badBudget = `---
sim: sim-x
title: "T"
agent: core.triage
description: "D"
expected:
  toolCalls:
    ordered: false
    required: []
  recipes:
    required: []
  questionBudget:
    max: -1
  behaviors: []
---
Body.
`;
    expect(() => parseSimTranscript(badBudget)).toThrow(SimParseError);
  });

  it('throws SimParseError when toolCalls.required is not an array', () => {
    const bad = `---
sim: sim-x
title: "T"
agent: core.triage
description: "D"
expected:
  toolCalls:
    ordered: false
    required: "core.emit_ui"
  recipes:
    required: []
  questionBudget:
    max: 0
  behaviors: []
---
Body.
`;
    expect(() => parseSimTranscript(bad)).toThrow(SimParseError);
  });

  it('handles empty required arrays gracefully', () => {
    const content = `---
sim: sim-x
title: "T"
agent: core.triage
description: "D"
expected:
  toolCalls:
    ordered: false
    required: []
  recipes:
    required: []
  questionBudget:
    max: 3
  behaviors: []
---
Body.
`;
    const result = parseSimTranscript(content);
    expect(result.expected.toolCalls.required).toHaveLength(0);
    expect(result.expected.recipes.required).toHaveLength(0);
    expect(result.expected.behaviors).toHaveLength(0);
  });
});
