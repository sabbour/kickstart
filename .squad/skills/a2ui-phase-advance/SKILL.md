# Skill: A2UI Phase-Advance Prompt Pattern

## When to use

Any agent prompt that uses `core.emit_ui` to present an interactive choice surface (buttons, radio groups, decision cards) and expects the user to select one option.

## Pattern

After the section that describes **how** to emit the choice surface, add a corresponding section that describes **what happens after the user selects**:

```markdown
## After user selects from [surface name]

When the user responds after you presented [surface name]:

1. **Do NOT re-emit [surface name].** The user has chosen.
2. Acknowledge the choice in one sentence.
3. Begin the next phase for the chosen path:
   - [Option A] → [next step for A]
   - [Option B] → [next step for B]
   - ...
4. Never present [surface name] again in this conversation.
```

## Why

Without an explicit post-selection rule, LLM agents re-apply the "present choices" instruction on every turn because the incoming user message (after a button click) looks like an ambiguous first-turn message. The agent has no instruction to treat it differently.

## Checklist

- [ ] Every `core.emit_ui` call site in the prompt has a matching "after user selects" section
- [ ] The post-selection section explicitly says "do NOT re-emit"
- [ ] Each option maps to a concrete next action (gather requirements, hand off, etc.)
- [ ] If the agent has handoffs, the post-selection section names which handoff applies to which option

## Origin

Discovered during #1062 investigation (triage loop bug). The triage agent's prompt described how to emit a 4-option intent menu but had no instruction for what to do after the user clicked a button.
