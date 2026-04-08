# Decision: Spark-like UX Evolution Roadmap for Kickstart

**Author:** Leela (Lead)
**Date:** 2025-07-25
**Status:** Proposed
**Requested by:** Ahmed Sabbour

## Context

Ahmed wants Kickstart to evolve toward a GitHub Spark-like experience. After reviewing 6 Spark screenshots and auditing our current codebase, here's my gap analysis and prioritized roadmap.

### Current State vs. Spark

| Spark Feature | Kickstart Today | Gap |
|---|---|---|
| Clean landing with hero text + input | Carousel + track cards + framework pills + IDE links | Small — our landing is richer, just needs a text input |
| Split-view: chat left, preview right | Chat left, file-viewer sidebar right (hidden until files exist) | Small — layout exists, needs polish |
| Progressive file generation in chat | Files appear in sidebar only; chat shows no file status | Medium — need in-chat file chips |
| Code view toggle | No code view — file viewer is read-only sidebar | Medium — need a toggle between "preview" and "code" |
| Tabs: Iterate, Theme, Data, Prompts, Assets | Phase stepper (Discover→Deploy) in chat header | Large — but not all tabs are relevant |
| Publish button with URL + visibility | No publish — deployment is GitHub Actions → AKS | Medium — different model, but a "Deploy" CTA is needed |
| Sparkle loading animation | Three-dot typing indicator | Small — cosmetic |
| Suggestion pills below hero input | Framework pills exist but below track cards | Small — reposition |

### Key Insight: Kickstart ≠ Spark

Spark generates full runnable apps and hosts them. Kickstart generates **infrastructure** (Bicep, Dockerfiles, Helm charts, GitHub Actions) and deploys **to AKS**. Our "preview" is the architecture diagram + deployment plan + generated IaC files — not a running app. The UX must reflect this.

## Proposal: Prioritized Increments

### P0 — Must-Have Now (Dramatic Impact, Low Effort)

These changes take our existing layout from "functional prototype" to "feels like Spark" with minimal code:

