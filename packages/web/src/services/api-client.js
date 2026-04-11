// Typed API client for the Kickstart backend
// Supports both streaming (SSE) and standard request modes
export async function healthCheck() {
    try {
        const res = await fetch('/api/health', {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
export async function converse(req) {
    const res = await fetch('/api/converse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
}
//# sourceMappingURL=api-client.js.map