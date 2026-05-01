---
sidebar_position: 1
---

# Track-Flip Pattern

> **Status:** Documented · **Since:** v1.x · **Owner:** Triage Agent (`core.triage`)

## Overview

A **track-flip** occurs when a user changes their mind about which deployment track to use mid-conversation. For example, a user starts describing a "containerized web app" but then says "actually, I want an agentic app with KAITO." The triage agent must handle this gracefully — resetting stale state, re-routing to the correct track, and preserving any context that remains relevant.

## When It Triggers

The track-flip is detected by the triage agent when **any** of the following occur after an initial track has been selected:

| Signal | Example |
|--------|---------|
| **Explicit retraction** | "Actually, I want…", "Never mind, let's do…", "Switch to…" |
| **Contradictory requirements** | User picked `containerized_web` but now describes a model-backed agent workflow |
| **UI re-selection** | User clicks a different track in the `TrackPicker` component after one was already confirmed |
| **Inference mismatch** | Collected requirements no longer align with the active track (e.g., mentions KAITO, RAG, or tool-use on a `static_site` track) |

The triage agent evaluates these signals on **every user turn** as part of its standard mode-recognition loop (see `triage.agent.md` § Mode recognition).

## What Happens

When a track-flip is confirmed, the triage agent executes the following sequence:

### 1. Acknowledge the Change

Briefly confirm the switch to the user in plain language:

> "Got it — switching from Containerized Web App to Agentic AI App."

This prevents confusion and signals that no prior assumptions carry forward silently.

### 2. State Reset

The following state is **discarded** on a track-flip:

- Track-specific requirement slots (e.g., `imageSource`, `registry` for `containerized_web`)
- Any pending specialist handoff briefing that was being composed
- Track-specific UI surfaces (cards, radio groups) rendered on `shared:triage-main`

The 3-question cap counter is **not** reset by a track-flip within the triage phase; it resets only on a phase handoff, consistent with `triage.agent.md`.

### 3. Context Preservation

The following state is **preserved** across a track-flip:

| Preserved | Rationale |
|-----------|-----------|
| User's high-level goal / problem statement | Still relevant regardless of track |
| Recognized mode (`greenfield`, `iteration`, etc.) | Mode is orthogonal to track — a flip changes track, not mode |
| Repository inspection results (`core.inspect_repo`) | Repo facts don't change because the user changed their mind |
| Constraint-spec version (AKS Automatic v1.1.1) | Platform target is track-independent |
| Cost-shock state | Budget concern persists across tracks |

### 4. Re-Route

After reset, the triage agent re-enters the track-selection flow for the **new** track:

1. Applies the new track's `handoffPrimary` and `nextStep` from `config/tracks.json`.
2. Collects any track-specific requirements the new track needs (respecting the fresh 3-question cap).
3. Composes a new Handoff Briefing v1 payload targeting the correct specialist.

The re-route does **not** replay the user's original opener — it uses the accumulated preserved context plus the user's latest clarification as input.

## Where It Lives

| Artifact | Location |
|----------|----------|
| Detection + execution logic | `packages/pack-core/src/agents/triage.agent.md` (mode-recognition loop) |
| Track definitions | `config/tracks.json` |
| This documentation | `docs-site/docs/architecture/patterns/track-flip.md` |

## Design Decisions

- **No confirmation prompt before flipping.** If the user explicitly says "actually, switch to X," asking "are you sure?" adds friction with no value. The agent trusts explicit user intent.
- **Question cap resets.** The new track gets a fresh 3-question budget. Prior questions don't count against the new track since they gathered now-irrelevant information.
- **Mode is stable across flips.** A track-flip changes the _what_ (static site vs. agentic app) but not the _how_ (greenfield vs. iteration vs. bulk). The triage agent still runs mode recognition on every user turn, but a flip by itself should preserve the current mode unless the user's latest message provides new signals that warrant changing it.
- **UI surfaces are torn down.** Stale `TrackPicker` selections, `RadioGroup` choices, and `SummaryCard` outputs from the old track are cleared to avoid confusing the user with outdated context.

## Sequence Diagram

```
User                    Triage Agent                 Specialist
 │                           │                           │
 │── "build me a web API" ──►│                           │
 │                           │── track = containerized_web
 │                           │── collect requirements ──►│
 │◄── "what framework?" ────│                           │
 │── "Express, but wait…   ──►│                           │
 │    actually make it an     │                           │
 │    AI agent with KAITO" ──►│                           │
 │                           │── TRACK-FLIP DETECTED     │
 │                           │── reset containerized_web state
 │                           │── preserve: goal, mode, repo
 │                           │── track = agentic_app     │
 │◄── "Switching to Agentic  │                           │
 │     AI App." ─────────────│                           │
 │                           │── collect agentic reqs ──►│
 │                           │── handoff to aks.architect │
 │                           │                           │
```

## Related

- [Triage Agent prompt](https://github.com/azure-management-and-platforms/kickstart/blob/dev/packages/pack-core/src/agents/triage.agent.md)
- [Track definitions](https://github.com/azure-management-and-platforms/kickstart/blob/dev/config/tracks.json)
- [A2UI Integration](../a2ui-integration.md)
