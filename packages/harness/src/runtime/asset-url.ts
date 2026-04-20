import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function resolveAssetURL(metaUrl: string, sourceRelative: string, bundledRelative: string): URL {
  const sourceUrl = new URL(sourceRelative, metaUrl);
  if (existsSync(fileURLToPath(sourceUrl))) {
    return sourceUrl;
  }
  return new URL(bundledRelative, metaUrl);
}
