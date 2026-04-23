/**
 * @module FileManagerSidebar
 *
 * Left-side collapsible sidebar that displays a unified file tree
 * combining in-memory streaming files (VirtualFileSystem) and
 * IndexedDB-backed persisted files (VirtualFS).
 *
 * Streaming files take precedence (they carry real-time generating status).
 */

import React, { useMemo, useCallback } from 'react';
import {
  makeStyles,
  tokens,
  shorthands,
  Button,
  Text,
  Spinner,
  Tooltip,
  mergeClasses,
} from '@fluentui/react-components';
import {
  FolderRegular,
  FolderOpenRegular,
  DocumentRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  DismissRegular,
  ArrowDownloadRegular,
  WindowDevTools24Regular,
  Cloud24Regular,
} from '@fluentui/react-icons';
import type { VirtualFile, VFSFile, FileTreeNode } from '../../services/virtual-fs';
import { buildFileTree } from '../../services/virtual-fs';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '260px',
    minWidth: '200px',
    maxWidth: '360px',
    height: '100%',
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.borderRight(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    overflowY: 'auto',
    overflowX: 'hidden',
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
  headerTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
  },
  treeList: {
    listStyleType: 'none',
    ...shorthands.margin(0),
    ...shorthands.padding(0),
  },
  treeItem: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingRight: tokens.spacingHorizontalS,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  treeItemSelected: {
    backgroundColor: tokens.colorNeutralBackground2Selected,
  },
  treeChevron: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    flexShrink: 0,
  },
  treeIcon: {
    display: 'flex',
    alignItems: 'center',
    marginRight: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  treeName: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
    paddingTop: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    border: '0',
    whiteSpace: 'nowrap',
  },
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Merge streaming (in-memory) and persisted (IndexedDB) files into a single
 * tree. Streaming files win when both sources have the same path.
 */
function buildMergedTree(
  streamingFiles: VirtualFile[],
  persistedFiles: VFSFile[],
): FileTreeNode[] {
  const streamingPaths = new Set(streamingFiles.map((f) => f.path));

  // Convert streaming files to VFSFile-like shape for buildFileTree
  const streamingAsVfs: VFSFile[] = streamingFiles.map((f) => ({
    path: f.path,
    content: f.content,
    language: f.language,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }));

  const filteredPersisted = persistedFiles.filter((f) => !streamingPaths.has(f.path));
  const allFiles = [...streamingAsVfs, ...filteredPersisted];
  const tree = buildFileTree(allFiles);

  // Annotate nodes with streaming VirtualFile reference for status
  const streamingMap = new Map(streamingFiles.map((f) => [f.path, f]));
  function annotate(nodes: FileTreeNode[]) {
    for (const node of nodes) {
      if (!node.isDirectory) {
        const sf = streamingMap.get(node.path);
        if (sf) {
          node.file = sf;
        }
      }
      if (node.children) annotate(node.children);
    }
  }
  annotate(tree);
  return tree;
}

function collectFilePaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.isDirectory) {
      paths.push(...collectFilePaths(node.children ?? []));
      continue;
    }
    paths.push(node.path);
  }
  return paths;
}

function buildWorkspaceAnnouncement(paths: string[]): string {
  if (paths.length === 0) {
    return '';
  }

  if (paths.length === 1) {
    return `${paths[0]} added to workspace`;
  }

  return `${paths.length} new files added to workspace`;
}

