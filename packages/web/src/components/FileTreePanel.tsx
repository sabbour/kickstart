/**
 * FileTreePanel — persistent file browser backed by VirtualFSContext (IndexedDB).
 *
 * Renders a hierarchical file tree with collapsible directories. Clicking a file
 * opens it in a Monaco-powered code view. Toolbar provides copy, download single
 * file, download-all ZIP, and delete actions.
 *
 * Users can create new files and import files. Monaco editor is writable with
 * debounced IndexedDB persistence.
 */

import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Body1Strong,
  Button,
  Caption1,
  Card,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Tooltip,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import {
  AddRegular,
  ArrowDownloadRegular,
  ArrowUploadRegular,
  CopyRegular,
  DeleteRegular,
  DocumentRegular,
  FolderOpenRegular,
  FolderRegular,
  ChevronDownRegular,
  ChevronRightRegular,
} from '@fluentui/react-icons';
import { useVirtualFS } from '../contexts/VirtualFSContext';
import type { FileTreeNode, VFSFile } from '../services/virtual-fs';
import { VFSError } from '../services/virtual-fs';
import { ensureMonacoLocal } from '../catalog/components/monaco-local-setup';
import { sanitizeHtml } from '../utils/sanitize';
import { normalizePath, validatePath } from '../utils/path-validation';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import bash from 'highlight.js/lib/languages/bash';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('bash', bash);

const MonacoEditor = lazy(() =>
  import('@monaco-editor/react').then((mod) => ({ default: mod.default }))
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
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
  headerActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
  },
  treeContainer: {
    flex: '0 0 auto',
    maxHeight: '40%',
    overflowY: 'auto',
    overflowX: 'hidden',
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
  },
  treeNode: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingTop: '3px',
    paddingBottom: '3px',
    paddingRight: tokens.spacingHorizontalS,
    cursor: 'pointer',
    ...shorthands.border('0'),
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase200,
    width: '100%',
    textAlign: 'left' as const,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  treeNodeSelected: {
    backgroundColor: tokens.colorNeutralBackground1Selected,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Selected,
    },
  },
  treeIcon: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  treeName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  codeContainer: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  codeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
  },
  codeFileInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    overflow: 'hidden',
  },
  codeActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  codeBody: {
    flex: '1 1 auto',
    minHeight: 0,
    overflow: 'auto',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  codeView: {
    margin: '0',
    padding: tokens.spacingHorizontalM,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    lineHeight: '18px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
  },
  monacoLoading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingHorizontalL,
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: '32px',
    opacity: 0.5,
  },
  emptyActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  langBadge: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground4,
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusMedium,
  },
  errorBar: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
    marginLeft: tokens.spacingHorizontalS,
    marginRight: tokens.spacingHorizontalS,
  },
});

