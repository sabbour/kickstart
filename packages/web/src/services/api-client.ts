// Typed API client for the Kickstart backend
// Supports both streaming (SSE) and standard request modes

export interface ConversationRequest {
  sessionId?: string;
  message: string;
  stream?: boolean;
}

export interface ConversationResponse {
  sessionId: string;
  phase: string;
  message: string;
  a2ui?: unknown[];
  model?: string;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function converse(req: ConversationRequest): Promise<ConversationResponse> {
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
