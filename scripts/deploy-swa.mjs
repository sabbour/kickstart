#!/usr/bin/env node
// Deploy to Azure Static Web Apps.
//
// On x64 machines: builds locally, then runs `swa deploy` (same pattern as
// portal-prototyper/deploy.sh — cd to a temp dir so swa-cli.config.json
// is not picked up).
//
// On arm64 (e.g. Apple Silicon WSL): StaticSitesClient has no arm64 binary,
// so we fall back to triggering the deploy-swa.yml GitHub Actions workflow.
//
// Usage:
//   npm run deploy              # auto-detects arch
//   npm run deploy -- --watch   # (arm64 only) tail the GitHub Actions run

import { spawnSync, execSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, arch } from 'node:os';
import { resolve, join } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const watch = process.argv.includes('--watch');

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, ...opts });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

// ── Architecture gate ────────────────────────────────────────────────
if (arch() !== 'x64') {
  console.log(`Detected ${arch()} — StaticSitesClient only ships linux-x64.`);
  console.log('Falling back to GitHub Actions deploy.\n');

  const branch = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: repoRoot, encoding: 'utf8',
  }).stdout?.trim() || 'main';

  console.log(`Triggering deploy-swa.yml on branch "${branch}"…`);
  run('gh', ['workflow', 'run', 'deploy-swa.yml', '--ref', branch]);
  console.log('\n✅ Workflow dispatched.');

  if (watch) {
    console.log('Waiting for run to appear…\n');
    spawnSync('sleep', ['5']);
    run('gh', ['run', 'watch', '--exit-status']);
  } else {
    console.log('Track progress: gh run list --workflow=deploy-swa.yml');
    console.log('Or rerun with: npm run deploy -- --watch');
  }
  process.exit(0);
}

// ── x64 local deploy ─────────────────────────────────────────────────
function resolveToken() {
  const env = process.env.SWA_DEPLOYMENT_TOKEN || process.env.AZURE_STATIC_WEB_APPS_API_TOKEN;
  if (env) return env;

  const name = process.env.SWA_NAME || 'kickstart-web-dev';
  const rg = process.env.SWA_RESOURCE_GROUP || 'rg-kickstart-dev';
  console.log(`Fetching deployment token via az (swa=${name}, rg=${rg})…`);
  const res = spawnSync(
    'az',
    ['staticwebapp', 'secrets', 'list', '--name', name, '--resource-group', rg, '--query', 'properties.apiKey', '-o', 'tsv'],
    { encoding: 'utf8' },
  );
  if (res.status !== 0) { console.error(res.stderr || res.stdout); return null; }
  return res.stdout.trim() || null;
}

const token = resolveToken();
if (!token) {
  console.error('Could not obtain deployment token. Export SWA_DEPLOYMENT_TOKEN or `az login`.');
  process.exit(1);
}

const appDist = resolve(repoRoot, 'packages/web/dist');
const apiDir = resolve(repoRoot, 'packages/web/api');

// 1. Full build.
run('npm', ['run', 'build']);

// 2. Vite production bundle.
run('npx', ['vite', 'build'], { cwd: resolve(repoRoot, 'packages/web') });

// 3. Stage API into a temp dir with its own node_modules (keeps workspace clean).
const stageDir = mkdtempSync(join(tmpdir(), 'kickstart-swa-api-'));
console.log(`\nStaging API in ${stageDir}`);
cpSync(apiDir, stageDir, {
  recursive: true,
  filter: (src) => !src.includes(join(apiDir, 'node_modules')),
});
const stagedPkgPath = join(stageDir, 'package.json');
const stagedPkg = JSON.parse(readFileSync(stagedPkgPath, 'utf8'));
delete stagedPkg.devDependencies;
writeFileSync(stagedPkgPath, JSON.stringify(stagedPkg, null, 2));
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--package-lock=false'], { cwd: stageDir });

if (!existsSync(appDist)) { console.error(`Missing ${appDist}`); process.exit(1); }
if (!existsSync(join(stageDir, 'dist'))) { console.error(`Missing ${stageDir}/dist`); process.exit(1); }

// 4. Deploy from a temp cwd (avoids swa-cli.config.json interference).
const deployCwd = mkdtempSync(join(tmpdir(), 'kickstart-swa-deploy-'));
run('swa', [
  'deploy', appDist,
  '--api-location', stageDir,
  '--api-language', 'node',
  '--api-version', '22',
  '--deployment-token', token,
  '--env', 'production',
  '--no-use-keychain',
], { cwd: deployCwd });

rmSync(stageDir, { recursive: true, force: true });
rmSync(deployCwd, { recursive: true, force: true });
console.log('\n✅ Deploy complete.');

console.log('\n✅ Deploy complete.');
