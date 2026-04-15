// Virtual Filesystem — in-memory file store for the Spark code generation experience

import { normalizePath as validateAndNormalize } from '../utils/path-validation';

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
    sortTree(nodes);
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

interface WorkspaceSnapshotRecord {
  sessionId: string;
  files: VFSFile[];
  updatedAt: number;
}

const IDB_NAME = 'kickstart-vfs';
const IDB_VERSION = 3;
const IDB_STORE = 'files';
const WORKSPACE_SNAPSHOT_STORE = 'workspace-snapshots';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'path' });
      }
      if (!db.objectStoreNames.contains(WORKSPACE_SNAPSHOT_STORE)) {
        db.createObjectStore(WORKSPACE_SNAPSHOT_STORE, { keyPath: 'sessionId' });
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

/** Errors thrown by VirtualFS for security-related rejections. */
export class VFSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'VFSError';
  }
}

// --- Resource limits ---
const MAX_FILE_SIZE = 5 * 1024 * 1024;       // 5 MB per file
const MAX_TOTAL_QUOTA = 50 * 1024 * 1024;     // 50 MB total
const MAX_FILE_COUNT = 500;

/**
 * IndexedDB-backed virtual filesystem.
 *
 * Files are stored as `VFSFile` records with path, content, language, and timestamps.
 * All methods are async. Subscribe to change notifications via `subscribe()`.
 *
 * Security controls:
 * - All paths validated via `normalizePath()` (rejects traversal, absolute, control chars)
 * - Per-file size limit: 5 MB
 * - Total quota: 50 MB
 * - Max file count: 500
 */
export class VirtualFS {
  private readonly dbPromise: Promise<IDBDatabase>;
  private readonly listeners = new Set<() => void>();

  constructor() {
    this.dbPromise = openIDB();
  }

  private securePath(raw: string): string {
    const validated = validateAndNormalize(raw);
    if (!validated) {
      throw new VFSError(`Invalid file path: ${raw}`, 'INVALID_PATH');
    }
    return validated;
  }

  async writeFile(path: string, content: string, language?: string): Promise<void> {
    const normalized = this.securePath(path);

    // Enforce per-file size limit
    const encoder = new TextEncoder();
    const contentSize = encoder.encode(content).byteLength;
    if (contentSize > MAX_FILE_SIZE) {
      throw new VFSError(
        `File too large — maximum ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)} MB`,
        'FILE_TOO_LARGE',
      );
    }

    const db = await this.dbPromise;

    // Check quota and file count
    const allRecords = await this._readAllRaw(db);
    const existingIdx = allRecords.findIndex((r) => r.path === normalized);
    const isNew = existingIdx === -1;
    if (isNew && allRecords.length >= MAX_FILE_COUNT) {
      throw new VFSError(
        `File limit reached — maximum ${MAX_FILE_COUNT} files`,
        'FILE_COUNT_EXCEEDED',
      );
    }
    // Calculate total size (excluding current file if it exists)
    let totalSize = 0;
    for (const rec of allRecords) {
      if (rec.path !== normalized) {
        totalSize += encoder.encode(rec.content).byteLength;
      }
    }
    if (totalSize + contentSize > MAX_TOTAL_QUOTA) {
      throw new VFSError(
        `Storage quota exceeded — maximum ${(MAX_TOTAL_QUOTA / 1024 / 1024).toFixed(0)} MB total`,
        'QUOTA_EXCEEDED',
      );
    }

    const now = Date.now();
    const existing = existingIdx !== -1 ? allRecords[existingIdx] : null;
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
    const normalized = this.securePath(path);
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(normalized);
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
          reject(new Error(`File not found: ${normalized}`));
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
        const keys = (req.result as string[]).filter((k) => {
          // Integrity boundary: exclude paths that fail validation
          if (validateAndNormalize(k) === null) {
            // eslint-disable-next-line no-console
            console.warn('[VirtualFS] Excluding invalid path from listing:', k);
            return false;
          }
          return true;
        });
        resolve(dir ? keys.filter((k) => k.startsWith(dir)) : keys);
      };
      req.onerror = () => reject(req.error);
    });
  }

  /** Fetch all stored file records with full metadata. */
  async readAll(): Promise<VFSFile[]> {
    const db = await this.dbPromise;
    return this._readAllRaw(db);
  }

  /** Internal: read all records with integrity validation. */
  private async _readAllRaw(db: IDBDatabase): Promise<VFSFile[]> {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => {
        const records = (req.result as Record<string, unknown>[])
          .filter((raw) => {
            // Integrity boundary: skip records with invalid paths
            const valid = validateAndNormalize(raw.path as string);
            if (!valid) {
              // eslint-disable-next-line no-console
              console.warn('[VirtualFS] Excluding corrupt record:', raw.path);
              return false;
            }
            return true;
          })
          .map((raw) => ({
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
    const normalized = this.securePath(path);
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(normalized);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    this.notify();
  }

  async exists(path: string): Promise<boolean> {
    const normalized = this.securePath(path);
    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).count(IDBKeyRange.only(normalized));
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
      // Defense-in-depth: re-validate every path before adding to ZIP
      const safe = validateAndNormalize(path);
      if (!safe) {
        // eslint-disable-next-line no-console
        console.warn('[VirtualFS] Skipping invalid path during ZIP export:', path);
        continue;
      }
      zip.file(safe, content);
    }
    return zip.generateAsync({ type: 'blob' });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async saveWorkspaceSnapshot(sessionId: string, files: VFSFile[]): Promise<void> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    const sanitizedFiles = files.map((file) => {
      const safePath = this.securePath(file.path);
      return {
        path: safePath,
        content: file.content,
        language: file.language ?? detectLang(safePath),
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      } satisfies VFSFile;
    });

    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_SNAPSHOT_STORE).put({
        sessionId: normalizedSessionId,
        files: sanitizedFiles,
        updatedAt: Date.now(),
      } satisfies WorkspaceSnapshotRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadWorkspaceSnapshot(sessionId: string): Promise<VFSFile[]> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return [];
    }

    const db = await this.dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_SNAPSHOT_STORE, 'readonly');
      const req = tx.objectStore(WORKSPACE_SNAPSHOT_STORE).get(normalizedSessionId);
      req.onsuccess = () => {
        const record = req.result as WorkspaceSnapshotRecord | undefined;
        if (!record || !Array.isArray(record.files)) {
          resolve([]);
          return;
        }

        resolve(
          record.files
            .map((file) => {
              const safePath = validateAndNormalize(file.path);
              if (!safePath) {
                return null;
              }

              return {
                path: safePath,
                content: file.content,
                language: file.language ?? detectLang(safePath),
                createdAt: file.createdAt ?? 0,
                updatedAt: file.updatedAt ?? 0,
              } satisfies VFSFile;
            })
            .filter((file): file is VFSFile => file !== null)
            .sort((left, right) => left.path.localeCompare(right.path)),
        );
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteWorkspaceSnapshot(sessionId: string): Promise<void> {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      return;
    }

    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_SNAPSHOT_STORE).delete(normalizedSessionId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearWorkspaceSnapshots(): Promise<void> {
    const db = await this.dbPromise;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORKSPACE_SNAPSHOT_STORE, 'readwrite');
      tx.objectStore(WORKSPACE_SNAPSHOT_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
