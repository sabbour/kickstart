# Decision: Questionnaire schema conventions

**Date:** 2026-04-10
**Author:** Fry
**Context:** PR #66 review feedback

## Decision

1. **IDs in component schemas must use `z.string()`, not `DynamicStringSchema`** — IDs are used as React keys and state-map keys and must be stable literals. `DynamicStringSchema` allows data-bindings/function calls that can produce unstable values.

2. **All interactive components must expose `ActionSchema` callback props** (e.g., `onSubmit`, `onSelect`) instead of hard-coding event names. This is the established catalog convention (AzureLoginCard, RadioGroup, GitHubRepoPicker all follow it).

3. **Required-field validation must gate submit** — visual `*` markers without actual validation is a UX bug. Submit buttons should be disabled until all required fields pass.
