---
"@aks-kickstart/harness": patch
---

Migrate guardrail execution to SDK-native parallel pipeline (#116)

- Input and output guardrails now run via the OpenAI Agents SDK built-in
  parallel guardrail pipeline instead of the sequential custom loop
- Add `toSdkInputGuardrail()` and `toSdkOutputGuardrail()` adapter factories
  in guardrails.ts that wrap GuardrailContributions as SDK guardrail objects
- Attach SDK guardrails to Agent instances in `buildAgentInstance()`
- Remove sequential `runGuardrails('input')` / `runGuardrails('output')` blocks
  from runner.ts; tool-stage guardrails retain the sequential pipeline
- Catch `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`
  SDK exceptions and map them to `error` SSE events with `{ code: 'GUARDRAIL_BLOCK' }`
- Add `guardrail_warn` SSE event type for redact verdicts
- Update post-run logic to apply redacted text from guardrail result objects
