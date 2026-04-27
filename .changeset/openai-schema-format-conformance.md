---
"@aks-kickstart/harness": patch
"@aks-kickstart/pack-core": patch
---

Catch OpenAI-unsupported JSON Schema `format` values during schema conformance tests and remove `format: "uri"` from `core.fetch_webpage`'s model-facing parameters.
