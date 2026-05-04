---
"@aks-kickstart/harness": patch
---

Keep OpenAI strict-mode tool schemas object-shaped when Zod emits discriminated `oneOf` unions by safely rewriting provably-discriminated unions to `anyOf` before submission.

Unsupported or ambiguous `oneOf` schemas remain visible in conformance checks, and existing `anyOf` constraints keep their original conjunction semantics.
