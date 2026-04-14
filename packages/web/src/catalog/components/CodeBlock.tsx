import React, { useState, useMemo } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Card,
  Button,
  Body1Strong,
  Caption1,
  makeStyles,
  tokens,
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
import 'highlight.js/styles/vs.css';

// Register highlight.js languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('go', go);

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
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  codeContent: {
    padding: tokens.spacingHorizontalM,
    margin: '0',
    overflowX: 'auto',
    borderRadius: '0',
  },
  codeElement: {
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '20px',
  },
});

export const CodeBlock = createReactComponent(CodeBlockApi, ({ props }) => {
  const [copied, setCopied] = useState(false);
  const classes = useStyles();

  const highlightedCode = useMemo(() => {
    if (!props.code) return '';
    
    try {
      if (props.language) {
        const result = hljs.highlight(props.code, { language: props.language });
        return result.value;
      } else {
        const result = hljs.highlightAuto(props.code);
        return result.value;
      }
    } catch (error) {
      // If highlighting fails, HTML-escape the raw code to prevent XSS
      return escapeHtml(props.code);
    }
  }, [props.code, props.language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.code || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className={classes.root}>
      {(props.filename || props.language) && (
        <div className={classes.header}>
          <div className={classes.fileInfo}>
            {props.filename && <Body1Strong>{props.filename}</Body1Strong>}
            {props.language && (
              <Caption1>{props.language}</Caption1>
            )}
          </div>
          <Button
            appearance="subtle"
            icon={copied ? <CheckmarkRegular /> : <CopyRegular />}
            onClick={handleCopy}
            size="small"
            aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      )}
      <pre className={classes.codeContent} role="region" aria-label={`Code block${props.language ? `: ${props.language}` : ''}${props.filename ? ` — ${props.filename}` : ''}`}>
        <code className={`hljs ${classes.codeElement}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedCode) }} />
      </pre>
    </Card>
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