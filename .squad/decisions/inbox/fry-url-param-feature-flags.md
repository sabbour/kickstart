# Decision: URL-param Feature Flags for Dev/Test Modes

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-28
**Status:** Accepted

## Context

We needed a way to test A2UI rendering and the full conversation flow without a running backend. Also needed to fix the model indicator bug and unblock track card / framework pill submissions when no API is available.

## Decision

Use URL query parameters as feature flags:
- `?mock` — Activates mock streaming mode. Bypasses API health check, uses canned demo responses with simulated word-by-word typing. Model set to `gpt-5.3-chat (mock)`.
- `?playground` — Renders a standalone A2UI test harness page instead of the normal app. Lets you inject demo scenarios or paste raw A2UI JSON.
- Both can be combined with other params freely.

## Consequences

- Anyone can test the full conversation flow locally without Azure OpenAI credentials: just add `?mock` to the URL.
- A2UI component rendering can be verified independently with `?playground`.
- No build-time flags, no environment variables — works in any deployment.
- Mock mode intentionally uses `getDemoResponse()` from demo-scenarios.ts, so mock and playground share the same fixture data.
