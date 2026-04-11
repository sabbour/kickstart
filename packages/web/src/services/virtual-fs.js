// Virtual Filesystem — in-memory file store for the Spark code generation experience
const EXTENSION_LANGUAGES = {
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
const FILENAME_LANGUAGES = {
    Dockerfile: 'dockerfile',
    '.dockerignore': 'ignore',
    '.gitignore': 'ignore',
    Makefile: 'makefile',
    '.env': 'dotenv',
    '.env.template': 'dotenv',
};
export class VirtualFileSystem {
    files = new Map();
    listeners = new Set();
    snapshot = [];
    write(path, content, language) {
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
    writeGenerating(path, content, language) {
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
    read(path) {
        return this.files.get(this.normalizePath(path));
    }
    list() {
        return Array.from(this.files.values()).sort((a, b) => a.path.localeCompare(b.path));
    }
    tree() {
        const root = {
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
                    current.children.push({
                        name: part,
                        path: partPath,
                        isDirectory: false,
                        file,
                    });
                }
                else {
                    let dir = current.children.find((c) => c.isDirectory && c.name === part);
                    if (!dir) {
                        dir = { name: part, path: partPath, isDirectory: true, children: [] };
                        current.children.push(dir);
                    }
                    current = dir;
                }
            }
        }
        // Sort children: directories first, then alphabetical
        this.sortTree(root.children);
        return root.children;
    }
    delete(path) {
        if (this.files.delete(this.normalizePath(path))) {
            this.notify();
        }
    }
    clear() {
        if (this.files.size > 0) {
            this.files.clear();
            this.notify();
        }
    }
    get size() {
        return this.files.size;
    }
    // --- React useSyncExternalStore compat ---
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    getSnapshot = () => {
        return this.snapshot;
    };
    // --- internals ---
    normalizePath(raw) {
        return raw
            .replace(/\\/g, '/') // backslash → forward slash
            .replace(/^\/+/, '') // strip leading slashes
            .replace(/\/+/g, '/') // collapse repeated slashes
            .replace(/\/+$/, ''); // strip trailing slashes
    }
    detectLanguage(path) {
        const filename = path.split('/').pop() ?? '';
        // Check full filename first (Dockerfile, Makefile, etc.)
        if (FILENAME_LANGUAGES[filename])
            return FILENAME_LANGUAGES[filename];
        // Check extension
        const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : '';
        return EXTENSION_LANGUAGES[ext] ?? 'plaintext';
    }
    sortTree(nodes) {
        nodes.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory)
                return a.isDirectory ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        for (const node of nodes) {
            if (node.children)
                this.sortTree(node.children);
        }
    }
    notify() {
        this.snapshot = this.list();
        for (const fn of this.listeners)
            fn();
    }
}
// ---------------------------------------------------------------------------
// VirtualFS — IndexedDB-backed persistent virtual filesystem
// ---------------------------------------------------------------------------
const IDB_NAME = 'kickstart-vfs';
const IDB_VERSION = 1;
const IDB_STORE = 'files';
function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(IDB_STORE, { keyPath: 'path' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
/**
 * IndexedDB-backed virtual filesystem.
 *
 * Files are stored as `{ path, content }` records in an IDB object store.
 * All methods are async. Subscribe to change notifications via `subscribe()`.
 */
export class VirtualFS {
    dbPromise;
    listeners = new Set();
    constructor() {
        this.dbPromise = openIDB();
    }
    async writeFile(path, content) {
        const db = await this.dbPromise;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put({ path, content });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        this.notify();
    }
    async readFile(path) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).get(path);
            req.onsuccess = () => {
                if (req.result)
                    resolve(req.result.content);
                else
                    reject(new Error(`File not found: ${path}`));
            };
            req.onerror = () => reject(req.error);
        });
    }
    async listFiles(dir) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).getAllKeys();
            req.onsuccess = () => {
                const keys = req.result;
                resolve(dir ? keys.filter((k) => k.startsWith(dir)) : keys);
            };
            req.onerror = () => reject(req.error);
        });
    }
    async deleteFile(path) {
        const db = await this.dbPromise;
        await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).delete(path);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        this.notify();
    }
    async exists(path) {
        const db = await this.dbPromise;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).count(IDBKeyRange.only(path));
            req.onsuccess = () => resolve(req.result > 0);
            req.onerror = () => reject(req.error);
        });
    }
    async exportZip() {
        const { default: JSZip } = await import('jszip');
        const db = await this.dbPromise;
        const records = await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const req = tx.objectStore(IDB_STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const zip = new JSZip();
        for (const { path, content } of records) {
            zip.file(path, content);
        }
        return zip.generateAsync({ type: 'blob' });
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    notify() {
        for (const fn of this.listeners)
            fn();
    }
}
//# sourceMappingURL=virtual-fs.js.map