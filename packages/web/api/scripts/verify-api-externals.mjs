#!/usr/bin/env node
/**
 * verify-api-externals.mjs
 *
 * Post-build guard for issue #1041 (revert #1030 externalization).
 * Fails the build if:
 *   (a) dist/meta.json is missing,
 *   (b) anything other than @azure/functions-core appears as external in any bundle,
 *   (c) OTel / Azure Monitor packages are NOT present in bundle inputs
 *       (they must be bundled inline).
 *
 * Keeps esbuild honest when contributors add packages to the external list.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, "..");
const DIST = resolve(API_ROOT, "dist");
const META = resolve(DIST, "meta.json");

const ONLY_ALLOWED_EXTERNAL = "@azure/functions-core";

// Node.js built-in modules are automatically external with platform: "node".
// We only care about npm packages (those starting with @scope/ or a bare name
// that is not a Node built-in).
function isNodeBuiltin(path) {
  return path.startsWith("node:") ||
    /^(assert|async_hooks|buffer|bufferutil|child_process|cluster|console|constants|crypto|dgram|dns|domain|encoding|events|fs|http|http2|https|module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|utf-8-validate|util|v8|vm|worker_threads|zlib)($|\/)/.test(path);
}

const MUST_BE_INLINED = [
  "@azure/monitor-opentelemetry",
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

const outputs = meta.outputs ?? {};
const bundles = Object.keys(outputs).filter((k) => /dist[\\/]functions[\\/][^\\/]+\.js$/.test(k));
if (bundles.length === 0) fail(`no function bundles found under dist/functions/`);

// (b) Only @azure/functions-core may be external (among npm packages)
for (const bundle of bundles) {
  const imports = outputs[bundle].imports ?? [];
  for (const imp of imports) {
    if (imp.external && !isNodeBuiltin(imp.path) && imp.path !== ONLY_ALLOWED_EXTERNAL) {
      fail(
        `bundle ${bundle} has unexpected external npm import: ${imp.path}\n` +
          `  Only ${ONLY_ALLOWED_EXTERNAL} may be external (Node built-ins are allowed).`,
      );
    }
  }
}

// (c) OTel packages must appear in meta.inputs (proving they are bundled inline)
const inputs = Object.keys(meta.inputs ?? {});
for (const pkg of MUST_BE_INLINED) {
  const found = inputs.some(
    (k) => k.includes(`node_modules/${pkg}/`) || k.includes(`node_modules\\${pkg}\\`),
  );
  if (!found) {
    fail(
      `${pkg} is NOT present in bundle inputs — it must be bundled inline, not external.\n` +
        `  Check esbuild.config.mjs external list.`,
    );
  }
}

console.log(`[verify-api-externals] ✓ ${bundles.length} bundle(s) verified: only @azure/functions-core external; OTel packages inlined.`);

