/**
 * FileTreePanel — persistent file tree backed by VirtualFSContext (IndexedDB).
 *
 * Renders a list of all files in the VirtualFS. Clicking a file shows its
 * content in an inline preview and calls `onOpenFile` so the parent can show
 * it in the main FileEditor as well.
 *
 * A "Download All" button exports every stored file as a single ZIP archive.
 */
import React from 'react';
interface FileTreePanelProps {
    /**
     * Called when the user clicks a file in the panel.
     * Receives the path and the full text content.
     */
    onOpenFile?: (path: string, content: string) => void;
}
export declare function FileTreePanel({ onOpenFile }: FileTreePanelProps): React.JSX.Element | null;
export {};
//# sourceMappingURL=FileTreePanel.d.ts.map