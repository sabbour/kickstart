/**
 * esbuild config for @kickstart/api
 *
 * Bundles each Azure Function entry point into a self-contained ESM file.
 * @kickstart/harness is inlined (not published to npm), while @azure/functions,
 * bicep-node, and Node.js built-ins stay external (resolved from node_modules
 * at runtime).
 */

import * as esbuild from "esbuild";
import { readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HARNESS_SRC = resolve(__dirname, "../../harness/src");

const functionFiles = readdirSync("src/functions")
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"));

const entryPoints = functionFiles.map((f) => join("src/functions", f));

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
  target: "node20",
  external: ["@azure/functions", "bicep-node"],
  sourcemap: true,
  plugins: [harnessResolver],
});

console.log(`✅ Bundled ${entryPoints.length} function(s) to dist/functions/`);

// Emit a single entry file that imports every function bundle for its
// side-effect `app.http()` registrations. Azure Functions v4 loads the
// path declared in package.json "main" and expects that module to register
// every function. A glob (e.g. `dist/functions/*.js`) is silently ignored
// by the runtime, which is why we must materialise an explicit index.js.
const imports = functionFiles
  .map((f) => `import "./functions/${f.replace(/\.ts$/, ".js")}";`)
  .join("\n");
writeFileSync("dist/index.js", `${imports}\n`);

console.log(`✅ Wrote dist/index.js with ${functionFiles.length} registration import(s)`);
