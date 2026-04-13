// Virtual Filesystem — in-memory file store for the Spark code generation experience

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
  vfsFile?: VFSFile;
}

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  sh: 'shell',
  bash: 'shell',
  bicep: 'bicep',
  tf: 'hcl',
  toml: 'toml',
  xml: 'xml',
  sql: 'sql',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  rb: 'ruby',
  env: 'dotenv',
};

const FILENAME_LANGUAGES: Record<string, string> = {
  Dockerfile: 'dockerfile',
  '.dockerignore': 'ignore',
  '.gitignore': 'ignore',
  Makefile: 'makefile',
  '.env': 'dotenv',
  '.env.template': 'dotenv',
};

export class VirtualFileSystem {
  private files = new Map<string, VirtualFile>();
  private listeners = new Set<() => void>();
  private snapshot: VirtualFile[] = [];

  write(path: string, content: string, language?: string): void {
    const normalized = this.normalizePath(path);
    const existing = this.files.get(normalized);
    const now = Date.now();

    this.files.set(normalized, {
      path: normalized,
      content,
      language: language ?? this.detectLanguage(normalized),
      status: 'complete',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.notify();
  }

  /** Write a file with status 'generating' (used during streaming). */
  writeGenerating(path: string, content: string, language?: string): void {
    const normalized = this.normalizePath(path);
    const existing = this.files.get(normalized);
    const now = Date.now();

    this.files.set(normalized, {
      path: normalized,
      content,
      language: language ?? this.detectLanguage(normalized),
      status: 'generating',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    this.notify();
  }

  read(path: string): VirtualFile | undefined {
    return this.files.get(this.normalizePath(path));
  }

  list(): VirtualFile[] {
    return Array.from(this.files.values()).sort((a, b) =>
      a.path.localeCompare(b.path),
    );
  }

  tree(): FileTreeNode[] {
    const root: FileTreeNode = {
      name: '/',
      path: '',
      isDirectory: true,
      children: [],
    };

    const sorted = this.list();
    for (const file of sorted) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        const partPath = parts.slice(0, i + 1).join('/');

        if (isLast) {
          current.children!.push({
            name: part,
            path: partPath,
            isDirectory: false,
            file,
          });
        } else {
          let dir = current.children!.find(
            (c) => c.isDirectory && c.name === part,
          );
          if (!dir) {
            dir = { name: part, path: partPath, isDirectory: true, children: [] };
            current.children!.push(dir);
          }
          current = dir;
        }
      }
    }

    // Sort children: directories first, then alphabetical
    this.sortTree(root.children!);
    return root.children!;
  }

  delete(path: string): void {
    if (this.files.delete(this.normalizePath(path))) {
      this.notify();
    }
  }

  clear(): void {
    if (this.files.size > 0) {
      this.files.clear();
      this.notify();
    }
  }

  get size(): number {
    return this.files.size;
  }

  // --- React useSyncExternalStore compat ---

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): VirtualFile[] => {
    return this.snapshot;
  };

  // --- internals ---

  private normalizePath(raw: string): string {
    return raw
      .replace(/\\/g, '/')      // backslash → forward slash
      .replace(/^\/+/, '')       // strip leading slashes
      .replace(/\/+/g, '/')      // collapse repeated slashes
      .replace(/\/+$/, '');       // strip trailing slashes
  }

  private detectLanguage(path: string): string {
    const filename = path.split('/').pop() ?? '';

    // Check full filename first (Dockerfile, Makefile, etc.)
    if (FILENAME_LANGUAGES[filename]) return FILENAME_LANGUAGES[filename];

    // Check extension
    const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
    return EXTENSION_LANGUAGES[ext] ?? 'plaintext';
  }

  private sortTree(nodes: FileTreeNode[]): void {
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) this.sortTree(node.children);
    }
  }

  private notify(): void {
    this.snapshot = this.list();
    for (const fn of this.listeners) fn();
  }
}

// ---------------------------------------------------------------------------
// VirtualFS — IndexedDB-backed persistent virtual filesystem
// ---------------------------------------------------------------------------

