// Filesystem abstraction — pluggable file I/O providers

// Types
export type { FileEntry, FileSystemProvider } from "./types.js";
export { FileNotFoundError, InvalidPathError } from "./types.js";

// Path utilities
export { sanitizePath } from "./path-utils.js";

// Providers
export { InMemoryFileSystemProvider } from "./in-memory-provider.js";
export { CloudShellProvider } from "./cloud-shell-provider.js";

// Registry
export {
  FileSystemProviderRegistry,
  defaultFileSystemRegistry,
} from "./registry.js";
