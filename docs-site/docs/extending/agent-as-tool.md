---
sidebar_position: 7
---

# Agent as Tool (`asTool`)

The `asTool()` harness wrapper lets you expose any `Agent` as a callable **tool** that other agents can invoke for bounded, stateless specialist consultation. This is the mechanism that allows the triage agent to consult specialist agents (deployment, security, code review) without spawning a full-depth conversation thread.

## Quick Start

```typescript
import { asTool } from '@aks-kickstart/harness';
import { mySpecialistAgent } from './agents/specialist';

const consultTool = asTool(mySpecialistAgent, {
  toolName: 'consult_specialist',
  description: 'Ask the specialist agent a focused question. Returns a concise answer.',
});
```

Pass the resulting `ToolContribution` to your parent agent's tool list via the standard `ToolContribution` registry.

## API Reference

### `asTool(agent, options?): ToolContribution`

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent` | `Agent` | Any `@openai/agents` Agent instance |
| `options` | `AsToolOptions` | Optional configuration (see below) |

**Returns:** A `ToolContribution` with a single `{ query: string }` parameter that the parent LLM can call.

### `AsToolOptions`

```typescript
export interface AsToolOptions {
  /** Tool name exposed to the parent LLM. Defaults to the agent's name. */
  toolName?: string;

  /** Description sent to the parent LLM. Defaults to the agent's instructions summary. */
  description?: string;

  /**
   * Override the specialist agent's system prompt for this consultation.
   * The original agent is not mutated — a clone is created internally.
   */
  systemPromptOverride?: string;

  /**
   * Maximum turns the specialist agent may take when answering.
   * Defaults to AS_TOOL_MAX_TURNS_DEFAULT (5).
   */
  maxTurns?: number;
}
```

### `AS_TOOL_MAX_TURNS_DEFAULT`

The default `maxTurns` cap exported as a named constant:

```typescript
import { AS_TOOL_MAX_TURNS_DEFAULT } from '@aks-kickstart/harness';
// value: 5
```

Override per call via `options.maxTurns`.

## Behaviour

- **Non-streaming:** The specialist agent runs to completion and its final text is returned synchronously to the parent LLM.
- **Bounded:** Capped at `maxTurns` (default 5) to prevent runaway consultation chains.
- **Stateless:** No conversation history is passed to the specialist; each call starts fresh.
- **Non-mutating:** If `systemPromptOverride` is provided, `asTool` clones the agent internally. The original agent object is never modified.
- **Text extraction:** The wrapper prefers `AgentOutput.message` → `output_text` content blocks → JSON stringify fallback, so the parent LLM always receives a plain string.

## Example: Triage → Security Specialist

```typescript
import { asTool } from '@aks-kickstart/harness';
import { securityAgent } from '../agents/security';

// Expose the security agent as a tool the triage agent can call
const askSecurity = asTool(securityAgent, {
  toolName: 'ask_security',
  description:
    'Consult the security specialist about a user request that may involve secrets, ' +
    'credentials, or sensitive data. Returns a brief risk assessment.',
  maxTurns: 3,
});

// Register with triage agent's tool contributions
triageAgent.tools = [...triageAgent.tools, askSecurity];
```

## Architecture Note

`asTool` is Part 1 of the specialist consultation design (issue #130). Part 2 wires the triage agent to specific specialists via this mechanism. The wrapper is intentionally stateless — it does not thread conversation context into the specialist — because consultation queries are expected to be self-contained. If you need stateful multi-turn specialist interaction, use a full `runChain()` instead (see [Runner Chain](./runner-chain.md)).
