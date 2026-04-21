/**
 * esbuild config for @aks-kickstart/api
 *
 * Bundles each Azure Function entry point into a self-contained ESM file.
 * All npm dependencies (including @azure/functions and bicep-node) are inlined;
 * only Node.js built-ins stay external.  Making the bundles self-contained
 * avoids a deployment-time issue where npm workspace hoisting keeps those
 * packages in the repo root node_modules rather than packages/web/api/node_modules,
 * causing the Functions worker to fail to resolve them in Azure SWA.
 */

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_SRC = resolve(__dirname, "../../harness/src");

const entryPoints = readdirSync("src/functions")
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"))
  .map((f) => join("src/functions", f));

const RUNTIME_ASSET_MATCHERS = [
  (filePath) => filePath.endsWith(".agent.md"),
  (filePath) => filePath.endsWith("SKILL.md"),
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
      const targetKey = relative(__dirname, targetPath).replace(/\\/g, "/");
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

// esbuild's `alias` option does not handle subpath exports like
// `@aks-kickstart/harness/runtime/sse`. A resolver plugin rewrites both the
// root specifier and any subpath to the corresponding `.ts` source file.
const harnessResolver = {
  name: "kickstart-harness-resolver",
  setup(build) {
    build.onResolve({ filter: /^@kickstart\/harness(\/.*)?$/ }, (args) => {
      const sub = args.path === "@aks-kickstart/harness"
        ? "index"
        : args.path.slice("@aks-kickstart/harness/".length);
      return { path: resolve(HARNESS_SRC, `${sub}.ts`) };
    });
  },
};

await esbuild.build({
  entryPoints,
  bundle: true,
  outdir: "dist/functions",
  format: "esm",
  platform: "node",
  target: "node22",
  // @azure/functions-core is the only module that must stay external — it is a
  // virtual module injected by the Azure Functions Node.js worker host at
  // runtime and is never present in node_modules.  All other npm dependencies
  // (including @azure/functions and bicep-node) are pure JavaScript and are
  // bundled inline so that dist/functions/*.js files are self-contained.
  //
  // Background: npm workspace hoisting keeps these packages in the repo root
  // node_modules rather than packages/web/api/node_modules, and the
  // packages/web/api/.npmrc "workspaces=false" override is silently ignored in
  // CI (npm warns "ignoring workspace config").  Bundling them removes the
  // runtime dependency on node_modules entirely.
  external: ["@azure/functions-core"],
  banner: {
    js: "import { createRequire as __kickstartCreateRequire } from 'node:module'; const require = __kickstartCreateRequire(import.meta.url);",
  },
  // Source maps bloat the SWA upload and aren't used by the Functions host.
  // Enable locally by setting KICKSTART_API_SOURCEMAP=1.
  sourcemap: process.env.KICKSTART_API_SOURCEMAP === "1",
  plugins: [harnessResolver],
});

console.log(`✅ Bundled ${entryPoints.length} function(s) to dist/functions/`);

// Pack agent/skill markdown is loaded at runtime from agentsDir/skillsDir URLs.
// After bundling, those URLs resolve relative to dist/, so copy the markdown
// assets into the exact locations the bundle will read from.
const bundleAssetCopies = [
  ["../../pack-core/src/agents", "dist/functions/pack-assets/core/agents"],
  ["../../pack-core/src/skills", "dist/functions/pack-assets/core/skills"],
  ["../../pack-azure/src/agents", "dist/functions/pack-assets/azure/agents"],
  ["../../pack-azure/src/skills", "dist/functions/pack-assets/azure/skills"],
  ["../../pack-aks-automatic/src/agents", "dist/functions/pack-assets/aks/agents"],
  ["../../pack-aks-automatic/src/skills", "dist/functions/pack-assets/aks/skills"],
  ["../../pack-github/agents", "dist/functions/pack-assets/github/agents"],
  ["../../pack-github/skills", "dist/functions/pack-assets/github/skills"],
];

const seenBundleTargets = new Map();

for (const [sourceRelative, targetRelative] of bundleAssetCopies) {
  const sourceDir = resolve(__dirname, sourceRelative);
  if (!statSync(sourceDir).isDirectory()) {
    throw new Error(`Expected asset directory at ${sourceDir}`);
  }
  copyMarkdownTree(sourceDir, resolve(__dirname, targetRelative), seenBundleTargets);
}
