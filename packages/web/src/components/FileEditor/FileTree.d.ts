import React from 'react';
import type { FileTreeNode } from '../../services/virtual-fs';
interface FileTreeProps {
    tree: FileTreeNode[];
    selectedPath?: string;
    onSelectFile: (path: string) => void;
}
export declare function FileTree({ tree, selectedPath, onSelectFile }: FileTreeProps): React.JSX.Element;
export {};
//# sourceMappingURL=FileTree.d.ts.map