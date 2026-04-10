# Decision: Widget Inspiration Prompts — Dev/Deploy/Ops Focus

**Author:** Bender (Backend Dev)
**Date:** 2025-07-26
**Status:** Implemented
**Supersedes:** None

## Context

The widget inspiration system (Ideas tab in the Playground) was generating generic "chat-based AI assistant UX" component ideas. These were too vague for one-shot component generation and weren't aligned with Kickstart's focus on Kubernetes/AKS deployment operations.

## Decision

All widget inspiration prompts — LLM system prompts and hardcoded fallbacks — are now scoped exclusively to:
1. Kubernetes deployment and operations (rollouts, scaling, pod health, events, logs)
2. CI/CD pipelines and container workflows (GitHub Actions, image builds, registry scanning)
3. Cloud infrastructure monitoring (resource usage, cost tracking, SLOs, alerting)
4. Developer productivity for cloud-native apps (Helm releases, GitOps sync, secret management)

Prompts now include explicit instructions to specify A2UI component types, realistic sample data, interactions, and layout — enabling one-shot complete component generation.

The playground system prompt (`playground.ts`) now includes a worked example of a complete component to set the quality bar.

## Impact

- `widget-inspirations.ts` — Both streaming and non-streaming LLM prompts + 12 fallback ideas rewritten
- `playground.ts` — System prompt upgraded with one-shot design rules and worked example
- No API contract changes; temperature and token limits preserved
