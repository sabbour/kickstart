# Decision: Project board auto-assignment in triage pipeline

**Date:** 2026-04-14T13:04:54.232Z
**Author:** Bender (Backend Dev)
**Status:** Implemented

## Context

Issues created by Ahmed were not being added to the GitHub project board
(https://github.com/users/sabbour/projects/3) or assigned milestones.

## Decision

1. **Project board:** All three triage workflows (squad-triage, squad-heartbeat,
   squad-issue-assign) now add issues to the project board automatically using
   the GraphQL `addProjectV2ItemById` mutation via `COPILOT_ASSIGN_TOKEN`.

2. **Milestones:** NOT auto-assigned. Milestones require judgment (which release?
   which sprint?). The Lead must assign milestones during in-session triage per
   the new Triage Checklist in routing.md.

3. **Graceful fallback:** All project board operations are wrapped in try/catch --
   if the API call fails, the workflow logs a warning but does not fail.

## Affected Files

- `.github/workflows/squad-triage.yml`
- `.github/workflows/squad-heartbeat.yml`
- `.github/workflows/squad-issue-assign.yml`
- `.squad/routing.md`