// ---------------------------------------------------------------------------
// Tree node component
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: FileTreeNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}) {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(depth < 2);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((prev) => !prev);
    } else {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  const isSelected = !node.isDirectory && node.path === selectedPath;

  const DirIcon = node.isDirectory
    ? expanded ? FolderOpenRegular : FolderRegular
    : DocumentRegular;
  const ChevronIcon = node.isDirectory
    ? expanded ? ChevronDownRegular : ChevronRightRegular
    : null;

  return (
    <>
      <button
        className={`${classes.treeNode} ${isSelected ? classes.treeNodeSelected : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        title={node.path}
        type="button"
        role="treeitem"
        aria-expanded={node.isDirectory ? expanded : undefined}
        aria-level={depth + 1}
        aria-selected={isSelected}
      >
        {ChevronIcon && (
          <span className={classes.treeIcon}>
            <ChevronIcon fontSize={12} />
          </span>
        )}
        {!ChevronIcon && <span style={{ width: 12 }} />}
        <span className={classes.treeIcon}>
          <DirIcon fontSize={16} />
        </span>
        <span className={classes.treeName}>{node.name}</span>
      </button>
      {node.isDirectory && expanded && (
        <div role="group">
          {node.children?.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface FileTreePanelProps {
  onOpenFile?: (path: string, content: string) => void;
}

/** Map our language names to Monaco language IDs. */
function toMonacoLanguage(lang: string | undefined): string | undefined {
  if (!lang) return undefined;
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', yml: 'yaml',
    sh: 'bash', shell: 'bash',
  };
  return map[lang] ?? lang;
}

export function FileTreePanel({ onOpenFile }: FileTreePanelProps) {
  const classes = useStyles();
  const { fs, files, tree } = useVirtualFS();
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [selectedFile, setSelectedFile] = useState<VFSFile | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Monaco setup
  const [monacoReady, setMonacoReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    Promise.resolve(ensureMonacoLocal())
      .then(() => { if (!disposed) setMonacoReady(true); })
      .catch(() => { if (!disposed) setMonacoReady(false); });
    return () => { disposed = true; };
  }, []);

  const handleSelectFile = useCallback(
    async (path: string) => {
      try {
        const file = await fs.getFile(path);
        setSelectedPath(path);
        setSelectedFile(file);
        onOpenFile?.(path, file.content);
      } catch {
        // file may have been deleted
      }
    },
    [fs, onOpenFile],
  );

  // Re-fetch selected file when files change (content may have updated)
  useEffect(() => {
    if (selectedPath && files.includes(selectedPath)) {
      fs.getFile(selectedPath).then(setSelectedFile).catch(() => {
        setSelectedPath(undefined);
        setSelectedFile(null);
      });
    } else if (selectedPath && !files.includes(selectedPath)) {
      setSelectedPath(undefined);
      setSelectedFile(null);
    }
  }, [fs, files, selectedPath]);

  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup copy timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (!selectedFile) return;
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-secure contexts
      const ta = document.createElement('textarea');
      ta.value = selectedFile.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }, [selectedFile]);

  const handleDownloadFile = useCallback(() => {
    if (!selectedFile) return;
    const blob = new Blob([selectedFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.path.split('/').pop() ?? 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleDownloadAll = useCallback(async () => {
    if (files.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await fs.exportZip();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'kickstart-files.zip';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [fs, files.length, isDownloading]);

  const handleDeleteFile = useCallback(async () => {
    if (!selectedPath) return;
    await fs.deleteFile(selectedPath);
    setSelectedPath(undefined);
    setSelectedFile(null);
  }, [fs, selectedPath]);

  // Highlight code for read-only fallback view
  const highlightedCode = useMemo(() => {
    if (!selectedFile) return '';
    try {
      if (selectedFile.language && hljs.getLanguage(selectedFile.language)) {
        return hljs.highlight(selectedFile.content, { language: selectedFile.language }).value;
      }
      return hljs.highlightAuto(selectedFile.content).value;
    } catch {
      return escapeHtml(selectedFile.content);
    }
  }, [selectedFile]);

  if (files.length === 0) return null;

  return (
    <Card className={classes.root}>
      {/* Header */}
      <div className={classes.header}>
        <Body1Strong>Files ({files.length})</Body1Strong>
        <div className={classes.headerActions}>
          <Tooltip content="Download all as ZIP" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              onClick={handleDownloadAll}
              disabled={isDownloading || files.length === 0}
            />
          </Tooltip>
        </div>
      </div>

      {/* Tree */}
      <div className={classes.treeContainer} role="tree" aria-label="File tree">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        ))}
      </div>

      {/* Code view */}
      <div className={classes.codeContainer}>
        {selectedFile ? (
          <>
            <div className={classes.codeHeader}>
              <div className={classes.codeFileInfo}>
                <Caption1>{selectedFile.path}</Caption1>
                <span className={classes.langBadge}>{selectedFile.language}</span>
              </div>
              <div className={classes.codeActions}>
                <Tooltip content={copied ? 'Copied!' : 'Copy'} relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<CopyRegular />}
                    onClick={handleCopy}
                  />
                </Tooltip>
                <Tooltip content="Download file" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<ArrowDownloadRegular />}
                    onClick={handleDownloadFile}
                  />
                </Tooltip>
                <Tooltip content="Delete file" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<DeleteRegular />}
                    onClick={handleDeleteFile}
                  />
                </Tooltip>
              </div>
            </div>
            <div className={classes.codeBody}>
              {monacoReady ? (
                <Suspense
                  fallback={
                    <div className={classes.monacoLoading}>
                      <Spinner size="small" label="Loading editor…" />
                    </div>
                  }
                >
                  <MonacoEditor
                    height="100%"
                    language={toMonacoLanguage(selectedFile.language)}
                    value={selectedFile.content}
                    options={{
                      readOnly: true,
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
                <pre className={classes.codeView}>
                  <code dangerouslySetInnerHTML={{ __html: sanitizeHtml(highlightedCode) }} />
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className={classes.empty}>
            <DocumentRegular className={classes.emptyIcon} />
            <Caption1>Select a file to view</Caption1>
          </div>
        )}
      </div>
    </Card>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
