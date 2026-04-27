---
"@aks-kickstart/harness": patch
"@aks-kickstart/pack-azure": patch
"@aks-kickstart/pack-aks-automatic": patch
"@aks-kickstart/pack-core": patch
"@aks-kickstart/pack-github": patch
---

fix: strict-mode schema violations in tool parameters, a2ui types, and credential access (#89, #91, #92)

### Issue #89 — Replace `.optional()` with `.nullable()` in tool parameter schemas (I2 fix)

All model-facing input schema fields that used `.optional()` (or `.nullable().optional()`)
now use `.nullable()` so every declared property appears in OpenAI's `required[]` array.

Files changed:
- `packages/pack-aks-automatic/src/tools/build-architecture-diagram.ts` — plan fields
- `packages/pack-aks-automatic/src/tools/validate-manifests.ts` — `manifestName`
- `packages/pack-aks-automatic/src/tools/validate-safeguards.ts` — `manifestName`
- `packages/pack-azure/src/tools/estimate-cost.ts` — `region`
- `packages/pack-azure/src/tools/pricing-lookup.ts` — `skuName`, `armRegionName`
- `packages/pack-azure/src/tools/propose-services.ts` — plan fields
- `packages/pack-azure/src/tools/validate-bicep.ts` — `templateName`
- `packages/pack-azure/src/tools/what-if.ts` — `parameters`, `deploymentName`
- `packages/pack-core/src/tools/scaffold_app.ts` — `clusterName`
- `packages/pack-github/src/tools/api-get.ts` — `params`

### Issue #91 — Replace inline credential casts with service helpers

- `packages/pack-azure/src/tools/arm-get.ts` — replaced inline double-cast with `getAzureToken()` + `armAuthHeaders()` from `azure-auth.ts`
- `packages/pack-github/src/services/github-auth.ts` — **new file**: `getGithubToken(session)` helper, mirrors `azure-auth.ts` pattern
- `packages/pack-github/src/tools/api-get.ts` — uses `getGithubToken()` from the new service

### Issue #92 — Fix `z.unknown()` and `.optional()` violations in `harness/src/types/a2ui.ts` (I2+I4 fix)

- Replaced `z.unknown()` with concrete types (`z.record(z.string(), z.unknown())` for records, `A2UIDataValueSchema` for scalars)
- Fields the model sends as `null` when absent use `.nullable()`; the `theme` field (not model-facing, always absent) uses `.nullish()`
- Removed `stripNulls()` call before `A2UIMessageSchema.parse()` in `emit_ui.ts` — null values from the model are now accepted directly by the harness schema
- Updated `emit_ui.test.ts` to reflect the new behavior: null siblings in action event payloads are preserved (not stripped)
