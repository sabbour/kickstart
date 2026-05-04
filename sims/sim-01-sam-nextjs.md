---
sim: sim-01
title: "Sam — Next.js greenfield (floor case)"
agent: core.triage
description: >-
  Sam has a single Next.js container. Rich context provided upfront.
  Expected: zero questions, immediate routing, R1 plan card, R17 close.

expected:
  toolCalls:
    ordered: true
    required:
      - name: core.emit_ui
        order: 0
  recipes:
    required:
      - R1
      - R17
  questionBudget:
    max: 0
  behaviors:
    - id: zero-questions
      description: >-
        Agent recognises sufficient context in the opening message and routes
        immediately with no clarifying questions (Question 0 floor case).
    - id: r17-close
      description: >-
        R17 "Where to next" closing card fires at the end of the conversation,
        replacing "let me know if you have questions".
  weights:
    toolCalls: 20
    recipes: 40
    questionBudget: 20
    behaviors: 20
---

# Sim #1 — Sam, Next.js Greenfield

## Scenario

**Persona:** Sam — intermediate developer, no Kubernetes experience.  
**Intent mode:** Greenfield → containerized-web → single-service track.  
**Key invariant:** "Sim #1 pattern" — rich context → confident action → zero questions.

## User Opener

> "I have a Next.js app I'd like to deploy to AKS Automatic. It's a single container,
> the repo is at github.com/sam/my-next-app, and I'm not too worried about cost."

## Expected Agent Behaviour

### Step 1 — Mode recognition

The agent must recognise `greenfield` mode from the opener. The user has provided:
- Target platform: AKS Automatic
- Workload shape: single Next.js container
- Repo location: github.com/sam/my-next-app
- No cost constraint

This is sufficient context to route immediately. **No questions should be asked.**

### Step 2 — Routing

Route to `aks.architect` with a typed Handoff Briefing v1 payload including:
- `mode: greenfield`
- `track: containerized_web`
- `constraintSpec: AKS_AUTOMATIC_V1_1_1`

### Step 3 — Required tool calls

| Tool | Purpose | Required |
|------|---------|---------|
| `core.emit_ui` | Render the R1 plan summary card | ✅ |

### Step 4 — Required recipes

| Recipe | Name | Required |
|--------|------|---------|
| R1 | Plan summary card (floor case — single container) | ✅ |
| R17 | Next-surface handover (closing card) | ✅ |

### Step 5 — Question budget

**Maximum questions: 0.**  
The agent must not ask any clarifying questions. If the agent asks even one question,
the question-budget criterion fails.

### Step 6 — Required behaviours

- **zero-questions**: Agent routes without asking any questions.
- **r17-close**: The R17 "Where to next" closing card is present in the conversation output.

## Golden Fixture

This is the floor-case sim — the simplest possible greenfield path. It validates the
"inference-first" principle: when the user provides sufficient context, the agent must
act confidently and immediately.

## Phase 1 Reviewer Checklist

- [ ] Agent asked 0 questions
- [ ] R1 plan card rendered (single-card layout, ≤5 concepts)
- [ ] R17 "Where to next" card present at conversation end
- [ ] Handoff briefing includes `constraintSpec: AKS_AUTOMATIC_V1_1_1`
- [ ] No bait-and-switch on compute platform (D1)
