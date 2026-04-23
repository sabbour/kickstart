import React, { useState, useCallback } from 'react';
import type { FileTreeNode } from '../../services/virtual-fs';
import {
  FolderRegular,
  FolderOpenRegular,
  ChevronRightRegular,
  ChevronDownRegular,
  DocumentRegular,
  CodeRegular,
  BracesRegular,
  CodeBlockRegular,
  DiagramRegular,
  ImageRegular,
  TableRegular,
} from '@fluentui/react-icons';

type FluentIconComponent = React.FC<React.SVGAttributes<SVGElement>>;

const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rb', 'java', 'cs', 'rs',
  'cpp', 'c', 'h', 'php', 'swift', 'kt', 'scala', 'sh', 'bash',
  'tf', 'bicep', 'toml', 'hcl', 'rs', 'lua', 'sql',
]);

function getFileIcon(name: string): FluentIconComponent {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'json') return BracesRegular;
  if (ext === 'yaml' || ext === 'yml') return CodeBlockRegular;
  if (ext === 'mmd' || ext === 'mermaid') return DiagramRegular;
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext)) return ImageRegular;
  if (['csv', 'tsv'].includes(ext)) return TableRegular;
  if (CODE_EXTENSIONS.has(ext)) return CodeRegular;
  return DocumentRegular;
}

interface FileTreeProps {
  tree: FileTreeNode[];
  selectedPath?: string;
  onSelectFile: (path: string) => void;
}

export function FileTree({ tree, selectedPath, onSelectFile }: FileTreeProps) {
  return (
    <div className="file-tree">
      <div className="file-tree-header">Files</div>
      <div className="file-tree-list">
        {tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
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
  const [expanded, setExpanded] = useState(true); // auto-expand by default

  const handleClick = useCallback(() => {
    if (node.isDirectory) {
      setExpanded((prev) => !prev);
    } else {
      onSelectFile(node.path);
    }
  }, [node, onSelectFile]);

  const isSelected = !node.isDirectory && node.path === selectedPath;
  const isGenerating = node.file?.status === 'generating';
  const FileIcon = node.isDirectory ? (expanded ? FolderOpenRegular : FolderRegular) : getFileIcon(node.name);
  const ChevronIcon = expanded ? ChevronDownRegular : ChevronRightRegular;

  return (
    <>
      <button
        className={`file-tree-item${isSelected ? ' selected' : ''}${isGenerating ? ' generating' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        title={node.path}
        type="button"
      >
        {node.isDirectory && (
          <span className="file-tree-chevron" aria-hidden="true">
            <ChevronIcon />
          </span>
        )}
        <span className="file-tree-icon" aria-hidden="true">
          <FileIcon />
        </span>
        <span className="file-tree-name">{node.name}</span>
      </button>
      {node.isDirectory && expanded && node.children && (
        <>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
            />
          ))}
        </>
      )}
    </>
  );
}
