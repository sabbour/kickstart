/**
 * Azure authentication service.
 *
 * Provides helpers for reading Azure tokens from the session context and
 * constructing authenticated fetch headers for ARM API calls.
 *
 * Tokens are always read from the session context — NEVER from SSE events,
 * browser props, or environment variables at runtime.
 */
const ARM_AUDIENCE = 'https://management.azure.com';
/**
 * Reads the Azure ARM token from the session context.
 * Throws if no token is present (user must authenticate via azure:select_subscription first).
 */
export function getAzureToken(session) {
    const tokens = session?.tokens;
    const token = tokens?.['azure'] ?? tokens?.['azure-token'];
    if (!token) {
        throw new Error('No Azure access token found in session. ' +
            'Please authenticate first using the azure:select_subscription action.');
    }
    return token;
}
/**
 * Returns fetch headers for an authenticated ARM request.
 */
export function armAuthHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
    };
}
/**
 * Returns the ARM base URL.
 */
export function armBaseUrl() {
    return ARM_AUDIENCE;
}
/**
 * Builds a full ARM URL from a path and API version.
 */
export function armUrl(path, apiVersion) {
    return `${armBaseUrl()}${path}?api-version=${encodeURIComponent(apiVersion)}`;
}
/** ARM hosts that are permitted as LRO polling targets. */
export const ARM_POLLING_HOSTS = new Set([
    'management.azure.com',
    'management.usgovcloudapi.net',
    'management.chinacloudapi.cn',
    'management.microsoftazure.de',
]);
/**
 * Validates that an LRO polling URL uses HTTPS and targets a known ARM host.
 * Throws if the URL is invalid, non-HTTPS, or targets an unrecognised host.
 */
export function assertArmPollingUrl(url) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new Error(`Invalid LRO polling URL: ${url}`);
    }
    if (parsed.protocol !== 'https:') {
        throw new Error(`LRO polling URL must use HTTPS`);
    }
    if (!ARM_POLLING_HOSTS.has(parsed.hostname)) {
        throw new Error(`LRO polling URL host not in ARM allowlist: ${parsed.hostname}`);
    }
}
/**
 * Handles ARM LRO (Long-Running Operation) polling.
 * Polls Azure-AsyncOperation or Location header until the operation completes.
 */
export async function pollArmLro(operationUrl, token, options = {}) {
    assertArmPollingUrl(operationUrl);
    const maxAttempts = options.maxAttempts ?? 30;
    const intervalMs = options.intervalMs ?? 5_000;
    for (let i = 0; i < maxAttempts; i++) {
        await sleep(intervalMs);
        const resp = await fetch(operationUrl, {
            headers: armAuthHeaders(token),
            signal: AbortSignal.timeout(30_000),
        });
        if (!resp.ok) {
            throw new Error(`ARM LRO poll HTTP ${resp.status}: ${resp.statusText}`);
        }
        const data = (await resp.json());
        const status = data['status']?.toLowerCase();
        if (status === 'succeeded')
            return data;
        if (status === 'failed') {
            const errDetail = JSON.stringify(data['error'] ?? data);
            throw new Error(`ARM LRO failed: ${errDetail}`);
        }
        if (status === 'canceled') {
            throw new Error('ARM LRO was canceled');
        }
        // 'Running' or 'InProgress' — keep polling
    }
    throw new Error(`ARM LRO polling timed out after ${maxAttempts} attempts`);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=azure-auth.js.map