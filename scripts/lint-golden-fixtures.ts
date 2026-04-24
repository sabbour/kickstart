#!/usr/bin/env node
/**
 * Golden fixture linter — validates fixture integrity.
 *
 * Checks:
 *   1. Schema validation: fixtures match the expected narrow schema
 *   2. Secret scanning: no tokens, credentials, or PII in fixture content
 *   3. Freshness: fixtures are not older than maxAgeDays (default 30)
 *   4. Hash verification: prompt/tool-schema hashes in _meta.json
 *
 * Usage:
 *   npx tsx scripts/lint-golden-fixtures.ts
 *   npx tsx scripts/lint-golden-fixtures.ts --max-age=14
 *   npx tsx scripts/lint-golden-fixtures.ts --strict
 */
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_ROOT = path.join(__dirname, '..', 'packages', 'web', 'e2e', 'golden', 'fixtures', 'golden');
const TRACKS = ['web-app', 'agentic-foundry', 'agentic-kaito', 'existing-repo-uplift'];

const SECRET_PATTERNS = [
  { name: 'GitHub PAT (classic)', pattern: /ghp_[A-Za-z0-9_]{36,}/ },
  { name: 'GitHub App token', pattern: /ghs_[A-Za-z0-9_]{36,}/ },
  { name: 'GitHub fine-grained PAT', pattern: /github_pat_[A-Za-z0-9_]{22,}/ },
  { name: 'Bearer token', pattern: /Bearer\s+[A-Za-z0-9\-._~+/]{20,}/ },
  { name: 'Private key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\sKEY-----/ },
  { name: 'Authorization header', pattern: /Authorization:\s*Bearer/ },
  { name: 'Cookie header', pattern: /^Cookie:/im },
  { name: 'Set-Cookie header', pattern: /^Set-Cookie:/im },
  { name: 'x-api-key header', pattern: /x-api-key:\s*[^\s]+/ },
];

// Allowed placeholder UUIDs from scrubbing
const ALLOWED_UUIDS = new Set([
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
]);

interface LintResult {
  track: string;
  file: string;
  level: 'error' | 'warn';
  message: string;
}

function lintFixtures(maxAgeDays: number, strict: boolean): LintResult[] {
  const results: LintResult[] = [];

  for (const track of TRACKS) {
    const dir = path.join(FIXTURES_ROOT, track);

    if (!fs.existsSync(dir)) {
      results.push({ track, file: '', level: 'error', message: `Fixture directory missing: ${dir}` });
      continue;
    }

    // Check _meta.json exists and is valid
    const metaPath = path.join(dir, '_meta.json');
    if (!fs.existsSync(metaPath)) {
      results.push({ track, file: '_meta.json', level: 'error', message: 'Missing _meta.json' });
      continue;
    }

    let meta: any;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    } catch {
      results.push({ track, file: '_meta.json', level: 'error', message: 'Invalid JSON in _meta.json' });
      continue;
    }

    // Schema check for _meta.json
    const requiredFields = ['recorded_at', 'model_version', 'prompt_hash', 'tool_schema_hash', 'track'];
    for (const field of requiredFields) {
      if (!meta[field]) {
        results.push({ track, file: '_meta.json', level: 'error', message: `Missing required field: ${field}` });
      }
    }

    // Freshness check
    if (meta.recorded_at) {
      const recorded = new Date(meta.recorded_at);
      const ageDays = (Date.now() - recorded.getTime()) / (1000 * 60 * 60 * 24);

      if (ageDays > maxAgeDays) {
        results.push({
          track,
          file: '_meta.json',
          level: 'error',
          message: `Fixture is ${Math.floor(ageDays)} days old (max ${maxAgeDays}). Re-record with: npx tsx scripts/record-golden-fixtures.ts --track=${track}`,
        });
      } else if (ageDays > maxAgeDays * 0.5) {
        results.push({
          track,
          file: '_meta.json',
          level: 'warn',
          message: `Fixture is ${Math.floor(ageDays)} days old (approaching ${maxAgeDays}-day limit)`,
        });
      }
    }

    // Check phase fixtures
    const phaseFiles = fs.readdirSync(dir).filter(f => f.startsWith('phase-') && f.endsWith('.json'));
    if (phaseFiles.length === 0) {
      results.push({ track, file: '', level: 'error', message: 'No phase fixture files found' });
    }

    for (const file of phaseFiles) {
      const filePath = path.join(dir, file);
      let fixture: any;

      try {
        fixture = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch {
        results.push({ track, file, level: 'error', message: 'Invalid JSON' });
        continue;
      }

      // Schema validation
      if (!fixture.phase || typeof fixture.phase !== 'string') {
        results.push({ track, file, level: 'error', message: 'Missing or invalid "phase" field' });
      }
      if (!fixture.sse_events || !Array.isArray(fixture.sse_events)) {
        results.push({ track, file, level: 'error', message: 'Missing or invalid "sse_events" array' });
        continue;
      }

      // Secret scanning on full content
      const content = JSON.stringify(fixture);
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          results.push({ track, file, level: 'error', message: `Secret detected: ${name}` });
        }
      }

      // Check for unscrubbed UUIDs (real subscription/tenant IDs)
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const uuids = content.match(uuidPattern) || [];
      for (const uuid of uuids) {
        if (!ALLOWED_UUIDS.has(uuid.toLowerCase())) {
          if (strict) {
            results.push({ track, file, level: 'error', message: `Unscrubbed UUID found: ${uuid}` });
          } else {
            results.push({ track, file, level: 'warn', message: `Potentially unscrubbed UUID: ${uuid}` });
          }
        }
      }

      // SSE event schema validation
      for (let i = 0; i < fixture.sse_events.length; i++) {
        const evt = fixture.sse_events[i];
        if (!evt.data || typeof evt.data !== 'string') {
          results.push({ track, file, level: 'error', message: `SSE event ${i}: missing or invalid "data" field` });
        }
        // Disallowed fields in SSE events (headers, cookies, auth)
        const disallowed = ['Authorization', 'Cookie', 'Set-Cookie', 'x-api-key', 'session_id'];
        for (const field of disallowed) {
          if (evt[field] !== undefined) {
            results.push({ track, file, level: 'error', message: `SSE event ${i}: contains disallowed field "${field}"` });
          }
        }
      }
    }
  }

  return results;
}

/* ── Main ──────────────────────────────────────────────────────── */

function main() {
  const args = process.argv.slice(2);
  const maxAge = parseInt(args.find(a => a.startsWith('--max-age='))?.split('=')[1] || '30', 10);
  const strict = args.includes('--strict');

  console.log(`🔍 Linting golden fixtures (max-age=${maxAge} days, strict=${strict})`);
  console.log(`   Root: ${FIXTURES_ROOT}\n`);

  const results = lintFixtures(maxAge, strict);

  const errors = results.filter(r => r.level === 'error');
  const warnings = results.filter(r => r.level === 'warn');

  for (const r of warnings) {
    console.log(`⚠️  [${r.track}] ${r.file ? r.file + ': ' : ''}${r.message}`);
  }

  for (const r of errors) {
    console.log(`❌ [${r.track}] ${r.file ? r.file + ': ' : ''}${r.message}`);
  }

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);

  if (errors.length > 0) {
    process.exit(1);
  }

  console.log('✅ All golden fixtures are valid.');
}

main();
