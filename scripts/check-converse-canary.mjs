/**
 * @file check-converse-canary.mjs
 * @description Smoke canary for the /api/converse endpoint.
 *
 * Verifies that the emit_ui tool registers cleanly under OpenAI strict-mode
 * validation. If the tool schema has $ref+description sibling violations the
 * tool registration fails and the FIRST event in the SSE stream is
 * `event: error` — this script will catch that and exit non-zero.
 *
 * Asserts:
 *   1. HTTP 200 response
 *   2. Content-Type is text/event-stream
 *   3. NO `event: error` line appears anywhere in the stream
 *   4. The stream terminates with `event: end`
 *
 * Environment variables:
 *   CONVERSE_URL          — full URL of the /api/converse endpoint (required)
 *   CONVERSE_ATTEMPTS     — retry attempts (default: 4)
 *   CONVERSE_DELAY_MS     — delay between retries in ms (default: 15000)
 *   CONVERSE_TIMEOUT_MS   — per-attempt timeout in ms (default: 30000)
 */

const url = process.env.CONVERSE_URL;
const attempts = Number.parseInt(process.env.CONVERSE_ATTEMPTS ?? '4', 10);
const delayMs = Number.parseInt(process.env.CONVERSE_DELAY_MS ?? '15000', 10);
const timeoutMs = Number.parseInt(process.env.CONVERSE_TIMEOUT_MS ?? '30000', 10);

if (!url) throw new Error('CONVERSE_URL is required');
if (!Number.isInteger(attempts) || attempts < 1)
  throw new Error(`Invalid CONVERSE_ATTEMPTS: ${process.env.CONVERSE_ATTEMPTS}`);
if (!Number.isInteger(delayMs) || delayMs < 0)
  throw new Error(`Invalid CONVERSE_DELAY_MS: ${process.env.CONVERSE_DELAY_MS}`);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1)
  throw new Error(`Invalid CONVERSE_TIMEOUT_MS: ${process.env.CONVERSE_TIMEOUT_MS}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run one canary attempt.
 * Returns null on success, error message string on failure.
 */
async function probe() {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ message: '__canary__ respond with a single plain text greeting' }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '(unreadable)');
    return `HTTP ${response.status} ${response.statusText}; body=${body}`;
  }

  const ct = response.headers.get('content-type') ?? '';
  if (!ct.startsWith('text/event-stream')) {
    return `Expected text/event-stream, got: ${ct}`;
  }

  // Read the SSE stream line by line.
  const reader = response.body?.getReader();
  if (!reader) return 'Response body is not readable';

  const decoder = new TextDecoder();
  let buffer = '';
  let sawEnd = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split('\n');
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'event: error') {
        await reader.cancel();
        return 'SSE stream contained event: error — tool registration may have failed';
      }
      if (trimmed === 'event: end') {
        sawEnd = true;
        // Drain remaining bytes but don't block indefinitely.
        reader.cancel().catch(() => {});
        break;
      }
    }
    if (sawEnd) break;
  }

  if (!sawEnd) {
    return 'SSE stream ended without event: end';
  }

  return null;
}

let lastFailure = 'No attempts were made.';

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`Attempt ${attempt}/${attempts}: POST ${url}`);
  try {
    const err = await probe();
    if (err === null) {
      console.log('✅ Converse canary passed');
      process.exit(0);
    }
    lastFailure = err;
  } catch (error) {
    lastFailure = error instanceof Error ? error.message : String(error);
  }

  console.log(`⚠️ Canary failed: ${lastFailure}`);
  if (attempt < attempts) {
    console.log(`Waiting ${delayMs}ms before retrying...`);
    await sleep(delayMs);
  }
}

throw new Error(
  `Converse canary never passed after ${attempts} attempts. Last failure: ${lastFailure}. ` +
    'If this follows a deploy, check that tool schema registration succeeds and /api/converse ' +
    'returns a valid SSE stream. Strict-mode $ref+description sibling violations will produce ' +
    'event: error as the first SSE frame.',
);
