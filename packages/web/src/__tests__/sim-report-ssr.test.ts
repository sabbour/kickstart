/**
 * sim-report-ssr.test.ts
 *
 * SSR-renders SimReport into a standalone HTML file at reports/sim-report.html.
 * Run automatically by `npm run run-sims` after the probe writes sim-report-data.json.
 * Run standalone with: npx vitest run packages/web/src/__tests__/sim-report-ssr.test.ts
 *
 * Uses the same Fluent UI mock strategy as chat-ui.test.ts so hooks that rely
 * on Fluent context don't trip "Invalid hook call" under Node's SSR environment.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it, vi, expect } from 'vitest';

// ── Mock Fluent UI (same pattern as chat-ui.test.ts) ─────────────────────────
vi.mock('@fluentui/react-components', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fluentui/react-components');
  const passthrough = (tag: string) =>
    ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) =>
      React.createElement(tag, rest as Record<string, unknown>, children);
  const stubs: Record<string, unknown> = { ...actual };
  for (const key of Object.keys(actual)) {
    const val = actual[key];
    if (/^[A-Z]/.test(key) && (typeof val === 'function' || typeof val === 'object')) {
      stubs[key] = passthrough('div');
    }
  }
  // makeStyles returns the style key itself as the class name — targetable via CSS
  stubs.makeStyles = (styles: Record<string, unknown>) => () =>
    Object.fromEntries(Object.keys(styles).map((k) => [k, k])) as Record<string, string>;
  stubs.tokens = new Proxy({}, { get: () => '' });
  return stubs;
});

vi.mock('@fluentui/react-icons', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@fluentui/react-icons');
  const iconStub = () => React.createElement('span', { 'data-icon': true });
  const stubs: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    const val = actual[key];
    if (/^[A-Z]/.test(key) && (typeof val === 'function' || typeof val === 'object')) {
      stubs[key] = iconStub;
    } else {
      stubs[key] = val;
    }
  }
  return stubs;
});

vi.mock('../contexts/DebugContext', () => ({
  useDebug: () => ({ debugEnabled: false, toggleDebug: () => {}, setDebugEnabled: () => {}, actionLog: [], logAction: () => {}, clearActionLog: () => {} }),
}));

vi.mock('monaco-editor', () => ({ editor: {}, languages: {}, Uri: {} }));
vi.mock('@monaco-editor/react', () => ({ default: () => null }));
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({ default: class {} }));
vi.mock('monaco-editor/esm/vs/language/json/json.worker?worker', () => ({ default: class {} }));
vi.mock('monaco-editor/esm/vs/language/css/css.worker?worker', () => ({ default: class {} }));
vi.mock('monaco-editor/esm/vs/language/html/html.worker?worker', () => ({ default: class {} }));
vi.mock('monaco-editor/esm/vs/language/typescript/ts.worker?worker', () => ({ default: class {} }));

// Pack-core client components use the ROOT react while react-dom/server (local to packages/web)
// sets its dispatcher on the packages/web react instance — different objects → "Invalid hook call".
// Skip pack component registration for SSR; A2UI surfaces will fall back to BASIC_FUNCTIONS.
vi.mock('../bootstrap/registerPackComponents', () => ({
  registerPackComponents: () => {},
}));

// Dynamic imports AFTER mocks are registered
const { SimReport } = await import('../pages/SimReport');

// ── Report CSS ────────────────────────────────────────────────────────────────
// Targets class names produced by the makeStyles mock (key → "key" class name)
// and provides a complete dark-mode stylesheet for the rendered HTML.
const REPORT_CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
       background: #0f1117; color: #e2e8f0; line-height: 1.6; height: 100vh; overflow: hidden; }

/* ── Layout ── */
.root { display: flex; height: 100vh; background: #0f1117; }

/* ── Sidebar ── */
.sidebar { width: 220px; flex-shrink: 0; background: #161b22;
           border-right: 1px solid #21262d; display: flex; flex-direction: column;
           padding: 16px 0; overflow-y: auto; }
.sidebarTitle { padding: 0 16px 12px; color: #8b949e; font-size: 11px; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.06em; }
.simTab { display: flex; flex-direction: column; padding: 10px 16px; cursor: pointer;
          border-left: 3px solid transparent; transition: background 0.1s; }
.simTab:hover { background: #1c2128; }
.simTabActive { background: #1c2128 !important; border-left-color: #58a6ff !important; }
.simTabId { font-size: 12px; font-weight: 600; color: #e6edf3; font-family: monospace; }
.simTabTitle { font-size: 11px; color: #8b949e; margin-top: 2px; }

/* ── Badge (Fluent mocked to div — add back basic badge styles) ── */
[color="success"] { display: inline-block; background: #1a3a2a; color: #3fb950;
                    border: 1px solid #2ea043; border-radius: 10px;
                    font-size: 10px; padding: 1px 6px; }
[color="warning"] { display: inline-block; background: #3a2d1a; color: #d29922;
                    border: 1px solid #9e6a03; border-radius: 10px;
                    font-size: 10px; padding: 1px 6px; }
[color="danger"]  { display: inline-block; background: #3a1a1a; color: #f85149;
                    border: 1px solid #da3633; border-radius: 10px;
                    font-size: 10px; padding: 1px 6px; }

/* ── Main content ── */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.simHeader { padding: 16px 24px; background: #161b22; border-bottom: 1px solid #21262d;
             flex-shrink: 0; }
.simHeader > div:first-child { font-size: 16px; font-weight: 600; color: #e6edf3; }
.simOpener { color: #8b949e; font-style: italic; font-size: 13px; margin-top: 4px; }
.simMeta   { color: #6e7681; font-size: 11px; margin-top: 4px; }

/* ── Chat scroll area ── */
.chat { flex: 1; overflow-y: auto; padding: 24px;
        display: flex; flex-direction: column; gap: 16px; }

/* ── Message rows ── */
.messageRow  { display: flex; flex-direction: column; gap: 4px; }
.messageUser  { align-self: flex-end; align-items: flex-end; max-width: 70%; }
.messageAgent { align-self: flex-start; align-items: flex-start; max-width: 80%; }

.agentLabel { display: flex; align-items: center; gap: 6px;
              font-size: 11px; font-weight: 600; text-transform: uppercase;
              letter-spacing: 0.05em; margin-bottom: 4px; padding-left: 4px; }
.bubbleUser  { background: #1c2128; border: 1px solid #30363d; border-radius: 12px 12px 4px 12px;
               padding: 10px 14px; font-size: 14px; color: #e6edf3;
               white-space: pre-wrap; word-break: break-word; }
.bubbleAgent { background: #161b22; border: 1px solid #21262d; border-left-width: 3px;
               border-radius: 4px 12px 12px 12px; padding: 12px 16px; font-size: 14px;
               color: #e6edf3; white-space: pre-wrap; word-break: break-word; min-width: 280px; }
.turnNum  { font-size: 10px; color: #6e7681; margin-bottom: 2px; }
.agentText { margin-bottom: 6px; color: #e6edf3; }

/* ── Tool calls ── */
.toolRow  { align-self: center; display: flex; align-items: center; gap: 6px;
            flex-wrap: wrap; padding: 6px 10px; background: #161b22;
            border: 1px solid #21262d; border-radius: 8px; cursor: pointer; max-width: 80%; }
.toolChip { font-family: monospace; font-size: 11px; background: #0f1117;
            border: 1px solid #30363d; border-radius: 10px;
            padding: 2px 8px; color: #79c0ff; }

/* ── Handoff banner ── */
.handoffBanner { align-self: center; display: flex; align-items: center; gap: 8px;
                 padding: 6px 16px; border: 1px dashed #30363d; border-radius: 8px;
                 font-size: 12px; color: #8b949e; }

/* ── D1 warning ── */
.d1Warning { background: #3a1a1a; border: 1px solid #da3633; border-radius: 6px;
             padding: 6px 10px; font-size: 12px; color: #f85149;
             margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }

/* ── Actions row ── */
.actionsRow  { margin-top: 10px; padding-top: 8px; border-top: 1px solid #21262d;
               display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.actionChip  { font-family: monospace; font-size: 11px; background: #1a1a2e;
               border: 1px solid #30363d; border-radius: 10px;
               padding: 2px 8px; color: #c084fc; }

/* ── A2UI rendered surfaces ── */
.a2ui-surface, [data-surface] { margin-top: 8px; }

/* Icons (mocked to <span data-icon>) */
[data-icon] { display: inline-block; width: 14px; height: 14px;
              background: currentColor; mask: none; vertical-align: middle; opacity: 0.7; }
`;

// ── Test ─────────────────────────────────────────────────────────────────────

describe('SimReport SSR', () => {
  it('renders sim-report-data.json to reports/sim-report.html', () => {
    const dataPath = path.join(process.cwd(), 'packages', 'web', 'public', 'sim-report-data.json');

    if (!fs.existsSync(dataPath)) {
      console.warn('[ssr] sim-report-data.json not found — run npm run run-sims first');
      return;
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    // renderToString runs useMemo synchronously — surfaces are pre-populated before render
    const bodyHtml = renderToString(
      React.createElement(SimReport as React.FC<{ initialData: unknown }>, { initialData: data }),
    );

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sim Report — ${ts}</title>
<style>${REPORT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

    const outDir = path.join(process.cwd(), 'reports');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'sim-report.html');
    fs.writeFileSync(outFile, html, 'utf8');

    console.log(`[ssr] Report written → ${outFile}`);
    expect(fs.existsSync(outFile)).toBe(true);
  });
});
