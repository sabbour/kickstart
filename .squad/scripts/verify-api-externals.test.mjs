/**
 * T1 — externals-not-inlined binding test (DP #1030 amendment 2).
 *
 * Reads `packages/web/api/dist/meta.json` (written by esbuild.config.mjs with
 * `metafile: true` + explicit `writeFileSync`) and asserts that no inputs
 * belonging to the required-external packages appear in the bundle graph.
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

const REQUIRED_EXTERNAL = [
  "@azure/monitor-opentelemetry",
  "@azure/monitor-opentelemetry-exporter",
  "@opentelemetry/api",
  "@opentelemetry/api-logs",
];

describe("T1 — externals-not-inlined (issue #1030)", () => {
  it.skipIf(!existsSync(META))("no required-external package source leaked into dist/meta.json inputs", () => {
    const meta = JSON.parse(readFileSync(META, "utf8"));
    const inputs = Object.keys(meta.inputs ?? {});
    const leaked = inputs.filter((k) =>
      REQUIRED_EXTERNAL.some((pkg) => k.includes(`node_modules/${pkg}/`)),
    );
    expect(leaked).toEqual([]);
  });

  it.skipIf(!existsSync(META))("every bundle import matching a required-external package is marked external: true", () => {
    const meta = JSON.parse(readFileSync(META, "utf8"));
    const outputs = meta.outputs ?? {};
    const bundles = Object.keys(outputs).filter((k) => /dist[\\/]functions[\\/][^\\/]+\.js$/.test(k));
    expect(bundles.length).toBeGreaterThan(0);
    for (const bundle of bundles) {
      const imports = outputs[bundle].imports ?? [];
      for (const imp of imports) {
        if (REQUIRED_EXTERNAL.some((p) => imp.path === p || imp.path.startsWith(`${p}/`))) {
          expect(imp.external, `${bundle} → ${imp.path} must be external`).toBe(true);
        }
      }
    }
  });
});
