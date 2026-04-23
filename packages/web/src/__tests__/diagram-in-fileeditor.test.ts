import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// Mock DiagramPreview so tests don't load mermaid
vi.mock('../components/FileEditor/DiagramPreview', () => ({
  DiagramPreview: ({ content }: { content: string }) =>
    React.createElement('div', { 'data-testid': 'diagram-preview', 'data-content': content }),
}));

// Mock highlight.js to avoid ESM issues in test env
vi.mock('highlight.js/lib/core', () => ({
  default: {
    registerLanguage: () => {},
    highlight: (_src: string, _opts: { language: string }) => ({ value: '' }),
    highlightAuto: (_src: string) => ({ value: '' }),
    getLanguage: (_lang: string) => true,
  },
}));
vi.mock('highlight.js/lib/languages/javascript', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/typescript', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/python', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/java', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/csharp', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/json', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/xml', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/css', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/bash', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/markdown', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/dockerfile', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/yaml', () => ({ default: {} }));
vi.mock('highlight.js/lib/languages/go', () => ({ default: {} }));
vi.mock('highlight.js/styles/github-dark.css', () => ({}));

vi.mock('../utils/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

import type { VirtualFile } from '../services/virtual-fs';
import { CodeView } from '../components/FileEditor/CodeView';

function makeFile(path: string, language: string, content = 'graph TD\n  A --> B'): VirtualFile {
  return { path, content, language, status: 'complete', createdAt: 0, updatedAt: 0 };
}

describe('CodeView — Mermaid diagram detection', () => {
  it('shows Preview and Source tab buttons for .mmd files', () => {
    const file = makeFile('architecture.mmd', 'mermaid');
    const html = renderToStaticMarkup(React.createElement(CodeView, { file }));
    expect(html).toContain('Preview');
    expect(html).toContain('Source');
  });

  it('renders the DiagramPreview component by default for .mmd files', () => {
    const file = makeFile('architecture.mmd', 'mermaid');
    const html = renderToStaticMarkup(React.createElement(CodeView, { file }));
    expect(html).toContain('data-testid="diagram-preview"');
  });

  it('shows Preview and Source tab buttons for .mermaid files', () => {
    const file = makeFile('flow.mermaid', 'mermaid');
    const html = renderToStaticMarkup(React.createElement(CodeView, { file }));
    expect(html).toContain('Preview');
    expect(html).toContain('Source');
  });

  it('does NOT show Preview/Source tabs for regular code files', () => {
    const file = makeFile('main.ts', 'typescript', 'const x = 1;');
    const html = renderToStaticMarkup(React.createElement(CodeView, { file }));
    expect(html).not.toContain('Preview');
    expect(html).not.toContain('Source');
  });

  it('does NOT render DiagramPreview for non-diagram files', () => {
    const file = makeFile('main.ts', 'typescript', 'const x = 1;');
    const html = renderToStaticMarkup(React.createElement(CodeView, { file }));
    expect(html).not.toContain('data-testid="diagram-preview"');
  });
});
