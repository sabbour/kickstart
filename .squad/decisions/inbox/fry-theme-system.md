### Decision: Theme System Architecture
**Author:** Fry (Frontend Dev)
**Date:** 2026-07-27
**Status:** Proposed (PR #129)
**Issue:** #42

**Context:** Theme customization system needed dark mode support with user preference persistence.

**Decisions:**
1. **Three-state ThemeMode** — `light | dark | system`. The `system` mode uses `matchMedia(prefers-color-scheme: dark)` and updates live when OS preference changes.
2. **resolvedTheme pattern** — Context exposes both `theme` (user choice) and `resolvedTheme` (actual light/dark). FluentProvider and CSS `data-theme` attribute use `resolvedTheme`.
3. **Default to system** — New users get OS-matching theme without action. Returning users get their saved preference from localStorage.
4. **Inline SVG icons** — ThemeToggle uses inline SVG (sun/moon/monitor) to avoid Fluent icon package dependency.

**Impact:** All components inheriting from FluentProvider automatically get themed tokens. CSS custom properties in theme.css continue to work via `data-theme` attribute on `<html>`.
