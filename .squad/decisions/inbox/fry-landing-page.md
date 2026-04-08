# Decision: Landing page before chat

**Author:** Fry (Frontend Dev)
**Date:** 2025-07-26
**Status:** Accepted

## What

Added a landing page shown before the chat UI begins. Users pick a track (web-app or agentic-app) or a framework quick-start pill. The selection configures the engine before the conversation starts.

## Why

- Gives users a clear choice between web-app and agentic-app tracks (per D12)
- Framework pills skip the "which framework?" discovery question for users who already know
- Inspiration carousel introduces what Kickstart can do without requiring immediate input

## Details

- Landing page lives inside `.chat-main` and is removed on transition
- `body.on-landing` class hides the sessions sidebar toggle
- Engine accepts `track` and `preSelectedFramework` optional params
- LangChain Agent and RAG App auto-map to agentic-app track; all others to web-app
