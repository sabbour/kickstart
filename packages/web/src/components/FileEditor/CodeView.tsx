import React, { useCallback, useMemo, useState } from 'react';
import type { VirtualFile } from '../../services/virtual-fs';
import { sanitizeHtml } from '../../utils/sanitize';
import { DiagramPreview } from './DiagramPreview';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bashLang from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bashLang);
hljs.registerLanguage('shell', bashLang);
hljs.registerLanguage('sh', bashLang);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('go', go);

interface CodeViewProps {
  file?: VirtualFile;
}

function isMermaidFile(file: VirtualFile): boolean {
  const ext = file.path.split('.').pop()?.toLowerCase();
  return ext === 'mmd' || ext === 'mermaid' || file.language === 'mermaid';
}

export function CodeView({ file }: CodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [diagramTab, setDiagramTab] = useState<'preview' | 'source'>('preview');

  const handleCopy = useCallback(async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = file.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [file]);

  const handleDownload = useCallback(() => {
    if (!file) return;
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.path.split('/').pop() ?? 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [file]);

  if (!file) {
    return (
      <div className="code-view code-view-empty">
        <div className="code-view-placeholder">
          <span className="code-view-placeholder-icon">📄</span>
          <span>Select a file to view its contents</span>
        </div>
      </div>
    );
  }

  const isGenerating = file.status === 'generating';
  const isDiagram = isMermaidFile(file);

  const highlightedHtml = useMemo(() => {
    try {
      if (file.language && hljs.getLanguage(file.language)) {
        return hljs.highlight(file.content, { language: file.language }).value;
      }
      return hljs.highlightAuto(file.content).value;
    } catch {
      return escapeHtml(file.content);
    }
  }, [file.content, file.language]);

  const highlightedLines = highlightedHtml.split('\n');

  return (
    <div className={`code-view${isGenerating ? ' generating' : ''}`}>
      <div className="code-view-header">
        <div className="code-view-file-info">
          <span className="code-view-filename">{file.path}</span>
          <span className="code-view-lang-badge">{file.language}</span>
        </div>
        <div className="code-view-actions">
          {isDiagram && (
            <>
              <button
                className={`code-view-btn${diagramTab === 'preview' ? ' active' : ''}`}
                onClick={() => setDiagramTab('preview')}
                title="Show diagram preview"
                type="button"
              >
                ⬡ Preview
              </button>
              <button
                className={`code-view-btn${diagramTab === 'source' ? ' active' : ''}`}
                onClick={() => setDiagramTab('source')}
                title="Show source code"
                type="button"
              >
                {'</>'} Source
              </button>
            </>
          )}
          <button
            className="code-view-btn"
            onClick={handleCopy}
            title="Copy to clipboard"
            type="button"
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
          <button
            className="code-view-btn"
            onClick={handleDownload}
            title="Download file"
            type="button"
          >
            ⬇ Download
          </button>
        </div>
      </div>

      {isDiagram && diagramTab === 'preview' ? (
        <div className="code-view-body code-view-diagram-body">
          <DiagramPreview content={file.content} />
        </div>
      ) : (
        <div className="code-view-body">
          <pre className="code-view-pre">
            <code className="hljs">
              {highlightedLines.map((lineHtml, i) => (
                <div key={i} className="code-line">
                  <span className="code-line-number">{i + 1}</span>
                  <span className="code-line-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(lineHtml) }} />
                </div>
              ))}
            </code>
          </pre>
        </div>
      )}

      {isGenerating && (
        <div className="code-view-generating">
          <span className="generating-dot" />
          Generating…
        </div>
      )}
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
