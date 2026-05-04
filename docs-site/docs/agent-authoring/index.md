---
sidebar_position: 1
---

# Agent Authoring Guide

This section covers how to build and integrate agents — components that run their own LLM inference loop — inside the Kickstart harness.

Most contributors only need the [Pack Authoring Guide](/docs/extending). Read this section if you are:

- Adding a **new conversation phase** that requires a dedicated agent
- Embedding an **agent-as-tool** so one agent can delegate to another
- Building a **runner chain** for multi-step orchestration
- Working with **session tokens and resume** for long-running operations

## What is an agent in this context?

In Kickstart, an "agent" is any component that:

1. Holds its own system prompt
2. Makes LLM calls (directly or via the harness)
3. Produces a typed output that the harness can route to the next phase

The main conversation loop is itself an agent. Specialist agents (e.g., a dedicated "Deploy agent" or "Audit agent") are invoked by the harness when a typed handoff message arrives.

## Sections

- [Conversation Phases](/docs/extending/conversation-phases) — how phase transitions are defined and enforced
- [Agent as Tool](/docs/extending/agent-as-tool) — expose one agent as a callable tool for another
- [Runner Chain](/docs/extending/runner-chain) — sequence multiple agents in a pipeline
- [Session Tokens & Resume](/docs/extending/resume-and-session-token) — persist state across browser refreshes and long deployments
