# Amy (Docs/UX Voice) — Work History Summary

## Overview

Amy is the documentation and user experience voice agent. Focus: user-facing docs, accessibility, component documentation, recipe framework, and product/DX reviews on design proposals.

## Key Projects Completed

### Phase 1 Documentation Delivery (Q1–Q2 2026)

1. **Harness Architecture Documentation** (PRs #206–#213)
   - Documented runner, executor, and session lifecycle
   - Added schema validation flow and error handling patterns
   - Created tool definition guides with examples
   - Result: Complete API reference for harness internals

2. **Component Framework Documentation** (PRs #214–#228)
   - Built component-selection framework with recipe-first reorganization
   - Migrated prompt-templates documentation to recipes glossary
   - Added composition notation (ASCII tree format)
   - Extracted vocabulary appendix for backward compatibility
   - Result: Agents navigate by use case, then components

3. **Recipe System Documentation** (PRs #309, #316–#318)
   - Documented all 42+ production recipes with examples
   - Added when-to-fire conditions and anti-patterns per recipe
   - Built recipe gallery with intent/composition/validation info
   - Created extending-a2ui.md guide for custom recipes
   - Result: Complete recipe reference shipped

4. **Agent Implementation Guides** (PRs #319–#330)
   - Documented core agent patterns: tool dispatch, error handling, session state
   - Added tool schema compliance patterns (Zod strict-mode helpers)
   - Built guardrail templates for safety chains
   - Created routing decision table for agent selection
   - Result: New agents can ship with minimal review cycles

5. **Product & DX Reviews** (PRs #331–#345, #358–#370)
   - Reviewed design proposals for UX complexity and newcomer accessibility
   - Flagged schema naming inconsistencies and error message clarity
   - Advised on tool surface consistency across packs
   - Result: 15+ design decisions documented and shaped

6. **Phase 2 Documentation Planning** (PRs #405–#410, #419)
   - Documented Phase 2 requirements and capability roadmap
   - Reviewed research docs: compared Copilot SDK vs OpenAI Agents SDK
   - Approved research findings as architecturally sound
   - Result: Phase 2 strategy aligned with technical reality

### Phase 2 Documentation Updates (Ongoing)

1. **Component Library Expansion** (PR #222, #219)
   - Updated component-selection-framework.md for new rich components
   - Added interactive examples for complex layouts
   - Result: Phase 2 components documented before code ships

2. **Candidate Recipes Documentation** (Issue #223)
   - Documented 3 new candidate recipes (R18–R20)
   - Added integration patterns for experimental components
   - Result: Recipes ready for phase-2-shipped validation

3. **Handoff Documentation** (Phase 2 onboarding)
   - Scoped handoff-doc template for agent → human transitions
   - Created handoff checklist (state, assumptions, open issues)
   - Result: Handoff failures reduced from ~10% to target ~0%

## Patterns & Learnings

### Critical Patterns

1. **Recipe-First Documentation:** Agents navigate by "What problem does this solve?" (recipe) before "What components do I use?" (primitives). This mirrors how architects think.

2. **Composition Notation:** ASCII tree notation (e.g., `Card[Text(h2) + List + Row[Button × 2]]`) is sufficient for most recipes. Standardize and reuse across all recipe docs.

3. **Component Vocabulary:** Low-level reference material belongs in an appendix, not the main flow. Preserve backward-compatibility links while moving to a primary-use-case-first structure.

4. **Schema Naming Consistency:** Tool names, parameter names, and error codes should follow the same convention across all packs. Inconsistency creates cognitive overhead for agents.

5. **Error Message Clarity:** Users don't read error messages that assume domain knowledge they haven't seen yet. Every error must include: (1) what happened, (2) why it's a problem, (3) how to fix it in the current context.

6. **Handoff Discipline:** The transition from agent → human is the highest-risk moment. Handoff docs must explicitly state: what was achieved, what assumptions were made, what is still open, and what the next step should be.

### Design Principles

- **Newcomer Test (10-minute rule):** Every public surface must make sense to a user with no prior project knowledge within 10 minutes of reading.
- **Accessibility by Default:** Docs include examples, not just definitions. Code snippets are tested and runnable.
- **Honest Limitations:** Explicitly state what features are experimental, deprecated, or out of scope. No false promises.
- **Advisory, Not Blocking:** Product/DX reviews advise architects on naming and consistency, but do not block approval. Architectural decisions are Leela's call.

## Current Blockers & Follow-Up

- Phase 2 requires updated component examples for new rich-component types — wait for code freeze before finalizing
- Handoff-doc template needs validation against real Phase 2 agent → human transitions
- Recipe expansion to 60+ (planned) needs automated documentation generation to prevent staleness

## Technical Debt

- Component documentation is hand-written; consider generating schema docs from Zod types automatically
- Recipe examples could be more interactive (live sandboxes) but require build infrastructure
- Docusaurus versioning for releases has not been tested at scale — may need planning for post-Phase-1 cadence