function parseGitHubOwnerRepo(githubRepoUrl?: string): string | null {
  if (!githubRepoUrl) {
    return null;
  }

  try {
    const url = new URL(githubRepoUrl);
    if (url.hostname !== 'github.com') {
      return null;
    }

    const [owner, repoSegment] = url.pathname.replace(/^\/|\/$/g, '').split('/');
    const repo = repoSegment?.replace(/\.git$/i, '');

    if (!owner || !repo) {
      return null;
    }

    return `${owner}/${repo}`;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Tree node component                                                */
/* ------------------------------------------------------------------ */

interface SidebarTreeNodeProps {
  node: FileTreeNode;
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}

function SidebarTreeNode({
  node,
  depth,
  expandedFolders,
  onToggleFolder,
  selectedPath,
  onSelectFile,
}: SidebarTreeNodeProps) {
  const styles = useStyles();
  const isExpanded = expandedFolders.has(node.path);
  const isSelected = !node.isDirectory && node.path === selectedPath;
  const isGenerating = node.file?.status === 'generating';

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      onToggleFolder(node.path);
    } else {
      onSelectFile(node.path);
    }
  }, [node.isDirectory, node.path, onToggleFolder, onSelectFile]);

  return (
    <li>
      <div
        className={mergeClasses(
          styles.treeItem,
          isSelected && styles.treeItemSelected,
          isGenerating && styles.generating,
        )}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={node.isDirectory ? isExpanded : undefined}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <span className={styles.treeChevron}>
          {node.isDirectory ? (
            isExpanded ? <ChevronDownRegular fontSize={12} /> : <ChevronRightRegular fontSize={12} />
          ) : null}
        </span>
        <span className={styles.treeIcon}>
          {node.isDirectory ? (
            isExpanded ? <FolderOpenRegular fontSize={16} /> : <FolderRegular fontSize={16} />
          ) : (
            isGenerating ? <Spinner size="tiny" /> : <DocumentRegular fontSize={16} />
          )}
        </span>
        <Text size={200} className={styles.treeName} title={node.name}>
          {node.name}
        </Text>
      </div>
      {node.isDirectory && isExpanded && node.children && (
        <ul className={styles.treeList} role="group">
          {node.children.map((child) => (
            <SidebarTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export interface FileManagerSidebarProps {
  /** In-memory streaming files (real-time generation). */
  streamingFiles: VirtualFile[];
  /** IndexedDB-backed persisted files. */
  persistedFiles: VFSFile[];
  /** Currently selected file path in the viewer. */
  selectedPath?: string;
  /** Called when user clicks a file node. */
  onSelectFile: (path: string) => void;
  /** Called to download all files as ZIP. */
  onDownloadZip?: () => void;
  /** Called to dismiss / close the sidebar. */
  onDismiss: () => void;
  /** Optional GitHub repo URL (e.g. https://github.com/owner/repo) — enables vscode.dev and Codespaces buttons. */
  githubRepoUrl?: string;
}

export function FileManagerSidebar({
  streamingFiles,
  persistedFiles,
  selectedPath,
  onSelectFile,
  onDownloadZip,
  onDismiss,
  githubRepoUrl,
}: FileManagerSidebarProps) {
  const styles = useStyles();
  const [workspaceAnnouncement, setWorkspaceAnnouncement] = React.useState('');
  const previousPathsRef = React.useRef<string[]>([]);
  const isInitialRenderRef = React.useRef(true);

  const tree = useMemo(
    () => buildMergedTree(streamingFiles, persistedFiles),
    [streamingFiles, persistedFiles],
  );
  const mergedFilePaths = useMemo(() => collectFilePaths(tree), [tree]);
  const ownerRepo = useMemo(() => parseGitHubOwnerRepo(githubRepoUrl), [githubRepoUrl]);

  // Count all leaf (non-directory) files
  const fileCount = useMemo(() => {
    function count(nodes: FileTreeNode[]): number {
      return nodes.reduce(
        (acc, n) => acc + (n.isDirectory ? count(n.children ?? []) : 1),
        0,
      );
    }
    return count(tree);
  }, [tree]);

  // Auto-expand all folders by default
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    function collectDirs(nodes: FileTreeNode[], set: Set<string>) {
      for (const n of nodes) {
        if (n.isDirectory) {
          set.add(n.path);
          if (n.children) collectDirs(n.children, set);
        }
      }
    }
    const dirs = new Set<string>();
    collectDirs(tree, dirs);
    setExpandedFolders((prev) => {
      const merged = new Set(prev);
      for (const d of dirs) merged.add(d);
      return merged;
    });
  }, [tree]);

  React.useEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      previousPathsRef.current = mergedFilePaths;
      return;
    }

    const previousPaths = new Set(previousPathsRef.current);
    const addedPaths = mergedFilePaths.filter((path) => !previousPaths.has(path));
    previousPathsRef.current = mergedFilePaths;

    if (addedPaths.length > 0) {
      setWorkspaceAnnouncement(buildWorkspaceAnnouncement(addedPaths));
    }
  }, [mergedFilePaths]);

  const handleToggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  return (
    <div className={styles.root} data-testid="file-manager-sidebar">
      <div
        className={styles.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {workspaceAnnouncement}
      </div>
      <div className={styles.header}>
        <Text className={styles.headerTitle} size={300}>
          Files{fileCount > 0 ? ` (${fileCount})` : ''}
        </Text>
        <div className={styles.headerActions}>
          {ownerRepo && (
            <>
              <Tooltip content="Open in vscode.dev" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<WindowDevTools24Regular />}
                  aria-label="Open in vscode.dev"
                  onClick={() => window.open(`https://vscode.dev/github/${ownerRepo}`, '_blank', 'noopener,noreferrer')}
                />
              </Tooltip>
              <Tooltip content="Open in GitHub Codespaces" relationship="label">
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Cloud24Regular />}
                  aria-label="Open in GitHub Codespaces"
                  onClick={() => window.open(`https://codespaces.new/${ownerRepo}`, '_blank', 'noopener,noreferrer')}
                />
              </Tooltip>
            </>
          )}
          {onDownloadZip && fileCount > 0 && (
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowDownloadRegular />}
              aria-label="Download workspace as ZIP"
              title="Download ZIP"
              onClick={onDownloadZip}
            />
          )}
          <Button
            appearance="subtle"
            size="small"
            icon={<DismissRegular />}
            aria-label="Close workspace file panel"
            title="Close file panel"
            onClick={onDismiss}
          />
        </div>
      </div>

      {fileCount === 0 ? (
        <div className={styles.empty}>
          <Text size={200}>No files yet</Text>
        </div>
      ) : (
        <ul className={styles.treeList} role="tree" aria-label="Workspace files">
          {tree.map((node) => (
            <SidebarTreeNode
              key={node.path}
              node={node}
              depth={0}
              expandedFolders={expandedFolders}
              onToggleFolder={handleToggleFolder}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
