/**
 * @module FileViewer
 *
 * Right-side panel that displays the content of a selected file with
 * syntax highlighting (via highlight.js), a language badge, and
 * copy / download / delete actions.
 */

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Button,
  Badge,
  Text,
  Spinner,
  mergeClasses,
} from '@fluentui/react-components';
import {
  CopyRegular,
  ArrowDownloadRegular,
  DeleteRegular,
  DismissRegular,
} from '@fluentui/react-icons';
import hljs from 'highlight.js/lib/core';

// Register common languages
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import dockerfile from 'highlight.js/lib/languages/dockerfile';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('dockerfile', dockerfile);

import type { VirtualFile, VFSFile } from '../../services/virtual-fs';
import type { VirtualFS } from '../../services/virtual-fs';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '45%',
    minWidth: '320px',
    maxWidth: '55%',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderLeft(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    overflow: 'hidden',
  },
  rootFill: {
    width: '100%',
    minWidth: '0',
    maxWidth: 'none',
    flex: 1,
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    overflow: 'hidden',
    flex: 1,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  fileName: {
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  codeWrapper: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    ...shorthands.margin(0),
    ...shorthands.padding(tokens.spacingVerticalS, '0'),
  },
  codePre: {
    ...shorthands.margin(0),
    ...shorthands.padding(0),
    fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '20px',
    tabSize: '2',
  },
  codeLine: {
    display: 'flex',
    minHeight: '20px',
    paddingRight: tokens.spacingHorizontalM,
    ':hover': {
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
  },
  lineNumber: {
    display: 'inline-block',
    width: '48px',
    paddingRight: tokens.spacingHorizontalM,
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
  generating: {
    animationName: {
      '0%': { opacity: 0.5 },
      '50%': { opacity: 1 },
      '100%': { opacity: 0.5 },
    },
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: tokens.colorNeutralForeground3,
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const LANG_DISPLAY: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  python: 'Python',
  json: 'JSON',
  yaml: 'YAML',
  xml: 'XML',
  html: 'HTML',
  css: 'CSS',
  markdown: 'Markdown',
  bash: 'Bash',
  shell: 'Shell',
  sql: 'SQL',
  go: 'Go',
  rust: 'Rust',
  java: 'Java',
  csharp: 'C#',
  dockerfile: 'Dockerfile',
  plaintext: 'Text',
};

function highlightCode(content: string, language: string): string {
  try {
    if (hljs.getLanguage(language)) {
      return hljs.highlight(content, { language }).value;
    }
  } catch {
    // fall through
  }
  return hljs.highlightAuto(content).value;
}

function downloadFile(path: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() ?? 'file';
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export interface FileViewerProps {
  /** Path of the file to display. */
  filePath: string | undefined;
  /** In-memory streaming files for real-time lookup. */
  streamingFiles: VirtualFile[];
  /** The IndexedDB-backed VirtualFS for persisted file lookup. */
  vfs: VirtualFS;
  /** Called when the user deletes the file. */
  onDeleteFile?: (path: string) => void;
  /** Called to close the viewer. */
  onDismiss: () => void;
  /**
   * If true, fill the entire available width of the parent container
   * instead of using the default 45%/55% chat-side-panel sizing.
   * Use this when FileViewer is the sole content of its container
   * (e.g. the Playground Workspace tab).
   */
  fillContainer?: boolean;
}

export function FileViewer({
  filePath,
  streamingFiles,
  vfs,
  onDeleteFile,
  onDismiss,
  fillContainer = false,
}: FileViewerProps) {
  const styles = useStyles();
  const [copied, setCopied] = useState(false);

  // Try streaming (in-memory) first
  const streamingFile = useMemo(
    () => (filePath ? streamingFiles.find((f) => f.path === filePath) : undefined),
    [filePath, streamingFiles],
  );

  // Fall back to IndexedDB persisted file
  const [persistedFile, setPersistedFile] = useState<VFSFile | undefined>();
  useEffect(() => {
    if (!filePath || streamingFile) {
      setPersistedFile(undefined);
      return;
    }
    let cancelled = false;
    vfs.getFile(filePath).then((f) => {
      if (!cancelled) setPersistedFile(f);
    }).catch(() => {
      if (!cancelled) setPersistedFile(undefined);
    });
    return () => { cancelled = true; };
  }, [filePath, streamingFile, vfs]);

  const file = streamingFile ?? persistedFile;
  const isGenerating = streamingFile?.status === 'generating';
  const language = file?.language ?? 'plaintext';
  const content = file?.content ?? '';
  const fileName = filePath?.split('/').pop() ?? '';

  const highlightedLines = useMemo(
    () => (content ? highlightCode(content, language).split('\n') : []),
    [content, language],
  );

  const handleCopy = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  }, [content]);

  const handleDownload = useCallback(() => {
    if (filePath && content) downloadFile(filePath, content);
  }, [filePath, content]);

  const handleDelete = useCallback(() => {
    if (filePath && onDeleteFile) onDeleteFile(filePath);
  }, [filePath, onDeleteFile]);

  if (!filePath) {
    return (
      <div className={mergeClasses(styles.root, fillContainer && styles.rootFill)} data-testid="file-viewer">
        <div className={styles.empty}>
          <Text size={200}>Select a file to view</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={mergeClasses(styles.root, fillContainer && styles.rootFill)} data-testid="file-viewer">
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Text className={styles.fileName} size={300} title={filePath}>
            {fileName}
          </Text>
          <Badge appearance="outline" size="small">
            {LANG_DISPLAY[language] ?? language}
          </Badge>
          {isGenerating && <Spinner size="tiny" label="Generating…" />}
        </div>
        <div className={styles.headerActions}>
          <Button
            appearance="subtle"
            size="small"
            icon={<CopyRegular />}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            onClick={handleCopy}
          />
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowDownloadRegular />}
            title="Download file"
            onClick={handleDownload}
          />
          {onDeleteFile && (
            <Button
              appearance="subtle"
              size="small"
              icon={<DeleteRegular />}
              title="Delete file"
              onClick={handleDelete}
            />
          )}
          <Button
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            title="Close viewer"
            onClick={onDismiss}
          />
        </div>
      </div>

      <div className={mergeClasses(styles.codeWrapper, isGenerating && styles.generating)} data-testid="code-wrapper">
        <pre className={styles.codePre}>
          <code className="hljs">
            {highlightedLines.map((lineHtml, i) => (
              <div key={i} className={styles.codeLine}>
                <span className={styles.lineNumber}>{i + 1}</span>
                <span
                  className={styles.lineContent}
                  dangerouslySetInnerHTML={{ __html: lineHtml }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
