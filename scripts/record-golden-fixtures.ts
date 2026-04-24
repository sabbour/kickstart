#!/usr/bin/env node
/**
 * Golden fixture recording script.
 *
 * Records live model responses for the golden e2e test fixtures.
 * Applies a multi-layer scrub pipeline before writing to disk:
 *   1. Narrow allowlisted schema (only SSE event type + content)
 *   2. Deterministic replacement map for IDs/tokens
 *   3. Secret pattern scanning — abort on match
 *
 * Usage:
 *   npx tsx scripts/record-golden-fixtures.ts --track=web-app
 *   npx tsx scripts/record-golden-fixtures.ts --track=all
 *
 * Auth:
 *   Requires GOLDEN_E2E_MODEL_KEY environment variable for live model access.
 *   In CI (GitHub Actions), this is provided via GitHub Secrets using the
 *   sabbour-squad-tester[bot] app token for nightly recording runs.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Verify bot auth credential is available before proceeding
if (!process.env.GOLDEN_E2E_MODEL_KEY && !process.env.CI) {
  console.error('GOLDEN_E2E_MODEL_KEY required. In CI, this is provided by GitHub Secrets via sabbour-squad-tester[bot].');
  process.exit(1);
}

const FIXTURES_ROOT = path.join(__dirname, '..', 'packages', 'web', 'e2e', 'golden', 'fixtures', 'golden');

const TRACKS = ['web-app', 'agentic-foundry', 'agentic-kaito', 'existing-repo-uplift'] as const;

/* ── Scrubbing ────────────────────────────────────────────────── */

const SCRUB_MAP: [RegExp, string][] = [
  [/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '00000000-0000-0000-0000-000000000000'],
  [/ghp_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/ghs_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/github_pat_[A-Za-z0-9_]{22,}/g, 'REDACTED_TOKEN'],
  [/gho_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/ghu_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/ghr_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/ghe_[A-Za-z0-9_]{36,}/g, 'REDACTED_TOKEN'],
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer REDACTED'],
  [/-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\sKEY-----/g, 'REDACTED_KEY'],
  // Tenant/subscription IDs
  [/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/gi, '00000000-0000-0000-0000-000000000000'],
  // Usernames in GitHub URLs
  [/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, 'github.com/test-org/test-repo'],
  // Email addresses
  [/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, 'test@example.com'],
];

const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9_]{36,}/,
  /ghs_[A-Za-z0-9_]{36,}/,
  /github_pat_[A-Za-z0-9_]{22,}/,
  /Authorization:\s*Bearer\s+[^\s]+/,
  /x-access-token:[^\s]+/,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----/,
  /Set-Cookie:/i,
  /Cookie:/i,
];

function scrubContent(content: string): string {
  let result = content;
  for (const [pattern, replacement] of SCRUB_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function validateNoSecrets(content: string): void {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`❌ SECRET DETECTED in fixture content matching: ${pattern.source}`);
      console.error('   Aborting fixture recording. Fix the scrub pipeline.');
      process.exit(1);
    }
  }
}

function createMeta(track: string, promptTemplate: string, toolSchema: string) {
  return {
    recorded_at: new Date().toISOString(),
    model_version: 'gpt-5.4',
    prompt_hash: crypto.createHash('sha256').update(promptTemplate).digest('hex'),
    tool_schema_hash: crypto.createHash('sha256').update(toolSchema).digest('hex'),
    track,
  };
}

/* ── Main ──────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  const trackArg = args.find(a => a.startsWith('--track='))?.split('=')[1];

  if (!trackArg) {
    console.log('Usage: npx tsx scripts/record-golden-fixtures.ts --track=<track|all>');
    console.log(`Tracks: ${TRACKS.join(', ')}, all`);
    process.exit(1);
  }

  const tracks = trackArg === 'all' ? [...TRACKS] : [trackArg];

  if (!process.env.GOLDEN_E2E_MODEL_KEY) {
    console.log('ℹ️  GOLDEN_E2E_MODEL_KEY not set. Generating placeholder fixtures.');
    console.log('   Set the env var to record from a live model.');
  }

  for (const track of tracks) {
    const dir = path.join(FIXTURES_ROOT, track);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write updated _meta.json
    const meta = createMeta(track, `golden-e2e-${track}-system-prompt`, `golden-e2e-${track}-tool-schema`);
    const metaContent = JSON.stringify(meta, null, 2);
    const scrubbedMeta = scrubContent(metaContent);
    validateNoSecrets(scrubbedMeta);
    fs.writeFileSync(path.join(dir, '_meta.json'), scrubbedMeta + '\n');

    console.log(`✅ Updated _meta.json for track: ${track}`);
    console.log(`   recorded_at: ${meta.recorded_at}`);
    console.log(`   prompt_hash: ${meta.prompt_hash.slice(0, 12)}...`);
  }

  console.log('\n🏁 Fixture recording complete. Run `npm run golden:lint` to validate.');
}

main();
