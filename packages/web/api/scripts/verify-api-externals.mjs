#!/usr/bin/env node
/**
 * verify-api-externals.mjs
 *
 * Post-build guard for issue #1030. Fails the build if:
 *   (a) dist/meta.json is missing or any required package is NOT marked external,
 *   (b) any required package's source is detectably bundled into dist/functions/*.js.
 *
 * Keeps esbuild honest when contributors "clean up" the external list.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, "..");
const DIST = resolve(API_ROOT, "dist");
const META = resolve(DIST, "meta.json");

const REQUIRED_EXTERNAL = [
  "@azure/monitor-opentelemetry",
  "@azure/monitor-opentelemetry-exporter",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
];

function fail(msg) {
  console.error(`[verify-api-externals] ✗ ${msg}`);
  process.exit(1);
}

let meta;
try {
  meta = JSON.parse(readFileSync(META, "utf8"));
} catch (err) {
  fail(`cannot read ${META}: ${err.message}`);
}

const inputs = Object.keys(meta.inputs ?? {});
const leaked = inputs.filter((k) =>
  REQUIRED_EXTERNAL.some((pkg) => k.includes(`node_modules/${pkg}/`) || k.includes(`node_modules\\${pkg}\\`)),
);
if (leaked.length > 0) {
  fail(
    `external packages were inlined into the bundle (esbuild metafile.inputs):\n  ` +
      leaked.slice(0, 10).join("\n  "),
  );
}

const outputs = meta.outputs ?? {};
const bundles = Object.keys(outputs).filter((k) => /dist[\\/]functions[\\/][^\\/]+\.js$/.test(k));
if (bundles.length === 0) fail(`no function bundles found under dist/functions/`);

for (const bundle of bundles) {
  const imports = outputs[bundle].imports ?? [];
  for (const pkg of REQUIRED_EXTERNAL) {
    for (const imp of imports) {
      if (imp.path === pkg || imp.path.startsWith(`${pkg}/`)) {
        if (imp.external !== true) {
          fail(`bundle ${bundle} imports ${imp.path} but it is not marked external`);
        }
      }
    }
  }
}

const require = createRequire(join(API_ROOT, "dist", "verify.cjs"));
for (const pkg of REQUIRED_EXTERNAL) {
  let resolved;
  try {
    resolved = require.resolve(pkg, { paths: [API_ROOT] });
  } catch (err) {
    fail(`require.resolve("${pkg}") failed from ${API_ROOT}: ${err.message}`);
  }
  if (!resolved.startsWith(API_ROOT + "/") && !resolved.startsWith(API_ROOT + "\\")) {
    console.warn(
      `[verify-api-externals] ⚠  ${pkg} resolved outside the API root: ${resolved}\n` +
        `    SWA zip only ships packages/web/api/ — run \`npm run postbuild\` to materialize.`,
    );
  }
}

console.log(`[verify-api-externals] ✓ ${bundles.length} bundle(s), ${REQUIRED_EXTERNAL.length} package(s) checked.`);