#### 1. Landing Page: Add Hero Text Input
- Add a prominent text input above the carousel: "Describe the app you want to deploy…"
- Move framework pills directly below the input as suggestion chips (like Spark's pills)
- Keep track cards below as secondary entry points
- This is the single biggest UX win — it makes the landing page feel like Spark's "Dream it" experience
- **Effort:** ~2 hours. Add `<input>` to `index.html`, style in `landing.css`, wire in `app.js`.

#### 2. In-Chat File Generation Chips
- When the engine generates files, show clickable file chips in the chat stream (not just in the sidebar)
- Each chip: file icon + filename + status indicator (generating → done)
- Clicking a chip opens that file in the sidebar viewer
- **Why P0:** This is the most recognizable Spark interaction pattern — seeing files appear progressively in the conversation
- **Effort:** ~4 hours. New CSS class in `components.css`, emit file events from engine, render in `app.js`.

#### 3. Sparkle/Pulse Loading Animation
- Replace the three-dot typing indicator with a branded sparkle or pulse animation
- Add a status label: "Generating architecture…", "Creating deployment plan…", phase-aware text
- **Effort:** ~2 hours. CSS animation in `components.css`, update `createChatUI` in `components.js`.

#### 4. Right Panel as "Preview" (Not Just File Viewer)
- Rename "Generated Files" → contextual title based on phase ("Architecture Plan", "Deployment Preview", "Generated Files")
- When the ArchitectureDiagram A2UI component fires, show it in the right panel instead of only in chat
- This makes the split-view feel like Spark's chat-left/preview-right pattern
- **Effort:** ~3 hours. Modify `file-viewer` to accept both files and A2UI preview content.

### P1 — Next Sprint (Completes the Vision)

#### 5. Code View Toggle
- Add a toggle button in the right panel header: "Preview" | "Code"
- Preview mode: shows the architecture diagram, deployment plan summary, or rendered markdown
- Code mode: shows the raw file tree + code editor (read-only), exactly like Spark's code view
- File tree on the left of the panel, code on the right (sub-split within the right panel)
- **Effort:** ~8 hours. New component in `components.js`, CSS layout work, state management.

#### 6. Deploy CTA Button
- Add a prominent "Deploy" button in the top bar (right side, next to user avatar)
- Disabled until the Review phase completes; pulses/highlights when ready
- Clicking opens a deploy dialog:
  - Target: AKS cluster selector (from user's subscriptions)
  - Status: progress indicators for each deployment step
  - Result: deployed URL, resource group link, "Open in Azure Portal" button
- Maps Spark's "Publish" to Kickstart's "Deploy to AKS" — different mechanics, same feeling of shipping
- **Effort:** ~12 hours. New dialog component, integration with deploy engine phase, backend API calls.

#### 7. Session Persistence + Recent/Favorites
- Spark shows recent apps on the landing page
- Implement session persistence (localStorage initially, API later)
- Show "Recent" section on landing page below the tracks
- **Effort:** ~6 hours. localStorage wrapper, landing page section, session restore logic.

### P2 — Later (Full Parity, Lower Priority)

#### 8. Workspace Tabs (Selective)
Not all Spark tabs make sense for Kickstart:

| Spark Tab | Kickstart Equivalent | Priority |
|---|---|---|
| Iterate | Chat (already exists) | — (done) |
| Theme | Not applicable — we generate infra, not UI | Skip |
| Data | Could map to "data sources" config in future | P2 |
| Prompts | System prompt inspector (already exists as debug toggle) | P2 — promote to a tab |
| Assets | Upload Dockerfiles, existing manifests, architecture docs | P2 |

If we add tabs, they'd be: **Iterate** (chat), **Files** (generated code), **Prompts** (system prompt viewer), **Assets** (upload existing config).

#### 9. "Open Codespace" / "Create Repository" Menu
- Spark's publish menu includes these. Kickstart already has the A2UI components (`CodespaceLink`, `RepoPicker`) but they're not wired to a menu.
- Add a dropdown menu on the Deploy button: "Deploy to AKS", "Create Repository", "Open Codespace"
- **Effort:** ~4 hours per menu item. Depends on GitHub OAuth being wired up.

#### 10. Mermaid Diagram Rendering in Preview
- Architecture diagrams currently render as text/A2UI. Render them as actual Mermaid SVGs in the preview panel.
- **Effort:** ~4 hours. Add mermaid.js CDN import, render in preview panel.

## Architecture Implications

### No Framework Change Required
All P0 and P1 work is achievable in vanilla JS with the existing Portal Prototyper pattern. No React needed. The component factory pattern in `components.js` handles everything.

### File Structure (New/Modified)
```
packages/web/
  index.html          — Add hero input, reorder landing sections
  css/landing.css     — Hero input styles, suggestion pills repositioning
  css/components.css  — File chips, sparkle animation, preview panel modes, deploy button
  js/app.js           — Hero input handler, file chip rendering, preview panel logic
  js/framework/
    components.js     — New: createFileChip(), createPreviewPanel(), createDeployDialog()
    a2ui-renderer.js  — Route ArchitectureDiagram to preview panel
```

### Event Bus Extensions
```
files:generating    — { filename, status: 'generating' }
files:generated     — { files } (already exists)
preview:show        — { type: 'diagram' | 'plan' | 'files', content }
deploy:ready        — { }
deploy:started      — { target }
deploy:progress     — { step, status }
deploy:complete     — { url, resourceGroup }
```

## Recommendation

**Ship P0 as a single PR.** It's ~11 hours of work and transforms the feel of the app. The hero input + file chips + sparkle loading + preview rename are all independent changes that can be developed in parallel by Fry (web) and reviewed by me.

**P1 is one sprint** (~26 hours). The deploy button is the centerpiece — it's what turns "generated files" into "deployed app" and that's the Kickstart value prop.

**P2 is backlog.** Tabs and Codespace integration depend on features we've already deferred (GitHub OAuth, MCP App UI).

## Consequences

- Landing page gains a direct text input — users can skip track selection entirely
- Chat becomes more visual with file chips, reducing reliance on the sidebar for file discovery
- Preview panel becomes a first-class citizen, not a hidden sidebar
- Deploy button creates a clear "call to action" that's missing today
- No new dependencies, no framework migration, no breaking changes
