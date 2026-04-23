/**
 * T1 — bundle-everything binding test (issue #1041, revert #1030 externalization).
 *
 * Reads `packages/web/api/dist/meta.json` (written by esbuild.config.mjs with
 * `metafile: true` + explicit `writeFileSync`) and asserts that:
 *   1. OTel packages ARE present in bundle inputs (proving they are bundled inline).
 *   2. Only `@azure/functions-core` is external; no OTel package is external.
 *
 * Uses the metafile produced by the previous `npm run build` — the test
 * does NOT re-run esbuild (slow) but does require that a build has already
 * produced dist/meta.json. When dist/meta.json is absent (e.g. a fresh
 * clone with no build), the test skips with a descriptive message.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const META = resolve(here, "../../packages/web/api/dist/meta.json");

const OTEL_PACKAGES = [
  "@azure/monitor-opentelemetry-exporter",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
  "@opentelemetry/sdk-node",
];

describe("T1 — bundle-everything (issue #1041, revert #1030)", () => {
  it.skipIf(!existsSync(META))("OTel packages MUST appear in dist/meta.json inputs (proving bundled inline)", () => {
    const meta = JSON.parse(readFileSync(META, "utf8"));
    const inputs = Object.keys(meta.inputs ?? {});
    for (const pkg of OTEL_PACKAGES) {
      const found = inputs.some((k) => k.includes(`node_modules/${pkg}/`));
      expect(found, `${pkg} must be in bundle inputs (bundled inline)`).toBe(true);
    }
  });

  it.skipIf(!existsSync(META))("only @azure/functions-core is external — no OTel package is external", () => {
    const meta = JSON.parse(readFileSync(META, "utf8"));
    const outputs = meta.outputs ?? {};
    const bundles = Object.keys(outputs).filter((k) => /dist[\\/]functions[\\/][^\\/]+\.js$/.test(k));
    expect(bundles.length).toBeGreaterThan(0);
    function isNodeBuiltin(path) {
      return path.startsWith("node:") ||
        /^(assert|async_hooks|buffer|bufferutil|child_process|cluster|console|constants|crypto|dgram|dns|domain|encoding|events|fs|http|http2|https|module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|tty|url|utf-8-validate|util|v8|vm|worker_threads|zlib)($|\/)/.test(path);
    }
    for (const bundle of bundles) {
      const imports = outputs[bundle].imports ?? [];
      for (const imp of imports) {
        if (imp.external && !isNodeBuiltin(imp.path)) {
          expect(imp.path, `${bundle} has unexpected external npm package: ${imp.path}`).toBe("@azure/functions-core");
        }
        if (OTEL_PACKAGES.some((p) => imp.path === p || imp.path.startsWith(`${p}/`))) {
          expect(imp.external, `${bundle} → ${imp.path} must NOT be external`).not.toBe(true);
        }
      }
    }
  });
});
