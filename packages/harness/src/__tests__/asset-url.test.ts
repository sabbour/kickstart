import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveAssetURL } from '../runtime/asset-url.js';

const fixtureRoot = join(process.cwd(), 'packages', 'harness', '.asset-url-test-fixtures');

afterEach(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

function writeFixture(relativePath: string, content = ''): string {
  const fullPath = join(fixtureRoot, relativePath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

describe('resolveAssetURL', () => {
  it('prefers the source-relative asset path when it exists', () => {
    const manifestPath = writeFixture('source/server-manifest.mjs', '');
    const sourceDir = writeFixture('source/agents/.keep', '');

    const resolved = resolveAssetURL(
      pathToFileURL(manifestPath).href,
      './agents/',
      './pack-assets/core/agents/',
    );

    expect(resolved.href).toBe(pathToFileURL(`${dirname(sourceDir)}/`).href);
  });

  it('falls back to the bundled asset path when the source path is absent', () => {
    const manifestPath = writeFixture('dist/functions/converse.mjs', '');
    writeFixture('dist/functions/pack-assets/core/agents/.keep', '');

    const resolved = resolveAssetURL(
      pathToFileURL(manifestPath).href,
      './agents/',
      './pack-assets/core/agents/',
    );

    expect(resolved.href).toBe(
      pathToFileURL(`${join(fixtureRoot, 'dist/functions/pack-assets/core/agents')}/`).href,
    );
  });
});
