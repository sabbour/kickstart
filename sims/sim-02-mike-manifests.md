---
sim: sim-02
title: "Mike — raw manifest review (migration-readiness)"
agent: core.triage
description: >-
  Mike pastes raw Kubernetes YAML manifests and asks for a readiness review
  before moving to AKS Automatic. Expected: migration-readiness mode,
  route to aks.reviewer, R17 close, ReviewCard output.

expected:
  toolCalls:
    ordered: false
    required:
      - name: core.emit_ui
      - name: core.inspect_repo
  recipes:
    required:
      - R17
  questionBudget:
    max: 1
  behaviors:
    - id: migration-readiness-mode
      description: >-
        Agent recognises migration-readiness intent from the manifests presence
        and routes to aks.reviewer (not aks.architect).
    - id: r17-close
      description: >-
        R17 "Where to next" closing card fires at the end of the conversation.
    - id: review-card-emitted
      description: >-
        aks.reviewer emits structured ReviewCards (pass/warn/fail per workload)
        rather than freeform prose.
  weights:
    toolCalls: 15
    recipes: 35
    questionBudget: 20
    behaviors: 30
---

# Sim #2 — Mike, Raw Manifests (Migration-Readiness)

## Scenario

**Persona:** Mike — platform engineer, has existing Kubernetes manifests.  
**Intent mode:** Migration-readiness → route to `aks.reviewer` with
`azure-kubernetes-automatic-readiness` skill loaded.  
**Key invariant:** R18 cross-artifact dependency check fires; R17 closes.

## User Opener

> "I'm about to move our cluster to AKS Automatic. Here are our Deployment manifests
> for the api-service and worker-service. Can you tell me what we'd need to change?"
>
> *(User attaches raw YAML with two Deployment resources, no existing `.kickstart/state.json`)*

## Expected Agent Behaviour

### Step 1 — Mode recognition

The agent must recognise `migration-readiness` mode. Signals:
- User says "move our cluster to AKS Automatic"
- Attaches raw Kubernetes manifests (Deployment resources)
- No `.kickstart/state.json` present (not an iteration)

### Step 2 — Routing

Route to `aks.reviewer` with:
- `mode: migration-readiness`
- `skillIdsLoaded: [azure-kubernetes-automatic-readiness]`
- `constraintSpec: AKS_AUTOMATIC_V1_1_1`

The agent may call `core.inspect_repo` to confirm no `.kickstart/state.json` exists.

### Step 3 — Required tool calls

| Tool | Purpose | Required |
|------|---------|---------|
| `core.inspect_repo` | Confirm repo state (no state.json → not iteration) | ✅ |
| `core.emit_ui` | Render ReviewCard output | ✅ |

### Step 4 — Required recipes

| Recipe | Name | Required |
|--------|------|---------|
| R17 | Next-surface handover (closing card) | ✅ |

*Note: ReviewCard pattern is not a numbered recipe — it is the aks.reviewer's
native structured output. The R17 close is the measurable recipe invariant here.*

### Step 5 — Question budget

**Maximum questions: 1.**  
The agent may ask at most one clarifying question (e.g., "Are both services
containerised?"). It must not ask more.

### Step 6 — Required behaviours

- **migration-readiness-mode**: Agent routes to `aks.reviewer`, not `aks.architect`.
- **r17-close**: R17 "Where to next" closing card present.
- **review-card-emitted**: `aks.reviewer` produces structured ReviewCard(s) — not
  freeform prose.

## Cross-Artifact Note (R18)

The reviewer should check for cross-artifact dependencies between the Deployment
resources and any referenced Dockerfiles, Services, or HTTPRoute definitions.
If a Dockerfile is referenced by the Deployment image, R18 fires.

## Phase 1 Reviewer Checklist

- [ ] Agent routed to `aks.reviewer` (not `aks.architect`)
- [ ] `azure-kubernetes-automatic-readiness` skill loaded in handoff briefing
- [ ] ReviewCard(s) emitted per workload (structured table, not prose)
- [ ] PASS/WARN/FAIL per checklist item visible
- [ ] ≤1 question asked
- [ ] R17 "Where to next" card present at end
- [ ] R18 cross-artifact check noted if Dockerfile referenced
