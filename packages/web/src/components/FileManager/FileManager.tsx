/**
 * FileManager — sidebar panel showing all generated project files.
 *
 * Merges streaming (in-memory VFS) and persisted (IndexedDB VFS) files into a
 * unified tree view. Clicking a file opens it in a syntax-highlighted read-only
 * viewer via the CodeView component.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useVirtualFS } from '../../contexts/VirtualFSContext';
import { CodeView } from '../FileEditor/CodeView';
import type { VirtualFile } from '../../services/virtual-fs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileManagerProps {
  /** Files from the in-memory streaming VFS (includes generating status). */
  streamingFiles?: VirtualFile[];
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  file?: VirtualFile;
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

function buildTree(files: VirtualFile[]): TreeNode[] {
  const root: TreeNode = { name: '/', path: '', isDirectory: true, children: [] };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.children!.push({ name: part, path: partPath, isDirectory: false, file });
      } else {
        let dir = current.children!.find(c => c.isDirectory && c.name === part);
        if (!dir) {
          dir = { name: part, path: partPath, isDirectory: true, children: [] };
          current.children!.push(dir);
        }
        current = dir;
      }
    }
  }

  sortTree(root.children!);
  return root.children!;
}

function sortTree(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) sortTree(node.children);
  }
}

// ---------------------------------------------------------------------------
// TreeNodeItem
// ---------------------------------------------------------------------------

function TreeNodeItem({
  node,
  depth,
  selectedPath,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded(prev => !prev);
    } else {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  const isSelected = !node.isDirectory && node.path === selectedPath;
  const isGenerating = node.file?.status === 'generating';

  return (
    <>
      <button
        className={`fm-tree-item${isSelected ? ' selected' : ''}${isGenerating ? ' generating' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        title={node.path}
        type="button"
        role="treeitem"
        aria-expanded={node.isDirectory ? expanded : undefined}
        aria-level={depth + 1}
        aria-selected={isSelected}
      >
        <span className="fm-tree-icon">
          {node.isDirectory ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="fm-tree-name">{node.name}</span>
      </button>
      {node.isDirectory && expanded && node.children && (
        <div role="group">
          {node.children.map(child => (
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
// FileManager
// ---------------------------------------------------------------------------

export function FileManager({ streamingFiles = [] }: FileManagerProps) {
  const { fs: vfs, files: vfsPaths, fileRecords } = useVirtualFS();
  const [selectedPath, setSelectedPath] = useState<string | undefined>();
  const [isDownloading, setIsDownloading] = useState(false);

  // Merge persisted + streaming-only (generating) files into VirtualFile[]
  const mergedFiles = useMemo((): VirtualFile[] => {
    const persisted: VirtualFile[] = fileRecords.map(f => ({
      path: f.path,
      content: f.content,
      language: f.language,
      status: 'complete' as const,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    const persistedPaths = new Set(vfsPaths);
    const generatingOnly = streamingFiles.filter(
      sf => sf.status === 'generating' && !persistedPaths.has(sf.path),
    );

    return [...persisted, ...generatingOnly].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
  }, [fileRecords, vfsPaths, streamingFiles]);

  const tree = useMemo(() => buildTree(mergedFiles), [mergedFiles]);

  // Selected file — prefer streaming version if it exists (has latest content)
  const selectedFile = useMemo(() => {
    if (!selectedPath) return undefined;
    const streaming = streamingFiles.find(f => f.path === selectedPath);
    if (streaming) return streaming;
    return mergedFiles.find(f => f.path === selectedPath);
  }, [mergedFiles, streamingFiles, selectedPath]);

  // Clear selection when file is removed
  useEffect(() => {
    if (selectedPath && !mergedFiles.some(f => f.path === selectedPath)) {
      setSelectedPath(undefined);
    }
  }, [mergedFiles, selectedPath]);

  const handleSelectFile = useCallback((path: string) => {
    setSelectedPath(path);
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (mergedFiles.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      const blob = await vfs.exportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kickstart-files.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  }, [vfs, mergedFiles.length, isDownloading]);

  const handleDelete = useCallback(async () => {
    if (!selectedPath) return;
    try {
      await vfs.deleteFile(selectedPath);
    } catch {
      // file may have already been deleted
    }
    setSelectedPath(undefined);
  }, [vfs, selectedPath]);

  if (mergedFiles.length === 0) return null;

  return (
    <aside className="file-manager" aria-label="File manager">
      {/* Header */}
      <div className="fm-header">
        <span className="fm-title">Files ({mergedFiles.length})</span>
        <div className="fm-header-actions">
          <button
            className="fm-action-btn"
            title="Delete selected file"
            onClick={handleDelete}
            disabled={!selectedPath}
            type="button"
          >
            🗑
          </button>
          <button
            className="fm-action-btn"
            title="Download all as ZIP"
            onClick={handleDownloadAll}
            disabled={isDownloading || mergedFiles.length === 0}
            type="button"
          >
            ⬇ ZIP
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="fm-tree" role="tree" aria-label="Project files">
        {tree.map(node => (
          <TreeNodeItem
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={handleSelectFile}
          />
        ))}
      </div>

      {/* Code viewer */}
      <div className="fm-viewer">
        <CodeView file={selectedFile} />
      </div>
    </aside>
  );
}