/** A persisted file record stored in IndexedDB. */
export interface VFSFile {
  path: string;
  content: string;
  language: string;
  createdAt: number;
  updatedAt: number;
}

const IDB_NAME = 'kickstart-vfs';
const IDB_VERSION = 2;
const IDB_STORE = 'files';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Detect language from a file path for persisted records. */
function detectLang(path: string): string {
  const filename = path.split('/').pop() ?? '';
  if (FILENAME_LANGUAGES[filename]) return FILENAME_LANGUAGES[filename];
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : '';
  return EXTENSION_LANGUAGES[ext] ?? 'plaintext';
}

/** Build a hierarchical FileTreeNode[] from a flat list of VFSFile records. */
export function buildFileTree(files: VFSFile[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '/', path: '', isDirectory: true, children: [] };
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const partPath = parts.slice(0, i + 1).join('/');

      if (isLast) {
        current.children!.push({
          name: part,
          path: partPath,
          isDirectory: false,
          vfsFile: file,
        });
      } else {
        let dir = current.children!.find((c) => c.isDirectory && c.name === part);
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

function sortTree(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) sortTree(node.children);
  }
}

/**
 * IndexedDB-backed virtual filesystem.
 *
 * Files are stored as `VFSFile` records with path, content, language, and timestamps.
 * All methods are async. Subscribe to change notifications via `subscribe()`.
 */
export class VirtualFS {
  private readonly dbPromise: Promise<IDBDatabase>;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.dbPromise = openIDB();
  }

  private normalizePath(raw: string): string {
    return raw
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/')
      .replace(/\/+$/, '');
  }

  async writeFile(path: string, content: string, language?: string): Promise<void> {
    const normalized = this.normalizePath(path);
    const db = await this.dbPromise;
    const now = Date.now();
    const existing = await this.getFile(normalized).catch(() => null);
    const record: VFSFile = {
      path: normalized,
      content,
      language: language ?? detectLang(normalized),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.notify();
  }

  async readFile(path: string): Promise<string> {
    const file = await this.getFile(path);
    return file.content;
  }

  async getFile(path: string): Promise<VFSFile> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(path);
      req.onsuccess = () => {
        if (req.result) {
          const raw = req.result as Record<string, unknown>;
          const needsMigration = !raw.language || !raw.createdAt || !raw.updatedAt;
          const migrated: VFSFile = {
            path: raw.path as string,
            content: raw.content as string,
            language: (raw.language as string) ?? detectLang(raw.path as string),
            createdAt: (raw.createdAt as number) ?? 0,
            updatedAt: (raw.updatedAt as number) ?? 0,
          };
          // Persist migrated record so v1 files get stable metadata
          if (needsMigration) {
            const writeTx = db.transaction(IDB_STORE, 'readwrite');
            writeTx.objectStore(IDB_STORE).put(migrated);
          }
          resolve(migrated);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async listFiles(dir?: string): Promise<string[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        resolve(dir ? keys.filter((k) => k.startsWith(dir)) : keys);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** Fetch all stored file records with full metadata. */
  async readAll(): Promise<VFSFile[]> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const records = (req.result as Record<string, unknown>[]).map((raw) => ({
          path: raw.path as string,
          content: raw.content as string,
          language: (raw.language as string) ?? detectLang(raw.path as string),
          createdAt: (raw.createdAt as number) ?? 0,
          updatedAt: (raw.updatedAt as number) ?? 0,
        }));
        resolve(records.sort((a, b) => a.path.localeCompare(b.path)));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(path);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.notify();
  }

  async exists(path: string): Promise<boolean> {
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).count(IDBKeyRange.only(path));
      req.onsuccess = () => resolve(req.result > 0);
      req.onerror = () => reject(req.error);
    });
  }

  /** Remove all stored files. */
  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.notify();
  }

  async exportZip(): Promise<Blob> {
    const { default: JSZip } = await import('jszip');
    const records = await this.readAll();
    const zip = new JSZip();
    for (const { path, content } of records) {
      zip.file(path, content);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
