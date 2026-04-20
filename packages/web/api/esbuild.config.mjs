/**
 * esbuild config for @kickstart/api
 *
 * Bundles each Azure Function entry point into a self-contained ESM file.
 * @kickstart/harness is inlined (not published to npm), while @azure/functions,
 * bicep-node, and Node.js built-ins stay external (resolved from node_modules
 * at runtime).
 */

import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_SRC = resolve(__dirname, "../../harness/src");

const entryPoints = readdirSync("src/functions")
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"))
  .map((f) => join("src/functions", f));

function copyMarkdownTree(sourceDir, targetDir) {
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(targetPath, { recursive: true });
      copyMarkdownTree(sourcePath, targetPath);
      continue;
    }
    if (entry.isFile() && sourcePath.endsWith(".md")) {
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(sourcePath, targetPath);
    }
  }
}

// esbuild's `alias` option does not handle subpath exports like
// `@kickstart/harness/runtime/sse`. A resolver plugin rewrites both the
// root specifier and any subpath to the corresponding `.ts` source file.
const harnessResolver = {
  name: "kickstart-harness-resolver",
  setup(build) {
    build.onResolve({ filter: /^@kickstart\/harness(\/.*)?$/ }, (args) => {
      const sub = args.path === "@kickstart/harness"
        ? "index"
        : args.path.slice("@kickstart/harness/".length);
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
  external: ["@azure/functions", "bicep-node"],
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
  ["../../pack-core/src/agents", "dist/functions/agents"],
  ["../../pack-core/src/skills", "dist/functions/skills"],
  ["../../pack-azure/src/agents", "dist/functions/agents"],
  ["../../pack-azure/src/skills", "dist/functions/skills"],
  ["../../pack-aks-automatic/src/agents", "dist/functions/agents"],
  ["../../pack-aks-automatic/src/skills", "dist/functions/skills"],
  ["../../pack-github/agents", "dist/agents"],
  ["../../pack-github/skills", "dist/skills"],
];

for (const [sourceRelative, targetRelative] of bundleAssetCopies) {
  const sourceDir = resolve(__dirname, sourceRelative);
  if (!statSync(sourceDir).isDirectory()) {
    throw new Error(`Expected asset directory at ${sourceDir}`);
  }
  copyMarkdownTree(sourceDir, resolve(__dirname, targetRelative));
}
