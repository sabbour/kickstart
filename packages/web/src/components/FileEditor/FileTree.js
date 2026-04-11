import React, { useState, useCallback } from 'react';
export function FileTree({ tree, selectedPath, onSelectFile }) {
    return (<div className="file-tree">
      <div className="file-tree-header">Files</div>
      <div className="file-tree-list">
        {tree.map((node) => (<TreeNode key={node.path} node={node} depth={0} selectedPath={selectedPath} onSelectFile={onSelectFile}/>))}
      </div>
    </div>);
}
function TreeNode({ node, depth, selectedPath, onSelectFile, }) {
    const [expanded, setExpanded] = useState(true); // auto-expand by default
    const handleClick = useCallback(() => {
        if (node.isDirectory) {
            setExpanded((prev) => !prev);
        }
        else {
            onSelectFile(node.path);
        }
    }, [node, onSelectFile]);
    const isSelected = !node.isDirectory && node.path === selectedPath;
    const isGenerating = node.file?.status === 'generating';
    return (<>
      <button className={`file-tree-item${isSelected ? ' selected' : ''}${isGenerating ? ' generating' : ''}`} style={{ paddingLeft: `${12 + depth * 16}px` }} onClick={handleClick} title={node.path} type="button">
        <span className="file-tree-icon">
          {node.isDirectory ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        <span className="file-tree-name">{node.name}</span>
      </button>
      {node.isDirectory && expanded && node.children && (<>
          {node.children.map((child) => (<TreeNode key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelectFile={onSelectFile}/>))}
        </>)}
    </>);
}
//# sourceMappingURL=FileTree.js.map