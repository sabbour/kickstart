/**
 * API client for the Kickstart conversation backend.
 *
 * Calls POST /api/converse with fetch (JSON) or streaming (SSE via ReadableStream).
 * Auto-retries on 429/503 with exponential backoff.
 *
 * @module api-client
 */

const DEFAULT_BASE_URL = '';
const STANDARD_TIMEOUT_MS = 30_000;
const STREAM_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Create an API client instance.
 * @param {Object} opts
 * @param {string} [opts.baseUrl=''] - Base URL for the API (empty = relative)
 * @returns {Object} API client with converse() and converseStream()
 */
export function createApiClient({ baseUrl = DEFAULT_BASE_URL } = {}) {
  const endpoint = `${baseUrl}/api/converse`;

  /**
   * Standard (non-streaming) conversation request.
   * @param {string|null} sessionId
   * @param {string} message
   * @returns {Promise<Object>} Response or structured error
   */
  async function converse(sessionId, message) {
    const body = JSON.stringify({
      ...(sessionId ? { sessionId } : {}),
      message,
    });

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), STANDARD_TIMEOUT_MS);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          lastError = { error: true, status: res.status, message: `Server returned ${res.status}` };
          continue;
        }

        if (!res.ok) {
          return errorResult(res.status, await safeText(res));
        }

        return await res.json();
      } catch (err) {
        lastError = errorFromException(err);
        if (!isNetworkError(err) || attempt >= MAX_RETRIES) {
          return lastError;
        }
      }
    }

    return lastError;
  }

  /**
   * Streaming conversation request using ReadableStream (NDJSON).
   * Falls back to standard converse() if streaming isn't supported.
   * @param {string|null} sessionId
   * @param {string} message
   * @param {Function} onChunk - (partialResponse) => void, called for each streamed chunk
   * @returns {Promise<Object>} Final assembled response or structured error
   */
  async function converseStream(sessionId, message, onChunk) {
    if (!window.ReadableStream) {
      return converse(sessionId, message);
    }

    const body = JSON.stringify({
      ...(sessionId ? { sessionId } : {}),
      message,
      stream: true,
    });

    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream, application/json',
          },
          body,
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (isRetryable(res.status) && attempt < MAX_RETRIES) {
          lastError = { error: true, status: res.status, message: `Server returned ${res.status}` };
          continue;
        }

        if (!res.ok) {
          return errorResult(res.status, await safeText(res));
        }

        // If the server responds with JSON (non-streaming), handle directly
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const result = await res.json();
          onChunk?.(result);
          return result;
        }

        // Stream NDJSON or SSE
        return await readStream(res, onChunk);
      } catch (err) {
        lastError = errorFromException(err);
        if (!isNetworkError(err) || attempt >= MAX_RETRIES) {
          return lastError;
        }
      }
    }

    return lastError;
  }

  /**
   * Check if the API is reachable. Useful for detecting demo-mode fallback.
   * @returns {Promise<boolean>}
   */
  async function healthCheck() {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${baseUrl}/api/converse`, {
        method: 'OPTIONS',
        signal: controller.signal,
      });
      clearTimeout(timer);
      // 2xx = endpoint exists and responds; 405 = endpoint exists but rejects OPTIONS.
      // 404 means the endpoint isn't deployed yet — treat as unavailable.
      return res.ok || res.status === 405;
    } catch {
      return false;
    }
  }

  return Object.freeze({ converse, converseStream, healthCheck });
}

// ── Internal helpers ────────────────────────────────────────────────────

async function readStream(res, onChunk) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assembled = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines (NDJSON or SSE "data:" lines)
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'event: message') continue;

        // Strip SSE "data: " prefix if present
        const jsonStr = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(jsonStr);
          assembled = mergeChunk(assembled, chunk);
          onChunk?.(assembled);
        } catch {
          // skip unparseable lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return assembled ?? { error: true, message: 'Empty stream response' };
}

function mergeChunk(prev, chunk) {
  if (!prev) return { ...chunk };

  return {
    ...prev,
    ...chunk,
    // Accumulate message text from deltas
    message: chunk.delta
      ? (prev.message || '') + chunk.delta
      : (chunk.message ?? prev.message),
    // Always take latest phase/a2ui/systemPrompt
    phase: chunk.phase ?? prev.phase,
    a2ui: chunk.a2ui ?? prev.a2ui,
    systemPrompt: chunk.systemPrompt ?? prev.systemPrompt,
  };
}

function isRetryable(status) {
  return status === 429 || status === 503;
}

function isNetworkError(err) {
  return err.name === 'AbortError' || err.name === 'TypeError' || err.message === 'Failed to fetch';
}

function errorResult(status, bodyText) {
  return {
    error: true,
    status,
    message: bodyText || `Request failed with status ${status}`,
  };
}

function errorFromException(err) {
  if (err.name === 'AbortError') {
    return { error: true, status: 0, message: 'Request timed out. The server may be slow to respond.' };
  }
  return { error: true, status: 0, message: err.message || 'Network error — check your connection.' };
}

async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
