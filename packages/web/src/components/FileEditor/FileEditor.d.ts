import React from 'react';
import type { VirtualFileSystem } from '../../services/virtual-fs';
interface FileEditorProps {
    fs: VirtualFileSystem;
    selectedPath?: string;
    onSelectFile: (path: string) => void;
}
export declare function FileEditor({ fs, selectedPath, onSelectFile }: FileEditorProps): React.JSX.Element | null;
export {};
//# sourceMappingURL=FileEditor.d.ts.map