### 2026-04-24T12:59:10-07:00: User directive
**By:** Ahmed Sabbour (via Copilot)
**What:** Never leak tokens in checks. Do not run resolve-token.mjs as a bare command — always capture with $(...). This is a P1 governance rule (anti-pattern #1 in squad.agent.md).
**Why:** User request after observing a token leak in chat output — captured for team memory
