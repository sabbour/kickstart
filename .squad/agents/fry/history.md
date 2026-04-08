# Project Context

- **Owner:** Ahmed Sabbour
- **Project:** Imagine — AI-guided onboarding experience for deploying apps to AKS
- **Stack:** HTML/CSS/JS (Portal Prototyper framework), TypeScript, Azure/AKS
- **Created:** 2026-04-08

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### 2026-04-08 — packages/web scaffold created
- **Structure**: `packages/web/` contains `index.html`, `css/{theme,core,components}.css`, `js/{app,auth}.js`, `js/framework/{core,components,a2ui-renderer}.js`, `assets/{logo,favicon}.svg`, `package.json`, `staticwebapp.config.json`.
- **Framework pattern**: SPA router is hash-based (core.js `Router`), Navigation pane manager (`Navigation`), Breadcrumbs auto-generate from route path. All exported as ES modules.
- **Component factory pattern**: `createCopilotPanel()`, `createWizard()`, `createCard()`, `createCommandBar()`, `createCodeBlock()`, `createStatusBadge()` — all return DOM elements, not HTML strings.
- **A2UI renderer**: `renderA2UI(schema, ctx)` maps A2UI JSON types to DOM. Custom types registered: `ConversationPhase`, `CodeBlock`, `ResourcePicker`, `DeploymentProgress`, `ArchitectureDiagram`, `CostEstimate`, `HandoffCard`. Extensible via `registerRenderer()`.
- **Auth**: Uses existing Entra config (client ID `7a630e18...`, tenant `72f988bf...`). MSAL loaded via CDN. Auth module pattern: IIFE returning frozen API.
- **CSS tokens**: All colors/spacing/typography use CSS custom properties defined in `theme.css`. Base grid is 4px.
- **Zero build deps**: No npm install needed. Vanilla ES modules + CDN scripts only.
- **Local dev**: `npx serve .` from packages/web (port auto).
- **Copilot panel**: Right-side panel with phase indicator (Understand → Architect → Configure → Deploy), chat bubbles, typing indicator. `onSend` callback wires to conversation engine (placeholder for now).
- **Domain**: kickstart.prototypes.aks.azure.sabbour.me (staging), kickstart.aks.azure.com (future).
