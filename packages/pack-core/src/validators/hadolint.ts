/**
 * Hadolint validator — lints Dockerfiles via stdin pipe.
 *
 * Binary resolution order:
 *   1. Check PATH for `hadolint`
 *   2. Download pinned release to node_modules/.cache on first use (with SHA256 verification)
 *   3. Graceful skip with reason if unavailable
 *
 * Security: content is piped to stdin — no temp files, no shell expansion.
 * Downloaded binary is SHA256-verified before execution (Zapp supply-chain requirement).
 */

import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, chmodSync, createWriteStream, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { get as httpsGet } from 'node:https';
import { createHash } from 'node:crypto';
import type { ValidatorResult, Violation } from './index.js';

const HADOLINT_VERSION = 'v2.12.0';
const HADOLINT_URL = `https://github.com/hadolint/hadolint/releases/download/${HADOLINT_VERSION}/hadolint-Linux-x86_64`;

/** SHA256 checksum of hadolint v2.12.0 Linux x86_64 binary — pinned for supply-chain integrity. */
export const HADOLINT_SHA256 = '56de6d5e5ec427e17b74fa48d51271c7fc0d61244bf5c90e828aab8362d55010';

/** Cache directory for downloaded binaries. */
function cacheDir(): string {
  return join(process.cwd(), 'node_modules', '.cache', 'kickstart-validators');
}

/** Attempt to find hadolint on PATH. */
export function findOnPath(): string | null {
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

/** Verify SHA256 checksum of a file. Returns true if it matches. */
export function verifySha256(filePath: string, expectedHash: string): boolean {
  try {
    const data = readFileSync(filePath);
    const hash = createHash('sha256').update(data).digest('hex');
    return hash === expectedHash;
  } catch {
    return false;
  }
}

/** Download hadolint to cache directory with checksum verification. Returns path or null on failure. */
async function downloadHadolint(): Promise<string | null> {
  const dir = cacheDir();
  const binaryPath = join(dir, 'hadolint');

  if (existsSync(binaryPath)) {
    if (verifySha256(binaryPath, HADOLINT_SHA256)) {
      return binaryPath;
    }
    // Cached binary failed checksum — remove and re-download
    try { unlinkSync(binaryPath); } catch { /* ignore */ }
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
          // Verify checksum before trusting the binary (Zapp supply-chain requirement)
          if (!verifySha256(binaryPath, HADOLINT_SHA256)) {
            try { unlinkSync(binaryPath); } catch { /* ignore */ }
            resolve(null);
            return;
          }
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

type HadolintDeps = {
  findOnPath: () => string | null;
  verifySha256: (filePath: string, expectedHash: string) => boolean;
  downloadHadolint: () => Promise<string | null>;
};

/** Resolve hadolint binary path: PATH (with SHA256 check) → cache → download → null. */
export async function resolveHadolint(
  deps: HadolintDeps = { findOnPath, verifySha256, downloadHadolint },
): Promise<string | null> {
  const onPath = deps.findOnPath();
  if (onPath) {
    // Never trust an unverified binary — even on PATH (Zapp supply-chain requirement)
    if (deps.verifySha256(onPath, HADOLINT_SHA256)) return onPath;
    // PATH binary failed checksum — fall through to cached/downloaded copy
  }

  return deps.downloadHadolint();
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

/**
 * Well-known hadolint rule → one-line fix hint mapping.
 * Keeps the UI actionable without piping raw wiki content.
 */
export const HADOLINT_FIX_HINTS: Record<string, string> = {
  DL3000: 'Use absolute WORKDIR paths.',
  DL3001: 'Do not use `apt-get upgrade` or `dist-upgrade` in Dockerfiles.',
  DL3002: 'Last USER should not be root.',
  DL3003: 'Use WORKDIR instead of `cd` to switch directories.',
  DL3004: 'Do not use sudo — the container already runs as root unless USER is set.',
  DL3006: 'Always tag the base image version explicitly.',
  DL3007: 'Pin the base image to a specific version tag (avoid `:latest`).',
  DL3008: 'Pin package versions in `apt-get install` (e.g., `curl=7.68.0-1ubuntu2`).',
  DL3009: 'Delete apt-get lists after install: `rm -rf /var/lib/apt/lists/*`.',
  DL3013: 'Pin pip package versions.',
  DL3015: 'Add `--no-install-recommends` to `apt-get install`.',
  DL3018: 'Pin apk package versions.',
  DL3020: 'Use COPY instead of ADD for local files.',
  DL3025: 'Use JSON notation for CMD and ENTRYPOINT (exec form).',
  DL3027: 'Do not use `apt`; use `apt-get` or `apt-cache` instead.',
  DL3028: 'Pin npm package versions in `npm install`.',
  DL3059: 'Combine multiple consecutive RUN instructions to reduce layers.',
  DL4006: 'Set `SHELL ["/bin/bash", "-o", "pipefail", "-c"]` before RUN with pipes.',
  SC2086: 'Double quote variables to prevent globbing and word splitting.',
};

/** Raw hadolint JSON output item. */
interface HadolintItem {
  line: number;
  code: string;
  message: string;
  level: string;
}

/**
 * Sanitize a violation message — cap length, strip control chars.
 * Prevents untrusted validator output from polluting agent/UI context (Zapp requirement).
 */
const MAX_MESSAGE_LENGTH = 256;
export function sanitizeMessage(msg: string): string {
  // Strip ANSI escape sequences and control characters
  const cleaned = msg.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return cleaned.length > MAX_MESSAGE_LENGTH
    ? cleaned.slice(0, MAX_MESSAGE_LENGTH) + '…'
    : cleaned;
}

/**
 * Parse hadolint JSON output into our Violation schema.
 * Includes fix hints for well-known rules and sanitizes messages.
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

  return items.map((item) => {
    const rule = item.code ?? 'unknown';
    const fix = HADOLINT_FIX_HINTS[rule];
    return {
      rule,
      severity: mapSeverity(item.level ?? 'info'),
      line: item.line ?? 0,
      message: sanitizeMessage(item.message ?? ''),
      ...(fix ? { fix } : {}),
    };
  });
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
        reason: `hadolint execution failed: ${sanitizeMessage(stderr || 'unknown error')}`,
      });
    });

    child.on('close', (code) => {
      // hadolint exits 0 = no issues, 1 = issues found, other = error
      if (code !== null && code > 1) {
        resolve({
          path,
          status: 'skipped',
          violations: [],
          reason: `hadolint exited with code ${code}: ${sanitizeMessage(stderr)}`,
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
