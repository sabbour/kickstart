import { describe, it, expect } from 'vitest';
import { SimRecorder } from './recorder.js';

describe('SimRecorder', () => {
  function makeRecorder() {
    const rec = new SimRecorder();
    const write = rec.writer();
    return { rec, write };
  }

  it('records tool calls from tool_start events', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('tool_start', { toolName: 'core.emit_ui' });
    write('tool_start', { name: 'azure.get_subscriptions' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.toolCalls).toHaveLength(2);
    expect(actual.toolCalls[0].name).toBe('core.emit_ui');
    expect(actual.toolCalls[1].name).toBe('azure.get_subscriptions');
  });

  it('assigns sequential indices to tool calls', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('tool_start', { toolName: 'tool.a' });
    write('tool_start', { toolName: 'tool.b' });
    write('tool_start', { toolName: 'tool.c' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.toolCalls.map((t) => t.index)).toEqual([0, 1, 2]);
  });

  it('detects R17 recipe from a2ui "where to next" text', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('a2ui', { ops: [{ type: 'updateComponents', components: [{ text: 'Where to next?' }] }] });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.recipesEmitted.map((r) => r.recipeId)).toContain('R17');
  });

  it('detects R7 recipe from a2ui invisible-work text', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('a2ui', { content: "What I'm doing for you right now" });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.recipesEmitted.map((r) => r.recipeId)).toContain('R7');
  });

  it('detects R20 recipe from a2ui cold-start text', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('a2ui', { body: 'KEDA scale and cold start latency guidance' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.recipesEmitted.map((r) => r.recipeId)).toContain('R20');
  });

  it('counts questions in chunk text', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('chunk', { delta: 'What framework are you using? ' });
    write('chunk', { delta: 'And where is your repo?' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.questionCount).toBeGreaterThan(0);
  });

  it('reports zero-questions behaviour when no questions asked', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('chunk', { delta: 'I will deploy your app to AKS.' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.behaviorsObserved).toContain('zero-questions');
  });

  it('reports r17-close behaviour when R17 detected', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('a2ui', { text: 'where to next options' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.behaviorsObserved).toContain('r17-close');
  });

  it('does not report r17-close when R17 not detected', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('chunk', { delta: 'Deploying now.' });
    write('end', {});

    const actual = rec.toActualOutput();
    expect(actual.behaviorsObserved).not.toContain('r17-close');
  });

  it('accumulates recipes across multiple a2ui events', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('a2ui', { text: 'Here is the plan summary for your app' });
    write('a2ui', { text: 'Where to next? Choose your path.' });
    write('end', {});

    const actual = rec.toActualOutput();
    const ids = actual.recipesEmitted.map((r) => r.recipeId);
    expect(ids).toContain('R1');
    expect(ids).toContain('R17');
  });

  it('reset() clears all recorded state', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('tool_start', { toolName: 'some.tool' });
    write('a2ui', { text: 'where to next' });
    write('chunk', { delta: 'Is this right?' });
    write('end', {});

    rec.reset();
    const actual = rec.toActualOutput();

    expect(actual.toolCalls).toHaveLength(0);
    expect(actual.recipesEmitted).toHaveLength(0);
    expect(actual.questionCount).toBe(0);
    expect(actual.behaviorsObserved).toContain('zero-questions');
  });

  it('allEvents() returns all recorded events', () => {
    const { rec, write } = makeRecorder();
    write('start', {});
    write('tool_start', { toolName: 'my.tool' });
    write('end', {});

    expect(rec.allEvents()).toHaveLength(3);
    expect(rec.allEvents()[0].type).toBe('start');
    expect(rec.allEvents()[1].type).toBe('tool_start');
    expect(rec.allEvents()[2].type).toBe('end');
  });
});
