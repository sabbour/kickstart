---
"@aks-kickstart/pack-core": minor
"@aks-kickstart/web": minor
---

Promote 7 sim recipes to first-class rich components in `pack-core` (#231).

Adds `PlanSummary` (R1), `MigrationMappingTable` (R3), `DiffPlan` (R5),
`CostCard` (R16), `JobToBeDoneTable` (R8), `ReviewPack` (R9), and
`CompatibilityScorecard` (R12) as fully typed TSX components in
`packages/pack-core/src/components/rich/`.

Each component:
- Has a Zod-strict props schema derived from its recipe's data shape.
- Uses Fluent UI v9 primitives for consistent styling.
- Carries `data-testid="a2ui-{ComponentName}"` on the root element.
- Is registered in `corePack` and exported from `pack-core/src/index.ts`.
- Has a corresponding server-safe schema in `rich-component-schemas.ts`
  (registered in `RICH_COMPONENT_SCHEMAS` and documented in
  `RICH_COMPONENT_HINTS` for LLM guidance).

33 new schema-validation tests cover valid payloads, edge cases, and strict
key rejection for every component.
