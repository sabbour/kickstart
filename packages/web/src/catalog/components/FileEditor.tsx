import React, { useMemo } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1Strong,
  Caption1,
  Card,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import { useArtifacts } from '../../contexts/ArtifactContext';
import { sanitizeHtml } from '../../utils/sanitize';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import yaml from 'highlight.js/lib/languages/yaml';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import 'highlight.js/styles/github.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('go', go);

const FileEditorApi = {
  name: 'FileEditor',
  schema: z.object({
    fileName: DynamicStringSchema.optional(),
    content: DynamicStringSchema.optional(),
    language: DynamicStringSchema.optional(),
    readOnly: z.boolean().optional(),
    artifactPath: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  fileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  readOnlyBadge: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground4,
    padding: `2px ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyBase,
  },
  editorWrapper: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  // Read-only: highlighted code view
  highlightView: {
    margin: '0',
    padding: tokens.spacingHorizontalM,
    overflowX: 'auto',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    lineHeight: '18px',
    backgroundColor: tokens.colorNeutralBackground1,
    maxHeight: '400px',
    overflowY: 'auto',
  },
  // Editable: plain textarea styled to look like a code editor
  textarea: {
    width: '100%',
    minHeight: '200px',
    maxHeight: '400px',
    padding: tokens.spacingHorizontalM,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    lineHeight: '18px',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    ...shorthands.borderWidth('0'),
    outlineWidth: '0',
    resize: 'vertical',
    boxSizing: 'border-box',
    display: 'block',
  },
  empty: {
    padding: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
  },
});

export const FileEditor = createReactComponent(FileEditorApi, ({ props }) => {
  const classes = useStyles();
  const { getArtifact } = useArtifacts();

  // Resolve content: artifactPath takes priority over inline content prop
  const resolvedContent = useMemo(() => {
    if (props.artifactPath) {
      const artifact = getArtifact(props.artifactPath);
      return artifact ? artifact.content : null;
    }
    return props.content ?? null;
  }, [props.artifactPath, props.content, getArtifact]);

  const resolvedFileName = props.fileName ??
    (props.artifactPath ? props.artifactPath.split('/').pop() : undefined);

  const resolvedLanguage = props.language ??
    (resolvedFileName ? inferLanguage(resolvedFileName) : undefined);

  const highlightedCode = useMemo(() => {
    if (!resolvedContent) return '';
    try {
      if (resolvedLanguage) {
        return hljs.highlight(resolvedContent, { language: resolvedLanguage }).value;
      }
      return hljs.highlightAuto(resolvedContent).value;
    } catch {
      // If highlighting fails, HTML-escape the raw content to prevent XSS
      return escapeHtml(resolvedContent);
    }
  }, [resolvedContent, resolvedLanguage]);

  const isReadOnly = props.readOnly !== false; // default to read-only

  return (
    <Card className={classes.root}>
      {(resolvedFileName || resolvedLanguage) && (
        <div className={classes.header}>
          <div className={classes.fileInfo}>
            {resolvedFileName && <Body1Strong>{resolvedFileName}</Body1Strong>}
            {resolvedLanguage && <Caption1>{resolvedLanguage}</Caption1>}
          </div>
          {isReadOnly && <span className={classes.readOnlyBadge}>read-only</span>}
        </div>
      )}
      <div className={classes.editorWrapper}>
        {resolvedContent === null ? (
          <div className={classes.empty}>
            {props.artifactPath
              ? `Artifact not found: ${props.artifactPath}`
              : 'No content provided.'}
          </div>
        ) : isReadOnly ? (
          <pre className={classes.highlightView}>
            <code dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedCode) }} />
          </pre>
        ) : (
          <textarea
            className={classes.textarea}
            defaultValue={resolvedContent}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        )}
      </div>
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

function inferLanguage(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    yaml: 'yaml', yml: 'yaml',
    json: 'json',
    html: 'html', xml: 'xml',
    sh: 'bash', bash: 'bash',
    dockerfile: 'dockerfile',
    go: 'go',
  };
  return ext ? map[ext] : undefined;
}
