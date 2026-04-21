#!/usr/bin/env node
/**
 * materialize-api-externals.mjs
 *
 * SWA's deploy action zips only `packages/web/api/`, so packages hoisted to
 * repo-root node_modules by npm workspaces never reach the running worker.
 * This script COPIES the externalized OTel + AppInsights packages (plus their
 * transitive deps) from the repo-root node_modules into
 * `packages/web/api/node_modules/` so they ship in the SWA zip.
 *
 * Uses `cp -r` rather than `npm install --prefix` because the API
 * package.json declares workspace deps (`@aks-kickstart/harness`) that the
 * public registry cannot resolve. Designed to be idempotent.
 */
import { existsSync, cpSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(API_ROOT, "../../..");
const ROOT_NM = resolve(REPO_ROOT, "node_modules");
const API_NM = resolve(API_ROOT, "node_modules");

// Top-level packages we externalize in esbuild.config.mjs + their
// direct runtime transitive closure that must also ship.
const TOP = [
  "applicationinsights",
  "@azure/monitor-opentelemetry",
  "@azure/monitor-opentelemetry-exporter",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
];

function walkDeps(name, seen) {
  if (seen.has(name)) return;
  seen.add(name);
  const pkgJsonPath = resolve(ROOT_NM, name, "package.json");
  if (!existsSync(pkgJsonPath)) return;
  let json;
  try { json = JSON.parse(readFileSync(pkgJsonPath, "utf8")); } catch { return; }
  for (const dep of Object.keys(json.dependencies ?? {})) {
    walkDeps(dep, seen);
  }
  for (const dep of Object.keys(json.optionalDependencies ?? {})) {
    if (existsSync(resolve(ROOT_NM, dep, "package.json"))) walkDeps(dep, seen);
  }
}

function copyPkg(name) {
  const src = resolve(ROOT_NM, name);
  const dst = resolve(API_NM, name);
  if (!existsSync(src)) return false;
  if (existsSync(dst) && !process.env.FORCE_MATERIALIZE) return false; // idempotent
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true, dereference: false });
  return true;
}

const closure = new Set();
for (const t of TOP) walkDeps(t, closure);

console.log(`[materialize-api-externals] copying ${closure.size} package(s) from root node_modules into ${API_NM}`);
let copied = 0;
for (const name of closure) {
  if (copyPkg(name)) copied++;
}
// Also verify top-level packages are resolvable from API_ROOT afterwards.
const missing = TOP.filter((t) => !existsSync(resolve(API_NM, t, "package.json")));
if (missing.length > 0) {
  console.error(`[materialize-api-externals] ✗ still missing from API node_modules: ${missing.join(", ")}`);
  process.exit(1);
}
console.log(`[materialize-api-externals] ✓ done (${copied} newly copied)`);
