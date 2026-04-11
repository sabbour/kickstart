/**
 * FileTreePanel — persistent file tree backed by VirtualFSContext (IndexedDB).
 *
 * Renders a list of all files in the VirtualFS. Clicking a file shows its
 * content in an inline preview and calls `onOpenFile` so the parent can show
 * it in the main FileEditor as well.
 *
 * A "Download All" button exports every stored file as a single ZIP archive.
 */
import React, { useCallback, useState } from 'react';
import { useVirtualFS } from '../contexts/VirtualFSContext';
export function FileTreePanel({ onOpenFile }) {
    const { fs, files } = useVirtualFS();
    const [selectedPath, setSelectedPath] = useState();
    const [previewContent, setPreviewContent] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const handleSelectFile = useCallback(async (path) => {
        try {
            const content = await fs.readFile(path);
            setSelectedPath(path);
            setPreviewContent(content);
            onOpenFile?.(path, content);
        }
        catch {
            // file may have been deleted between render and click
        }
    }, [fs, onOpenFile]);
    const handleDownloadAll = useCallback(async () => {
        if (files.length === 0 || isDownloading)
            return;
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
        }
        finally {
            setIsDownloading(false);
        }
    }, [fs, files.length, isDownloading]);
    if (files.length === 0)
        return null;
    return (<aside className="file-editor" aria-label="Persistent files">
      <div className="file-tree">
        <div className="file-tree-header">
          <span>Files</span>
          <button type="button" className="file-tree-download-btn" onClick={handleDownloadAll} disabled={isDownloading || files.length === 0} title="Download all files as ZIP">
            {isDownloading ? '…' : '⬇ Download All'}
          </button>
        </div>
        <div className="file-tree-list">
          {files.map((path) => (<button key={path} type="button" className={`file-tree-item${selectedPath === path ? ' selected' : ''}`} onClick={() => handleSelectFile(path)} title={path}>
              <span className="file-tree-icon">📄</span>
              <span className="file-tree-name">{path.split('/').pop() ?? path}</span>
            </button>))}
        </div>
      </div>
      {selectedPath && previewContent && (<div className="code-view" aria-label={`Preview: ${selectedPath}`}>
          <pre className="code-view-pre">
            <code>{previewContent}</code>
          </pre>
        </div>)}
    </aside>);
}
//# sourceMappingURL=FileTreePanel.js.map