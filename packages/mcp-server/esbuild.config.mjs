/**
 * esbuild config for @sabbour/kickstart-mcp
 *
 * Bundles the MCP server entry point into a self-contained ESM file, then
 * copies pack agent/skill markdown assets to the locations that
 * resolveAssetURL expects when running from a bundled dist.
 *
 * Mirrors the approach used by packages/web/api/esbuild.config.mjs.
 */

import * as esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const RUNTIME_ASSET_MATCHERS = [
  (filePath) => filePath.endsWith('.agent.md'),
  (filePath) => filePath.endsWith('SKILL.md'),
];

function isRuntimeAsset(filePath) {
  return RUNTIME_ASSET_MATCHERS.some((matcher) => matcher(filePath));
}

function copyMarkdownTree(sourceDir, targetDir, seenTargets) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyMarkdownTree(sourcePath, targetPath, seenTargets);
      continue;
    }
    if (entry.isFile() && isRuntimeAsset(sourcePath)) {
      const targetKey = relative(__dirname, targetPath).replace(/\\/g, '/');
      const previousSource = seenTargets.get(targetKey);
      if (previousSource && previousSource !== sourcePath) {
        throw new Error(
          `Runtime asset collision for ${targetKey}: ${previousSource} conflicts with ${sourcePath}`,
        );
      }
      seenTargets.set(targetKey, sourcePath);
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

// Resolve @aks-kickstart/* packages to their TypeScript source files so that
// browser-only components (Monaco, React, Vite workers) are never reached.
// This mirrors the approach used by packages/web/api/esbuild.config.mjs.
const WORKSPACE_ROOT = resolve(__dirname, '../..');
const packSrcMap = {
  '@aks-kickstart/harness': resolve(WORKSPACE_ROOT, 'packages/harness/src'),
  '@aks-kickstart/pack-core': resolve(WORKSPACE_ROOT, 'packages/pack-core/src'),
  '@aks-kickstart/pack-azure': resolve(WORKSPACE_ROOT, 'packages/pack-azure/src'),
  '@aks-kickstart/pack-aks-automatic': resolve(WORKSPACE_ROOT, 'packages/pack-aks-automatic/src'),
  '@aks-kickstart/pack-github': resolve(WORKSPACE_ROOT, 'packages/pack-github/src'),
};

const workspaceResolver = {
  name: 'kickstart-workspace-resolver',
  setup(build) {
        build.onResolve({ filter: /^@aks-kickstart\// }, (args) => {
          for (const [pkg, srcDir] of Object.entries(packSrcMap)) {
            if (args.path === pkg) {
              return { path: resolve(srcDir, 'index.ts') };
            }
            if (args.path.startsWith(pkg + '/')) {
              const sub = args.path.slice(pkg.length + 1);
              const candidate = resolve(srcDir, sub + '.ts');
              const candidateIndex = resolve(srcDir, sub, 'index.ts');
              if (existsSync(candidate)) return { path: candidate };
              if (existsSync(candidateIndex)) return { path: candidateIndex };
              return { path: resolve(srcDir, sub) };
            }
          }
        });
  },
};

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  // Browser-only packages are stubbed by the 'stub-browser-assets' plugin.
  // Only react/react-dom need to be external (they're not imported by server code
  // but may appear as peer-dep type-only imports that esbuild should skip).
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  // Treat Vite-specific ?worker and CSS/font imports as empty stubs.
  plugins: [
    workspaceResolver,
    {
      name: 'stub-browser-assets',
      setup(build) {
        // ?worker imports (Vite syntax — never valid in Node.js bundles)
        build.onResolve({ filter: /\?worker$/ }, () => ({ path: 'stub', namespace: 'browser-stub' }));
        // Browser-only UI packages — stub with loader:'empty' so named imports become
        // undefined without errors (esbuild ≥0.14.11 behaviour for loader:'empty')
        build.onResolve(
          { filter: /^(@fluentui\/|mermaid|@mermaid-js\/|monaco-editor)/ },
          () => ({ path: 'stub', namespace: 'browser-stub' }),
        );
        // CSS and font files pulled in by monaco-editor / Fluent UI / mermaid
        build.onResolve(
          { filter: /\.(css|ttf|woff2?)(\?.*)?$/ },
          () => ({ path: 'stub', namespace: 'browser-stub' }),
        );
        build.onLoad({ filter: /.*/, namespace: 'browser-stub' }, () => ({
          contents: '',
          loader: 'empty',
        }));
      },
    },
  ],
  banner: {
    js: "import { createRequire as __kickstartCreateRequire } from 'node:module'; const require = __kickstartCreateRequire(import.meta.url);",
  },
  sourcemap: false,
});

console.log('✅ Bundled MCP server to dist/index.js');

// Copy the kickstart-app.html asset (referenced at runtime for VS Code resource URI).
const appDir = resolve(__dirname, 'dist/app');
mkdirSync(appDir, { recursive: true });
copyFileSync(resolve(__dirname, 'src/app/kickstart-app.html'), join(appDir, 'kickstart-app.html'));

// Pack agent/skill markdown is loaded at runtime from agentsDir/skillsDir URLs.
// resolveAssetURL falls back to ./pack-assets/<pack>/<type>/ when the source
// dir doesn't exist next to the bundle — copy assets there.
const bundleAssetCopies = [
  ['../pack-core/src/agents', 'dist/pack-assets/core/agents'],
  ['../pack-core/src/skills', 'dist/pack-assets/core/skills'],
  ['../pack-azure/src/agents', 'dist/pack-assets/azure/agents'],
  ['../pack-azure/src/skills', 'dist/pack-assets/azure/skills'],
  ['../pack-aks-automatic/src/agents', 'dist/pack-assets/aks/agents'],
  ['../pack-aks-automatic/src/skills', 'dist/pack-assets/aks/skills'],
  ['../pack-github/agents', 'dist/pack-assets/github/agents'],
  ['../pack-github/skills', 'dist/pack-assets/github/skills'],
];

const seenBundleTargets = new Map();

// Always create all pack asset target directories — resolveAssetURL falls back
// to these paths even when a pack has no agents/skills, and directoryURLToPath
// will throw if the directory is missing.
for (const [, targetRelative] of bundleAssetCopies) {
  mkdirSync(resolve(__dirname, targetRelative), { recursive: true });
}

for (const [sourceRelative, targetRelative] of bundleAssetCopies) {
  const sourceDir = resolve(__dirname, sourceRelative);
  try {
    if (!statSync(sourceDir).isDirectory()) continue;
  } catch {
    // Directory doesn't exist (e.g. pack has no skills) — skip silently.
    continue;
  }
  copyMarkdownTree(sourceDir, resolve(__dirname, targetRelative), seenBundleTargets);
}

console.log(`✅ Copied ${seenBundleTargets.size} runtime asset(s) to dist/pack-assets/`);
