---
"@aks-kickstart/harness": patch
---

fix: add retry/backoff for 429/500 errors and richer conversation threading with tool call persistence (#102, #103)

- `packages/harness/src/utils/retry.ts`: new `withRetry<T>` helper with exponential backoff + jitter for retryable HTTP errors (429/500/503). Non-retryable 4xx (400/401/403) fail immediately. `CircuitBreaker` class opens after 5 consecutive failures.
- `runner.ts`: wraps `sdkRunner.run()` with `withRetry` (max 3 attempts). Circuit breaker guards each run; `recordSuccess()`/`recordFailure()` called on every path.
- `runner.ts`: adds `callModelInputFilter` that truncates `function_call_result` items > 2000 chars with `[... truncated]` before each model call, preserving tool-run awareness while managing context budget.
- `runner.ts`: captures `function_call` and `function_call_result` raw items from `run_item_stream_event` and persists them via `session.recordToolCallRecord()`.
- `session.ts` / `types/session.ts`: adds `toolCallItems: ToolCallRecord[]` field (bounded sliding window of 200 pairs) and `recordToolCallRecord()` method.
- `toAgentInputItems()`: extended to append stored tool call/result pairs from `session.toolCallItems` so the model retains cross-turn tool context.
