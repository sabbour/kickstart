---
sidebar_position: 1
---

# Conversation Limits and Error Recovery

Kickstart enforces two runtime limits on conversations to ensure stability and reasonable token usage. When either limit is reached, the UI shows a recovery card rather than a raw error.

## MaxTurns: Conversation Limit Reached

The OpenAI Agents SDK limits the number of agent turns per `Runner.run()` call. If the agent reaches that limit without completing, a `MaxTurnsExceededError` is thrown.

**What the user sees:** A recovery card appears in the chat:

> **Conversation limit reached**  
> [Start New Conversation] _(links to `/`)_

The card replaces what would otherwise be a raw error message or empty response. The Debug panel still receives model and agent telemetry so developers can inspect what happened.

**What it means:** The agent took too many internal turns (tool calls, handoffs, reasoning loops) without producing a final response. This can happen with complex multi-step tasks or when an agent loops unexpectedly.

**What to do:**
- Click **Start New Conversation** and rephrase the request in a simpler, more focused way.
- If you are developing a custom agent and hitting this frequently, check your tool-call loop depth and reduce recursive patterns.

---

## Token Budget: History Trimming

Kickstart tracks approximate token usage in `session.recentTurns` using a `char/4` heuristic. When the accumulated history approaches **80% of the 128k context window** (~102,400 estimated tokens), older turns are trimmed from the front of the history.

**What the user sees:** A notification appears inline in the chat:

> _"Earlier parts of this conversation were trimmed to fit within context limits."_

This is informational — the conversation continues. The agent still has access to recent context; only the oldest turns are removed.

**Behaviour guarantees:**
- At least one turn is always retained, regardless of token count.
- Turns are removed from oldest to newest (FIFO trim from the front).
- The trim fires before `toAgentInputItems()` on each `Runner.run()` call.

**Constant reference:**

```typescript
import { TOKEN_TRIM_THRESHOLD } from '@aks-kickstart/harness';
// value: 102_400 (80% of 128k)
```

---

## Developer Notes

### Inspecting MaxTurns in the Debug Panel

When a `MaxTurnsExceededError` is caught, the runner emits an `end` event with model/agent telemetry before returning the recovery card. In the Debug panel (enable with `KICKSTART_DEBUG_ALLOWED=1`), you can inspect:
- Which agent was running when the limit was hit
- How many tool calls were made
- What the final incomplete agent output looked like

### Adjusting Turn Limits

The max-turns limit is set at the SDK level via the `RunConfig.maxTurns` parameter when building the agent. Increasing it may resolve `MaxTurnsExceededError` for complex legitimate workflows, but risks runaway loops. Check the agent prompt for unintentional looping behaviour before raising the limit.

### Adjusting the Token Trim Threshold

Override `TOKEN_TRIM_THRESHOLD` in your `BuildContext` if 102,400 is too conservative or too aggressive for your deployment's context window. Example for a 32k-window deployment:

```typescript
// ~80% of 32k
const CUSTOM_THRESHOLD = 25_600;
```
