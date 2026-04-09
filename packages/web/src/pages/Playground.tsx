/**
 * Playground — standalone A2UI test harness.
 *
 * Access via ?playground URL parameter.
 * Renders every A2UI scenario from demo-scenarios.ts and lets you
 * paste raw A2UI JSON for ad-hoc testing.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useA2UI } from '../hooks/useA2UI';
import { getDemoResponse, resetDemoState } from '../services/demo-scenarios';
import { A2UISurfaceWrapper } from '../components/A2UI/A2UISurfaceWrapper';
import type { A2uiMsg } from '../types';

// Keyword triggers that reliably select each demo scenario
const SCENARIO_BUTTONS: { label: string; keyword: string; description: string }[] = [
  { label: 'Welcome',          keyword: '__welcome__',  description: 'Radio group track selector' },
  { label: 'Architecture',     keyword: 'architecture', description: 'Card with architecture rows' },
  { label: 'Design Detail',    keyword: 'detail',       description: 'Tabbed service breakdown' },
  { label: 'Configure Form',   keyword: 'config',       description: 'FormGroup + ProgressSteps' },
  { label: 'Code Preview',     keyword: 'code',         description: 'CodeBlock components' },
  { label: 'File Generation',  keyword: 'generate',     description: 'File cards list' },
  { label: 'Review',           keyword: 'review',       description: 'Deploy config form' },
  { label: 'Deploy Success',   keyword: 'deploy',       description: 'ProgressSteps + endpoints' },
];

export function Playground() {
  const a2ui = useA2UI();
  const [renderedScenarios, setRenderedScenarios] = useState<string[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const customCounter = useRef(0);

  const injectScenario = useCallback((keyword: string, label: string) => {
    // Welcome is always turn 1, so reset first
    if (keyword === '__welcome__') {
      resetDemoState();
      const resp = getDemoResponse('anything');
      a2ui.processMessages(resp.a2uiMessages);
      setRenderedScenarios(prev => [...prev, label]);
      return;
    }

    // Ensure we're past turn 1 so keyword matching works
    resetDemoState();
    getDemoResponse('skip'); // burn turn 1 (WELCOME)
    const resp = getDemoResponse(keyword);
    a2ui.processMessages(resp.a2uiMessages);
    setRenderedScenarios(prev => [...prev, label]);
  }, [a2ui]);

  const injectAll = useCallback(() => {
    a2ui.reset();
    setRenderedScenarios([]);

    // Small stagger so surfaces don't collide
    SCENARIO_BUTTONS.forEach((s, i) => {
      setTimeout(() => injectScenario(s.keyword, s.label), i * 100);
    });
  }, [a2ui, injectScenario]);

  const clearAll = useCallback(() => {
    a2ui.reset();
    setRenderedScenarios([]);
    setJsonInput('');
    setJsonError('');
    resetDemoState();
  }, [a2ui]);

  const handleJsonRender = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: A2uiMsg[] = Array.isArray(parsed) ? parsed : [parsed];

      // Validate minimal shape
      for (const m of msgs) {
        if (!m.version) {
          throw new Error('Each message must have a "version" field (e.g. "v0.9")');
        }
      }

      a2ui.processMessages(msgs);
      customCounter.current++;
      setRenderedScenarios(prev => [...prev, `Custom #${customCounter.current}`]);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput, a2ui]);

  // Collect rendered surfaces
  const surfaceEntries = Array.from(a2ui.surfaces.entries());

  return (
    <div className="playground-page">
      <div className="playground-inner">
        {/* Header */}
        <div className="playground-header">
          <h1 className="playground-title">A2UI Playground</h1>
          <p className="playground-subtitle">
            Test A2UI rendering without an LLM. Click scenarios to inject surfaces, or paste raw JSON.
          </p>
          <div className="playground-badge">
            ?playground mode · {surfaceEntries.length} surface{surfaceEntries.length !== 1 ? 's' : ''} active
          </div>
        </div>

        {/* Scenario buttons */}
        <section className="playground-section">
          <h2 className="playground-section-title">Scenarios</h2>
          <div className="playground-btn-grid">
            {SCENARIO_BUTTONS.map((s) => (
              <button
                key={s.keyword}
                className="playground-scenario-btn"
                onClick={() => injectScenario(s.keyword, s.label)}
                title={s.description}
              >
                <span className="scenario-btn-label">{s.label}</span>
                <span className="scenario-btn-desc">{s.description}</span>
              </button>
            ))}
          </div>
          <div className="playground-action-row">
            <button className="playground-action-btn primary" onClick={injectAll}>
              Load All Scenarios
            </button>
            <button className="playground-action-btn" onClick={clearAll}>
              Clear All
            </button>
          </div>
        </section>

        {/* JSON editor */}
        <section className="playground-section">
          <h2 className="playground-section-title">Custom A2UI JSON</h2>
          <textarea
            className="playground-json-editor"
            value={jsonInput}
            onChange={e => setJsonInput(e.target.value)}
            placeholder={JSON.stringify([
              { version: 'v0.9', createSurface: { surfaceId: 'my-test', catalogId: 'kickstart' } },
              { version: 'v0.9', updateComponents: { surfaceId: 'my-test', components: [
                { id: 'root', component: 'Column', children: ['t1'] },
                { id: 't1', component: 'Text', text: 'Hello from the playground!', variant: 'h2' },
              ] } },
            ], null, 2)}
            rows={10}
            spellCheck={false}
          />
          {jsonError && <div className="playground-json-error">{jsonError}</div>}
          <button
            className="playground-action-btn primary"
            onClick={handleJsonRender}
            disabled={!jsonInput.trim()}
          >
            Render JSON
          </button>
        </section>

        {/* Rendered surfaces */}
        <section className="playground-section">
          <h2 className="playground-section-title">
            Rendered Surfaces ({surfaceEntries.length})
          </h2>
          {surfaceEntries.length === 0 ? (
            <div className="playground-empty">
              No surfaces yet. Click a scenario button or paste JSON above.
            </div>
          ) : (
            <div className="playground-surfaces">
              {surfaceEntries.map(([id, surface]) => (
                <div key={id} className="playground-surface-card">
                  <div className="playground-surface-header">
                    <span className="playground-surface-id">{id}</span>
                    <span className="playground-surface-catalog">
                      {renderedScenarios.find(s => id.includes(s.toLowerCase().replace(/\s/g, '-'))) || 'custom'}
                    </span>
                  </div>
                  <div className="a2ui-component">
                    <A2UISurfaceWrapper surface={surface} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Loaded log */}
        {renderedScenarios.length > 0 && (
          <section className="playground-section">
            <h2 className="playground-section-title">Activity Log</h2>
            <div className="playground-log">
              {renderedScenarios.map((s, i) => (
                <span key={i} className="playground-log-item">✓ {s}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
