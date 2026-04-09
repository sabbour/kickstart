---
sidebar_position: 1
---

# Architecture Overview

Kickstart is a single-page application deployed as an Azure Static Web App with a managed functions backend that proxies to Azure OpenAI.

## System Components

```
┌─────────────────────────────────────────────────────────┐
│  Browser (SPA)                                          │
│  React 19 + Vite 6 + TypeScript                        │
│  A2UI v0.9 React Renderer                              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS (SSE)
┌────────────────────▼────────────────────────────────────┐
│  Azure Static Web App                                   │
│  ├─ Static hosting (React build)                        │
│  └─ Managed Functions (API)                             │
│       └─ /api/chat  →  Azure OpenAI proxy               │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────────────────────┐
│  Azure OpenAI Service                                   │
│  GPT models with structured JSON output                 │
└─────────────────────────────────────────────────────────┘
```

### Frontend

- **React 19** with TypeScript, bundled by **Vite 6**
- Deployed as the static content of an Azure Static Web App
- Uses the vendored **A2UI v0.9** React renderer to display structured AI output
- Fluent 2 design tokens for consistent Microsoft look and feel

### Backend

- **Azure Functions** (SWA managed functions) — no separate function app to deploy
- Single `/api/chat` endpoint that proxies conversation turns to Azure OpenAI
- Returns Server-Sent Events (SSE) for streaming responses

### AI Engine

- **Azure OpenAI** (GPT models) with a carefully crafted system prompt
- Outputs a **JSON envelope** containing both natural language and A2UI instructions
- The system prompt enforces the 6-phase conversation flow and progressive disclosure

### UI Rendering

- **A2UI v0.9** React renderer — vendored from Google's A2UI project
- `MessageProcessor` parses A2UI messages from the JSON envelope
- Creates and updates surfaces with interactive components
- 18 basic catalog components + 4 custom Kickstart components

### State Management

- **In-memory virtual filesystem** for generated artifacts (Dockerfile, manifests, etc.)
- **localStorage** for session persistence across page reloads
- No server-side session storage — all state lives in the browser

## Request Flow

```
User types message
    → React sends POST to /api/chat (with conversation history)
    → SWA Function proxies to Azure OpenAI (streaming)
    → Azure OpenAI returns JSON envelope chunks
    → Function streams back as SSE events:
        - "message" event  → text content
        - "a2ui" event     → A2UI instructions
        - "done" event     → stream complete
    → React processes SSE stream
    → MessageProcessor creates/updates A2UI surfaces
    → React renders surfaces with catalog components
```

Each conversation turn preserves the full message history, allowing the AI to maintain context across the 6-phase flow.
