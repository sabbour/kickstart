/**
 * Hadolint validator — lints Dockerfiles via stdin pipe.
 *
 * Binary resolution order:
 *   1. Check PATH for `hadolint`
 *   2. Download pinned release to node_modules/.cache on first use
 *   3. Graceful skip with reason if unavailable
 *
 * Security: content is piped to stdin — no temp files, no shell expansion.
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { get as httpsGet } from 'node:https';
import type { ValidatorResult, Violation } from './index.js';

const HADOLINT_VERSION = 'v2.12.0';
const HADOLINT_URL = `https://github.com/hadolint/hadolint/releases/download/${HADOLINT_VERSION}/hadolint-Linux-x86_64`;

/** Cache directory for downloaded binaries. */
function cacheDir(): string {
  return join(process.cwd(), 'node_modules', '.cache', 'kickstart-validators');
}

/** Attempt to find hadolint on PATH. */
function findOnPath(): string | null {
  try {
    const result = execFileSync('which', ['hadolint'], {
      encoding: 'utf-8',
      timeout: 5_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/** Download hadolint to cache directory. Returns path or null on failure. */
async function downloadHadolint(): Promise<string | null> {
  const dir = cacheDir();
  const binaryPath = join(dir, 'hadolint');

  if (existsSync(binaryPath)) {
    return binaryPath;
  }

  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const follow = (url: string, redirects = 0): void => {
      if (redirects > 5) {
        resolve(null);
        return;
      }

      httpsGet(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location, redirects + 1);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          resolve(null);
          return;
        }

        const ws = createWriteStream(binaryPath);
        res.pipe(ws);
        ws.on('finish', () => {
          ws.close();
          try {
            chmodSync(binaryPath, 0o755);
            resolve(binaryPath);
          } catch {
            resolve(null);
          }
        });
        ws.on('error', () => {
          resolve(null);
        });
      }).on('error', () => {
        resolve(null);
      });
    };

    follow(HADOLINT_URL);
  });
}

/** Resolve hadolint binary path: PATH → cache → download → null. */
export async function resolveHadolint(): Promise<string | null> {
  const onPath = findOnPath();
  if (onPath) return onPath;

  return downloadHadolint();
}

/** Map hadolint severity to our severity. */
function mapSeverity(level: string): 'error' | 'warning' | 'info' {
  switch (level.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    case 'style':
      return 'info';
    default:
      return 'info';
  }
}

/** Raw hadolint JSON output item. */
interface HadolintItem {
  line: number;
  code: string;
  message: string;
  level: string;
}

/**
 * Parse hadolint JSON output into our Violation schema.
 * Exported for unit testing.
 */
export function parseHadolintOutput(json: string): Violation[] {
  let items: HadolintItem[];
  try {
    items = JSON.parse(json) as HadolintItem[];
  } catch {
    return [];
  }

  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    rule: item.code ?? 'unknown',
    severity: mapSeverity(item.level ?? 'info'),
    line: item.line ?? 0,
    message: item.message ?? '',
  }));
}

/**
 * Run hadolint on Dockerfile content via stdin pipe.
 * Returns structured ValidatorResult — never throws.
 */
export async function runHadolint(
  path: string,
  content: string,
): Promise<ValidatorResult> {
  const binary = await resolveHadolint();

  if (!binary) {
    return {
      path,
      status: 'skipped',
      violations: [],
      reason: 'hadolint binary not available (not on PATH and download failed)',
    };
  }

  return new Promise<ValidatorResult>((resolve) => {
    const child = spawn(binary, ['--format', 'json', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30_000,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', () => {
      resolve({
        path,
        status: 'skipped',
        violations: [],
        reason: `hadolint execution failed: ${stderr || 'unknown error'}`,
      });
    });

    child.on('close', (code) => {
      // hadolint exits 0 = no issues, 1 = issues found, other = error
      if (code !== null && code > 1) {
        resolve({
          path,
          status: 'skipped',
          violations: [],
          reason: `hadolint exited with code ${code}: ${stderr}`,
        });
        return;
      }

      const violations = parseHadolintOutput(stdout);

      resolve({
        path,
        status: violations.length > 0 ? 'fail' : 'pass',
        violations,
      });
    });

    // Write content to stdin and close — no temp files
    child.stdin.write(content);
    child.stdin.end();
  });
}
