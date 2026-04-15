import React, { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, type DynamicString } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1Strong,
  Caption1,
  Card,
  Spinner,
  Tab,
  TabList,
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

import { ensureMonacoLocal } from './monaco-local-setup';

// Lazy-load the Monaco Editor component (code-split by Vite automatically)
const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.default }))
);

const FileEntrySchema = z.object({
  filename: DynamicStringSchema.optional(),
  path: DynamicStringSchema.optional(),
  content: DynamicStringSchema.optional(),
  language: DynamicStringSchema.optional(),
  artifactPath: DynamicStringSchema.optional(),
});

const FileEditorApi = {
  name: 'FileEditor',
  schema: z.object({
    filename: DynamicStringSchema.optional(),
    path: DynamicStringSchema.optional(),
    content: DynamicStringSchema.optional(),
    language: DynamicStringSchema.optional(),
    readOnly: z.boolean().optional(),
    artifactPath: DynamicStringSchema.optional(),
    files: z.array(FileEntrySchema).optional(),
  }).strict(),
};

/** Map Monaco language IDs from our shorthand names */
function toMonacoLanguage(lang: string | undefined): string | undefined {
  if (!lang) return undefined;
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', yml: 'yaml',
    sh: 'bash', html: 'xml',
  };
  return map[lang] ?? lang;
}

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
  tabBar: {
    backgroundColor: tokens.colorNeutralBackground3,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
  },
  editorWrapper: {
    position: 'relative',
    backgroundColor: tokens.colorNeutralBackground1,
  },
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
  monacoLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    backgroundColor: tokens.colorNeutralBackground1,
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

  // Build the file list — multi-file mode (files prop) or single-file mode
  const fileEntries = useMemo(() => {
    if (props.files && props.files.length > 0) {
      return props.files;
    }
    // Single-file fallback
    if (props.filename || props.path || props.content || props.artifactPath) {
      return [{
        filename: props.filename ?? props.path ?? '',
        content: props.content,
        language: props.language,
        artifactPath: props.artifactPath,
      }];
    }
    return [];
  }, [props.files, props.filename, props.path, props.content, props.language, props.artifactPath]);

  const [activeTab, setActiveTab] = useState(0);
  const isMultiFile = fileEntries.length > 1;

  // Clamp active tab to valid range when file list changes
  useEffect(() => {
    if (activeTab >= fileEntries.length && fileEntries.length > 0) {
      setActiveTab(0);
    }
  }, [fileEntries.length, activeTab]);

  const activeFile = fileEntries[activeTab] ?? fileEntries[0];

  // Resolve content for the active file
  const resolvedContent = useMemo(() => {
    if (!activeFile) return null;
    const artifactPath = str(activeFile.artifactPath);
    if (artifactPath) {
      const artifact = getArtifact(artifactPath);
      return artifact ? artifact.content : null;
    }
    return str(activeFile.content) ?? null;
  }, [activeFile, getArtifact]);

  const resolvedFileName = str(activeFile?.filename) ??
    str(activeFile?.path) ??
    (activeFile?.artifactPath ? str(activeFile.artifactPath)?.split('/').pop() : undefined);

  const resolvedLanguage = str(activeFile?.language) ??
    (resolvedFileName ? inferLanguage(resolvedFileName) : undefined);

  const highlightedCode = useMemo(() => {
    if (!resolvedContent) return '';
    try {
      if (resolvedLanguage) {
        return hljs.highlight(resolvedContent, { language: resolvedLanguage }).value;
      }
      return hljs.highlightAuto(resolvedContent).value;
    } catch {
      return escapeHtml(resolvedContent);
    }
  }, [resolvedContent, resolvedLanguage]);

  const isReadOnly = props.readOnly !== false;

  // Trigger Monaco CDN config eagerly when editable mode is requested
  const [monacoReady, setMonacoReady] = useState(false);
  useEffect(() => {
    if (!isReadOnly) {
      ensureMonacoLocal();
      setMonacoReady(true);
    }
  }, [isReadOnly]);

  return (
    <Card className={classes.root}>
      {/* Tab bar for multi-file mode */}
      {isMultiFile && (
        <div className={classes.tabBar}>
          <TabList
            selectedValue={String(activeTab)}
            onTabSelect={(_, data) => setActiveTab(Number(data.value))}
            size="small"
          >
            {fileEntries.map((file, i) => {
              const label = str(file.filename) ||
                str(file.path) ||
                (file.artifactPath ? str(file.artifactPath)?.split('/').pop() : `File ${i + 1}`);
              return <Tab key={i} value={String(i)}>{label}</Tab>;
            })}
          </TabList>
        </div>
      )}

      {/* Single-file header (shown when not in multi-file tab mode) */}
      {!isMultiFile && (resolvedFileName || resolvedLanguage) && (
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
            {activeFile?.artifactPath
              ? `Artifact not found: ${activeFile.artifactPath}`
              : 'No content provided.'}
          </div>
        ) : isReadOnly ? (
          <pre className={classes.highlightView}>
            <code dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedCode) }} />
          </pre>
        ) : monacoReady ? (
          <Suspense
            fallback={
              <div className={classes.monacoLoading}>
                <Spinner size="small" label="Loading editor…" />
              </div>
            }
          >
            <MonacoEditor
              height="300px"
              language={toMonacoLanguage(resolvedLanguage)}
              value={resolvedContent}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 13,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
              }}
            />
          </Suspense>
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

/** Coerce a DynamicString to a plain string (data-binding / function-call objects resolve to ''). */
function str(value: DynamicString | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : '';
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
