/**
 * Fallback widget inspiration ideas for Playground
 *
 * These are client-side fallback ideas used when the API is unavailable.
 * Prompts intentionally instruct the LLM to use only core A2UI components
 * (Column, Row, Text, Table, Badge, Button, ProgressSteps, DecisionCard,
 * ChoicePicker, TextField, Toggle, Markdown, …) so responses can render
 * without pack-specific client renderers.
 *
 * The server owns the canonical list at
 * `packages/web/api/src/lib/widget-inspirations-data.ts` (exported as
 * `FALLBACK_IDEAS`). This client mirror MUST stay byte-for-byte equal —
 * the sync test at
 * `packages/web/api/src/lib/fallback-ideas-sync.test.ts`
 * enforces equality in CI.
 */
export interface WidgetIdea {
    title: string;
    subtitle: string;
    prompt: string;
}
export declare const FALLBACK_WIDGET_IDEAS: WidgetIdea[];
//# sourceMappingURL=fallback-ideas.d.ts.map