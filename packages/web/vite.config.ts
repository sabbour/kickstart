import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Stubs Node.js built-ins that are pulled into the browser bundle transitively
 * (e.g. harness/runtime/registry → node:fs). These modules are never actually
 * called in browser code — only the static imports need to resolve cleanly.
 */
function stubNodeBuiltins(): Plugin {
  const _throws = `const _notBrowser = () => { throw new Error('Node.js built-in not available in browser context'); };`;
  const stubs: Record<string, string> = {
    'node:fs': [
      _throws,
      `export const readFileSync = _notBrowser;`,
      `export const realpathSync = _notBrowser;`,
      `export const statSync = _notBrowser;`,
      `export const readdirSync = _notBrowser;`,
      `export default { readFileSync, realpathSync, statSync, readdirSync };`,
    ].join('\n'),
    'node:path': [
      _throws,
      `export const resolve = _notBrowser;`,
      `export const relative = _notBrowser;`,
      `export const join = _notBrowser;`,
      `export const dirname = _notBrowser;`,
      `export const basename = _notBrowser;`,
      `export const extname = _notBrowser;`,
      `export const sep = '/';`,
      `export default { resolve, relative, join, dirname, basename, extname, sep };`,
    ].join('\n'),
    'node:crypto': [
      `export const randomUUID = () => globalThis.crypto.randomUUID();`,
      `export default { randomUUID };`,
    ].join('\n'),
    'node:url': [
      `export const fileURLToPath = (url) => typeof url === 'string' ? url.replace(/^file:\\/\\//, '') : url.pathname;`,
      `export const pathToFileURL = (p) => new URL('file://' + p);`,
      `export default { fileURLToPath, pathToFileURL };`,
    ].join('\n'),
  };
  return {
    name: 'stub-node-builtins',
    // Must run before Vite/rolldown's built-in node externalization.
    enforce: 'pre',
    resolveId(id) {
      if (Object.prototype.hasOwnProperty.call(stubs, id)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith('\0')) return;
      const realId = id.slice(1);
      return stubs[realId] ?? null;
    },
  };
}

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

function getShortSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GITHUB_SHA?.substring(0, 7) || 'dev';
  }
}

function getFullSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GITHUB_SHA || 'dev';
  }
}

const shortSha = getShortSha();
const fullSha = getFullSha();

export default defineConfig({
  plugins: [react(), stubNodeBuiltins()],
  define: {
    __BUILD_VERSION__: JSON.stringify(`${rootPkg.version}-${shortSha}`),
    __BUILD_SHA__: JSON.stringify(shortSha),
    __BUILD_SHA_FULL__: JSON.stringify(fullSha),
  },
  resolve: {
    // Force a single copy of React even when the monorepo has multiple (the root
    // hoists react@18 for other workspaces, packages/web requires react@19).
    // Without this, Fluent UI and the app can load different React instances →
    // "Invalid hook call" at runtime.
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, 'src'),
      '@aks-kickstart/harness': resolve(__dirname, '../harness/src/index.ts'),
      '@aks-kickstart/pack-azure/client': resolve(__dirname, '../pack-azure/src/client.ts'),
      '@aks-kickstart/pack-aks-automatic/client': resolve(__dirname, '../pack-aks-automatic/src/client.ts'),
      '@aks-kickstart/pack-github/client': resolve(__dirname, '../pack-github/src/client.ts'),
      react: resolve(__dirname, 'node_modules/react'),
      'react-dom': resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Monaco editor (editor.api2) is lazily loaded and unavoidably ~3.6 MB.
    // Raise the warning limit so only genuinely unexpected large chunks surface.
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // Stable vendor chunks — cached independently of app code.
          if (id.includes('/node_modules/@fluentui/react-icons')) return 'vendor-fluent-icons';
          if (id.includes('/node_modules/@fluentui/')) return 'vendor-fluent';
          if (id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/')) return 'vendor-react';
          if (id.includes('/node_modules/zod/')) return 'vendor-zod';
          if (id.includes('/node_modules/yaml/')) return 'vendor-yaml';
          if (id.includes('/node_modules/highlight.js/')) return 'vendor-highlight';
        },
      },
    },
  },
  json: {
    stringify: true,
  },
});
