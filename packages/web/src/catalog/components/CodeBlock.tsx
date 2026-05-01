import React, { useState, useMemo } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Button,
  makeStyles,
} from '@fluentui/react-components';
import { CopyRegular, CheckmarkRegular } from '@fluentui/react-icons';
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

// Register highlight.js languages
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

const LANG_DISPLAY: Record<string, string> = {
  typescript: 'TYPESCRIPT', javascript: 'JAVASCRIPT', python: 'PYTHON',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', xml: 'XML', html: 'HTML',
  css: 'CSS', bash: 'BASH', shell: 'SHELL', sh: 'SHELL', sql: 'SQL',
  go: 'GO', java: 'JAVA', csharp: 'C#', dockerfile: 'DOCKERFILE',
  markdown: 'MARKDOWN', md: 'MARKDOWN', bicep: 'BICEP', ts: 'TYPESCRIPT',
  js: 'JAVASCRIPT', plaintext: 'TEXT',
};

const CodeBlockApi = {
  name: 'CodeBlock',
  schema: z.object({
    code: DynamicStringSchema,
    language: DynamicStringSchema.optional(),
    filename: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: '8px',
    marginBottom: '8px',
    width: '100%',
    overflow: 'hidden',
    borderRadius: '6px',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 16px',
    backgroundColor: '#252526',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#333333',
    minHeight: '36px',
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '0',
    overflow: 'hidden',
  },
  fileName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#cccccc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  langBadge: {
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    padding: '1px 6px',
    borderRadius: '3px',
    backgroundColor: '#0e639c',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  copyBtn: {
    color: '#aaaaaa',
    flexShrink: 0,
    ':hover': {
      color: '#ffffff',
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
  },
  codeBody: {
    overflowX: 'auto',
    padding: '8px 0',
  },
  codePre: {
    margin: '0',
    padding: '0',
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '20px',
    tabSize: '2',
  },
  codeLine: {
    display: 'flex',
    minHeight: '20px',
    padding: '0 16px 0 0',
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
  },
  lineNumber: {
    display: 'inline-block',
    width: '48px',
    paddingRight: '16px',
    textAlign: 'right' as const,
    color: '#555555',
    userSelect: 'none' as const,
    flexShrink: 0,
  },
  lineContent: {
    flex: '1',
    whiteSpace: 'pre',
    minWidth: '0',
  },
});

/**
 * Normalize literal backslash-n sequences to real newlines.
 * Server / LLM payloads sometimes include escaped newlines in code strings.
 */
function normalizeNewlines(code: string): string {
  // Only replace isolated \n (literal two-char sequence), not \\n (escaped backslash)
  return code.replace(/(?<!\\)\\n/g, '\n');
}

export const CodeBlock = createReactComponent(CodeBlockApi, ({ props }) => {
  const [copied, setCopied] = useState(false);
  const classes = useStyles();

  const normalizedCode = useMemo(
    () => (props.code ? normalizeNewlines(props.code) : ''),
    [props.code],
  );

  const highlightedLines = useMemo(() => {
    if (!normalizedCode) return [];
    try {
      let html: string;
      if (props.language && hljs.getLanguage(props.language)) {
        html = hljs.highlight(normalizedCode, { language: props.language }).value;
      } else {
        html = hljs.highlightAuto(normalizedCode).value;
      }
      return html.split('\n');
    } catch {
      return escapeHtml(normalizedCode).split('\n');
    }
  }, [normalizedCode, props.language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(normalizedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const langLabel = props.language
    ? LANG_DISPLAY[props.language.toLowerCase()] ?? props.language.toUpperCase()
    : undefined;

  return (
    <div className={classes.root} data-component="CodeBlock" data-testid="a2ui-CodeBlock">
      <div className={classes.header}>
        <div className={classes.fileInfo}>
          {props.filename && (
            <span className={classes.fileName}>{props.filename}</span>
          )}
          {langLabel && <span className={classes.langBadge}>{langLabel}</span>}
        </div>
        <Button
          appearance="subtle"
          className={classes.copyBtn}
          icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
          onClick={handleCopy}
          size="small"
          aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <div
        className={classes.codeBody}
        role="region"
        aria-label={`Code block${props.language ? `: ${props.language}` : ''}${props.filename ? ` — ${props.filename}` : ''}`}
      >
        <pre className={classes.codePre}>
          <code className="hljs">
            {highlightedLines.map((lineHtml, i) => (
              <div key={i} className={classes.codeLine}>
                <span className={classes.lineNumber}>{i + 1}</span>
                <span
                  className={classes.lineContent}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(lineHtml) }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}