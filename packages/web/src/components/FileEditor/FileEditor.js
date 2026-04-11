import React, { useSyncExternalStore } from 'react';
import { FileTree } from './FileTree';
import { CodeView } from './CodeView';
export function FileEditor({ fs, selectedPath, onSelectFile }) {
    const files = useSyncExternalStore(fs.subscribe, fs.getSnapshot);
    const tree = fs.tree();
    const selectedFile = selectedPath ? fs.read(selectedPath) : undefined;
    if (files.length === 0)
        return null;
    return (<aside className="file-editor" aria-label="Generated files">
      <FileTree tree={tree} selectedPath={selectedPath} onSelectFile={onSelectFile}/>
      <CodeView file={selectedFile}/>
    </aside>);
}
//# sourceMappingURL=FileEditor.js.map