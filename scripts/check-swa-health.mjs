const url = process.env.SWA_HEALTHCHECK_URL;
const attempts = Number.parseInt(process.env.SWA_HEALTHCHECK_ATTEMPTS ?? '8', 10);
const delayMs = Number.parseInt(process.env.SWA_HEALTHCHECK_DELAY_MS ?? '15000', 10);
const timeoutMs = Number.parseInt(process.env.SWA_HEALTHCHECK_TIMEOUT_MS ?? '10000', 10);
// When false, any 2xx response is treated as success (use for endpoints that return valid JSON
// but not the {"status":"ok"} envelope — e.g. /api/packs). Default: true (requires status=ok).
const requireJsonOk = (process.env.SWA_HEALTHCHECK_REQUIRE_JSON_OK ?? 'true') !== 'false';

if (!url) {
  throw new Error('SWA_HEALTHCHECK_URL is required');
}

if (!Number.isInteger(attempts) || attempts < 1) {
  throw new Error(`Invalid SWA_HEALTHCHECK_ATTEMPTS: ${process.env.SWA_HEALTHCHECK_ATTEMPTS ?? '(unset)'}`);
}

if (!Number.isInteger(delayMs) || delayMs < 0) {
  throw new Error(`Invalid SWA_HEALTHCHECK_DELAY_MS: ${process.env.SWA_HEALTHCHECK_DELAY_MS ?? '(unset)'}`);
}

if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
  throw new Error(`Invalid SWA_HEALTHCHECK_TIMEOUT_MS: ${process.env.SWA_HEALTHCHECK_TIMEOUT_MS ?? '(unset)'}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastFailure = 'No attempts were made.';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`Attempt ${attempt}/${attempts}: checking ${url}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const bodyText = await response.text();

    let body;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      body = null;
    }

    if (response.ok && (requireJsonOk ? body?.status === 'ok' : true)) {
      console.log(`✅ Health check passed with ${response.status} and body ${bodyText}`);
      process.exit(0);
    }

    lastFailure = `HTTP ${response.status} ${response.statusText}; body=${bodyText || '(empty)'}`;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }

  console.log(`⚠️ Health check failed: ${lastFailure}`);

  if (attempt < attempts) {
    console.log(`Waiting ${delayMs}ms before retrying...`);
    await sleep(delayMs);
  }
}

throw new Error(
  `SWA health probe never passed after ${attempts} attempts. Last failure: ${lastFailure}. ` +
    'If this follows a successful SWA deploy, confirm /api/health is anonymously routable and that every built API entrypoint imports cleanly at startup.',
);
