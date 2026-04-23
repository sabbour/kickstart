import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

/**
 * Node.js built-in stubs shared by the Vite (rolldown) plugin and the
 * esbuild optimizeDeps plugin. These modules are never actually called in
 * browser code — only the static imports need to resolve cleanly.
 */
const _throws = `const _notBrowser = () => { throw new Error('Node.js built-in not available in browser context'); };`;
const nodeBuiltinStubs: Record<string, string> = {
  'node:fs': [
    _throws,
    `export const readFileSync = _notBrowser;`,
    `export const realpathSync = _notBrowser;`,
    `export const statSync = _notBrowser;`,
    `export const readdirSync = _notBrowser;`,
    `export const existsSync = () => false;`,
    `export const mkdirSync = _notBrowser;`,
    `export const writeFileSync = _notBrowser;`,
    `export const unlinkSync = _notBrowser;`,
    `export const promises = { readFile: _notBrowser, writeFile: _notBrowser, mkdir: _notBrowser, readdir: _notBrowser, unlink: _notBrowser, stat: _notBrowser };`,
    `export default { readFileSync, realpathSync, statSync, readdirSync, existsSync, mkdirSync, writeFileSync, unlinkSync, promises };`,
  ].join('\n'),
  'node:path': [
    _throws,
    `export const resolve = _notBrowser;`,
    `export const relative = _notBrowser;`,
    `export const join = (...p) => p.filter(Boolean).join('/');`,
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
  'node:os': [
    `export const type = () => 'Browser';`,
    `export const hostname = () => 'browser';`,
    `export const platform = () => 'browser';`,
    `export const arch = () => 'unknown';`,
    `export const release = () => '0.0.0';`,
    `export const tmpdir = () => '/tmp';`,
    `export const homedir = () => '/';`,
    `export default { type, hostname, platform, arch, release, tmpdir, homedir };`,
  ].join('\n'),
  'node:child_process': [
    `const _nop = () => { throw new Error('child_process not available in browser'); };`,
    `export const spawn = _nop;`,
    `export const spawnSync = _nop;`,
    `export const exec = _nop;`,
    `export default { spawn, spawnSync, exec };`,
  ].join('\n'),
  'node:process': [
    `const p = (typeof globalThis !== 'undefined' && globalThis.process) || { env: {}, platform: 'browser', versions: {}, pid: 0 };`,
    `export const env = p.env || {};`,
    `export const platform = p.platform || 'browser';`,
    `export const versions = p.versions || {};`,
    `export const pid = p.pid || 0;`,
    `export default p;`,
  ].join('\n'),
};

/** Vite (rolldown) plugin — handles production builds and dev-served source. */
function stubNodeBuiltins(): Plugin {
  return {
    name: 'stub-node-builtins',
    enforce: 'pre',
    resolveId(id) {
      if (Object.prototype.hasOwnProperty.call(nodeBuiltinStubs, id)) return `\0${id}`;
    },
    load(id) {
      if (!id.startsWith('\0')) return;
      const realId = id.slice(1);
      return nodeBuiltinStubs[realId] ?? null;
    },
  };
}

/**
 * Rolldown plugin for Vite's optimizeDeps pre-bundling (dev mode only).
 * In dev, Vite 8 pre-bundles node_modules with Rolldown in a separate pass
 * that does NOT run the main Vite plugin pipeline. So `node:*` imports in
 * dependencies (e.g. @azure/monitor-opentelemetry-exporter → node:process)
 * get externalized instead of stubbed. This plugin intercepts those imports
 * during pre-bundling and returns the same inline stubs used in production.
 */
function stubNodeBuiltinsOptimizeDeps(): Plugin {
  return {
    name: 'stub-node-builtins-optimize-deps',
    resolveId(id) {
      if (Object.prototype.hasOwnProperty.call(nodeBuiltinStubs, id)) return `\0opt:${id}`;
    },
    load(id) {
      if (!id.startsWith('\0opt:')) return;
      const realId = id.slice('\0opt:'.length);
      return nodeBuiltinStubs[realId] ?? null;
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
      // Force `zod/v4` to resolve to the monorepo-root `zod` install (the v4
      // instance that `openai` + `zod-to-json-schema` — hoisted to root —
      // actually bundle). `configure-zod.ts` mutates its `globalConfig` to set
      // `jitless: true` so Zod v4's `allowsEval` probe (`new Function`) never
      // fires under `script-src 'self'`. Without this alias, web-local
      // `packages/web/node_modules/zod`'s v4 subpath is a separate module
      // instance and the mutation has no effect on the bundled code. #1042.
      'zod/v4': resolve(__dirname, '../../node_modules/zod/v4/index.js'),
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
  optimizeDeps: {
    rolldownOptions: {
      plugins: [stubNodeBuiltinsOptimizeDeps()],
    },
  },
  json: {
    stringify: true,
  },
});
