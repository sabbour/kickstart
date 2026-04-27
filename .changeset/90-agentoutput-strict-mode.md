---
"@aks-kickstart/harness": patch
---

fix: replace .optional() in AgentOutput schema (I2 strict-mode fix, resolves Image 4 crash)

- Replace `.optional()` with `strictOptional()` (`.nullable()`) on `message` and `intent` fields
- All properties now appear in `required[]` — I2 violation eliminated
- `resolveOutputText()` updated to treat `null` message same as absent (strict-mode nulls)
- New tests cover strict-mode null payloads and I2 conformance assertion
