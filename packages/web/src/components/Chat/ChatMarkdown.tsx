import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { sanitizeHtml } from '../../utils/sanitize';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
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
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('go', go);

const CHAT_LANG_DISPLAY: Record<string, string> = {
  typescript: 'TYPESCRIPT', javascript: 'JAVASCRIPT', python: 'PYTHON',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML',
  css: 'CSS', bash: 'BASH', shell: 'SHELL', sh: 'SHELL', sql: 'SQL',
  go: 'GO', java: 'JAVA', csharp: 'C#', dockerfile: 'DOCKERFILE',
  markdown: 'MARKDOWN', md: 'MARKDOWN', bicep: 'BICEP', ts: 'TYPESCRIPT',
  js: 'JAVASCRIPT', plaintext: 'TEXT',
};

interface ChatMarkdownProps {
  content: string;
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ node, ...props }) => (
          <a {...props} target="_blank" rel="noopener noreferrer" />
        ),
        code: ({ node, className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          const isInline = !className;
          const codeStr = String(children).replace(/\n$/, '');

          if (isInline) {
            return <code {...props}>{children}</code>;
          }

          return <HighlightedBlock code={codeStr} language={language} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function HighlightedBlock({ code, language }: { code: string; language: string }) {
  const html = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return escapeHtml(code);
    }
  }, [code, language]);

  const lines = html.split('\n');
  const langLabel = language
    ? (CHAT_LANG_DISPLAY[language.toLowerCase()] ?? language.toUpperCase())
    : undefined;

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      borderRadius: '6px',
      overflow: 'hidden',
      margin: '8px 0',
    }}>
      {langLabel && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '4px 12px',
          backgroundColor: '#252526',
          borderBottom: '1px solid #333333',
          minHeight: '28px',
        }}>
          <span style={{
            fontSize: '10px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            padding: '1px 6px',
            borderRadius: '3px',
            backgroundColor: '#0e639c',
            color: '#ffffff',
          }}>
            {langLabel}
          </span>
        </div>
      )}
      <div style={{ overflow: 'auto', padding: '8px 0' }}>
        <pre style={{
          margin: 0,
          padding: 0,
          fontFamily: '"Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '20px',
          tabSize: 2,
        }}>
          <code className="hljs">
            {lines.map((lineHtml, i) => (
              <div key={i} style={{
                display: 'flex',
                minHeight: '20px',
                paddingRight: '16px',
              }}>
                <span style={{
                  display: 'inline-block',
                  width: '48px',
                  paddingRight: '16px',
                  textAlign: 'right',
                  color: '#555555',
                  userSelect: 'none',
                  flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                <span
                  style={{ flex: 1, whiteSpace: 'pre', minWidth: 0 }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(lineHtml) }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
