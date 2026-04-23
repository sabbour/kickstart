---
'@aks-kickstart/harness': patch
---

Fix HTTP 404 "Resource not found" from Azure OpenAI on every `/api/converse` call (#932).

Root cause: `packages/harness/src/runtime/runner.ts` built the Azure OpenAI baseURL as
`{endpoint}/openai`, so the `@openai/agents` SDK resolved requests to
`/openai/chat/completions` — a path Azure OpenAI does not serve. Azure only exposes
chat completions under the legacy deployment path
(`/openai/deployments/{name}/chat/completions?api-version=...`) or the new
OpenAI-compatible v1 surface (`/openai/v1/chat/completions`).

Fix: `buildModelProvider()` now builds the baseURL as `{endpoint}/openai/v1`, which
makes the SDK hit `/openai/v1/chat/completions`. Trailing slashes on
`AZURE_OPENAI_ENDPOINT` are normalized. The Standard OpenAI fallback path
(when `AZURE_OPENAI_ENDPOINT` / `AZURE_OPENAI_API_KEY` are absent) is unchanged.
The Azure URL construction is now covered by unit tests.
