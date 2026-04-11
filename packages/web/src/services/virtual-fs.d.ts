export interface VirtualFile {
    path: string;
    content: string;
    language: string;
    status: 'generating' | 'complete';
    createdAt: number;
    updatedAt: number;
}
export interface FileTreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileTreeNode[];
    file?: VirtualFile;
}
export declare class VirtualFileSystem {
    private files;
    private listeners;
    private snapshot;
    write(path: string, content: string, language?: string): void;
    /** Write a file with status 'generating' (used during streaming). */
    writeGenerating(path: string, content: string, language?: string): void;
    read(path: string): VirtualFile | undefined;
    list(): VirtualFile[];
    tree(): FileTreeNode[];
    delete(path: string): void;
    clear(): void;
    get size(): number;
    subscribe: (listener: () => void) => (() => void);
    getSnapshot: () => VirtualFile[];
    private normalizePath;
    private detectLanguage;
    private sortTree;
    private notify;
}
/**
 * IndexedDB-backed virtual filesystem.
 *
 * Files are stored as `{ path, content }` records in an IDB object store.
 * All methods are async. Subscribe to change notifications via `subscribe()`.
 */
export declare class VirtualFS {
    private readonly dbPromise;
    private readonly listeners;
    constructor();
    writeFile(path: string, content: string): Promise<void>;
    readFile(path: string): Promise<string>;
    listFiles(dir?: string): Promise<string[]>;
    deleteFile(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    exportZip(): Promise<Blob>;
    subscribe(listener: () => void): () => void;
    private notify;
}
//# sourceMappingURL=virtual-fs.d.ts.map