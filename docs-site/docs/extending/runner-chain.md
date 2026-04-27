---
sidebar_position: 9
---

# Runner Chain (`runChain` / `runWithGate`)

The Kickstart runner supports **deterministic multi-step agent chains** — sequential pipelines where one agent's output is automatically piped as input to the next. This replaces the earlier voluntary-handoff pattern and ensures critical review steps cannot be skipped.

## Why Chains?

The previous pattern relied on the codesmith agent voluntarily handing off to the reviewer. In practice this meant:
- Review could be skipped if the LLM decided a handoff was unnecessary.
- There was no circuit-breaker to prevent runaway chains.

`runChain()` and `runWithGate()` make the review step **mandatory and deterministic**.

## API Reference

### `Runner.runChain(steps, options?)`

Runs an ordered list of `ChainStep` entries sequentially. Each step receives the previous step's output as its input.

```typescript
const result = await runner.runChain([
  { agent: codesmithAgent, input: userMessage },
  { agent: reviewerAgent },           // receives codesmith output automatically
  { agent: formatterAgent },          // receives reviewer output
]);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `steps` | `ChainStep[]` | Ordered list of agents to run |
| `options.maxSteps` | `number` | Circuit-breaker limit. Defaults to 10. |

Throws `ChainDepthExceeded` (error code `HARNESS_E002`) if the chain exceeds `maxSteps`.

---

### `Runner.runWithGate(generator, reviewer, input)`

A convenience two-step chain: runs `generator`, then pipes its output to `reviewer` and parses the verdict.

```typescript
const { output, verdict } = await runner.runWithGate(
  codesmithAgent,
  reviewerAgent,
  userMessage,
);

if (verdict === 'APPROVED') {
  // safe to use output
} else {
  // reviewer rejected — output contains the rejection reasoning
}
```

**Returns:** `{ output: string; verdict: 'APPROVED' | 'REJECTED' }`

---

### `parseGateVerdict(reviewerOutput)`

Conservative verdict parser used internally by `runWithGate`. Ambiguous or missing verdicts always resolve to `REJECTED`.

```typescript
import { parseGateVerdict } from '@aks-kickstart/harness';

const v = parseGateVerdict('APPROVED: looks good'); // 'APPROVED'
const v2 = parseGateVerdict('unclear response');     // 'REJECTED'
```

---

### `ChainDepthExceeded` Error

Thrown when a chain exceeds `maxSteps`. Error code: `HARNESS_E002`.

```typescript
import { ChainDepthExceeded } from '@aks-kickstart/harness';

try {
  await runner.runChain(steps, { maxSteps: 5 });
} catch (err) {
  if (err instanceof ChainDepthExceeded) {
    // chain was aborted — err.stepsCompleted tells you how far it got
  }
}
```

---

## How `run()` Uses `runWithGate`

After PR #147, the top-level `Runner.run()` method automatically applies a `runWithGate` chain for codesmith sessions:

1. The codesmith agent runs and produces a code artefact.
2. The reviewer agent runs with the codesmith output as its input.
3. If the reviewer returns `APPROVED`, the output is streamed to the client.
4. If the reviewer returns `REJECTED`, the rejection reason is returned and the user is prompted to revise.

**Agent prompt requirements:** The reviewer agent's system prompt must instruct it to respond with `APPROVED` or `REJECTED` as the first word of its verdict. The codesmith's prompt no longer needs voluntary-handoff instructions — the chain handles routing deterministically.

## Updating Agent Prompts for Chain Compatibility

If you are writing a reviewer agent, include this in its system prompt:

```
Start your response with APPROVED or REJECTED (uppercase).
Follow with your reasoning.
```

Codesmith-style agents do not need to change — they simply produce output and the chain wires the rest.

## Migration from Voluntary Handoffs

If you previously relied on `agent.handoffs` to route to a reviewer:

1. Remove the `handoffs` from the codesmith agent.
2. Use `runner.runWithGate(codesmith, reviewer, input)` at the call site instead.
3. The reviewer agent's verdict (`APPROVED`/`REJECTED`) is now your routing signal.
