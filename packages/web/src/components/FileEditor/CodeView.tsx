import React, { useCallback, useState } from 'react';
import type { VirtualFile } from '../../services/virtual-fs';

interface CodeViewProps {
  file?: VirtualFile;
}

export function CodeView({ file }: CodeViewProps) {
  const [copied, setCopied] = useState(false);

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

  const lines = file.content.split('\n');
  const isGenerating = file.status === 'generating';

  return (
    <div className={`code-view${isGenerating ? ' generating' : ''}`}>
      <div className="code-view-header">
        <div className="code-view-file-info">
          <span className="code-view-filename">{file.path}</span>
          <span className="code-view-lang-badge">{file.language}</span>
        </div>
        <div className="code-view-actions">
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
      <div className="code-view-body">
        <pre className="code-view-pre">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="code-line">
                <span className="code-line-number">{i + 1}</span>
                <span className="code-line-content">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
      {isGenerating && (
        <div className="code-view-generating">
          <span className="generating-dot" />
          Generating…
        </div>
      )}
    </div>
  );
}
