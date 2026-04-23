---
"@aks-kickstart/web": patch
---

Improve Playground Create-tab inspirations.

- Rewrite the `FALLBACK_IDEAS` list (now 10 varied ideas spanning Kubernetes rollouts, AKS, Azure cost, GitHub Actions, GitOps, secrets, scaling, logs) so prompts explicitly instruct the LLM to use only core A2UI components (Column, Row, Text, Table, Badge, Button, ProgressSteps, DecisionCard, ChoicePicker, TextField, Toggle, Markdown, …). This reduces `Component not available: _ErrorComponent` errors caused by responses referencing pack-namespaced types the client can't render.
- Strengthen the Azure OpenAI system prompt (streaming + JSON endpoints) with an explicit allow-list of valid component type names and an explicit ban on namespaced/pack components and Adaptive Cards primitives.
- Rotate the LLM focus domain on each request (round-robin over 8 areas) so consecutive clicks don't converge on the same "namespace operations" text.
- Avoid repeating the last-served fallback idea on both the server and the client.

Fixes the Sparkle inspire button serving near-identical prompts every click.
