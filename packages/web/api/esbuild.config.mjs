/**
 * esbuild config for @kickstart/api
 *
 * Bundles each Azure Function entry point into a self-contained ESM file.
 * @kickstart/core is inlined (not published to npm), while @azure/functions,
 * bicep-node, and Node.js built-ins stay external (resolved from node_modules
 * at runtime).
 */

import * as esbuild from "esbuild";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const entryPoints = readdirSync("src/functions")
  .filter((f) => f.endsWith(".ts"))
  .filter((f) => !f.endsWith(".test.ts") && !f.endsWith(".spec.ts"))
  .map((f) => join("src/functions", f));

await esbuild.build({
  entryPoints,
  bundle: true,
  outdir: "dist/functions",
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["@azure/functions", "bicep-node"],
  sourcemap: true,
});

console.log(`✅ Bundled ${entryPoints.length} function(s) to dist/functions/`);
