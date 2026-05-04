---
sim: sim-03
title: "Alex — scale-to-zero cold-start breakdown (R20)"
agent: core.triage
description: >-
  Alex is deploying a serverless-style Node.js API that scales to zero.
  Expected: R20 cold-start breakdown card, invisible-work list (R7),
  R17 close. Question budget ≤2.

expected:
  toolCalls:
    ordered: false
    required:
      - name: core.emit_ui
      - name: core.search_components
  recipes:
    required:
      - R7
      - R17
      - R20
  questionBudget:
    max: 2
  behaviors:
    - id: cold-start-card
      description: >-
        Agent emits the R20 cold-start breakdown card explaining scale-to-zero
        implications (KEDA, wake latency, probe tuning) before the plan card.
    - id: r17-close
      description: >-
        R17 "Where to next" closing card fires at the end of the conversation.
    - id: invisible-work-surface
      description: >-
        Agent surfaces the R7 "What I'm doing for you" card with items specific
        to this user's scale-to-zero setup (not generic boilerplate).
  weights:
    toolCalls: 15
    recipes: 45
    questionBudget: 20
    behaviors: 20
---

# Sim #3 — Alex, Scale-to-Zero Cold-Start Breakdown

## Scenario

**Persona:** Alex — startup founder, M2 persona (technical but no K8s expertise).  
**Intent mode:** Greenfield → containerized-web → single Node.js API that scales to zero.  
**Key invariant:** R20 cold-start breakdown fires; R7 invisible-work card is specific to
this user's situation; R17 closes.

## User Opener

> "I want to deploy a Node.js REST API to AKS. We handle spiky traffic — could scale
> to zero at night to save costs. I'm on a budget. No containers or K8s experience."

## Expected Agent Behaviour

### Step 1 — Mode recognition

The agent must recognise `greenfield` mode with additional signals:
- Scale-to-zero intent ("could scale to zero at night")
- Budget constraint present
- M2/M3 persona (no containers or K8s experience)

### Step 2 — Information gathering (≤2 questions)

The agent may ask up to 2 clarifying questions. Examples of valid questions:
- "What's your expected peak traffic?" (helps size KEDA triggers)
- "Do you have a Dockerfile already?"

The agent must NOT exceed 2 questions.

### Step 3 — Cold-start explanation before routing (R20)

Because scale-to-zero is in scope, the agent must emit the R20 cold-start
breakdown card **before or alongside** the plan card, covering:
- KEDA-based scale-to-zero (not built-in AKS Automatic scaling alone)
- Expected wake latency (typically 2–10 seconds for cold container starts)
- Readiness probe tuning to prevent premature traffic routing
- FutureYou door: "add caching / lazy init to reduce cold-start"

### Step 4 — Required tool calls

| Tool | Purpose | Required |
|------|---------|---------|
| `core.emit_ui` | Render R7 + R20 + plan cards | ✅ |
| `core.search_components` | Look up scale-to-zero / KEDA components | ✅ |

### Step 5 — Required recipes

| Recipe | Name | Required |
|--------|------|---------|
| R7 | "What I'm doing for you" (invisible work, M1/M2 persona) | ✅ |
| R17 | Next-surface handover (closing card) | ✅ |
| R20 | Cold-start breakdown for scale-to-zero | ✅ |

### Step 6 — Question budget

**Maximum questions: 2.**

### Step 7 — Required behaviours

- **cold-start-card**: R20 card present, covering KEDA/wake latency/probe tuning.
- **r17-close**: R17 "Where to next" card present.
- **invisible-work-surface**: R7 card items are specific to this user's scale-to-zero
  setup — not generic "setting up your cluster" boilerplate.

## Anti-Patterns to Flag

- **D1 violation**: Suggesting "use Azure Container Apps instead" to avoid cost concern.
  Agent must keep the user on AKS Automatic and address cost within the platform.
- **Generic R7**: R7 items like "setting up your cluster" without referencing the user's
  Node.js API, KEDA, or scale-to-zero specifics.
- **Missing R20**: Skipping the cold-start explanation when scale-to-zero is in scope.

## Phase 1 Reviewer Checklist

- [ ] ≤2 questions asked
- [ ] R20 cold-start card present (KEDA, wake latency, probe tuning)
- [ ] R7 "What I'm doing for you" card present with scale-to-zero specific items
- [ ] R17 "Where to next" card present at end
- [ ] No bait-and-switch to Container Apps (D1)
- [ ] FutureYou door in R17 references cold-start optimisation
