---
'@aks-kickstart/web': patch
---

Fix Playground Components tab rendering every preview as `_ErrorComponent`. The
`COMPONENT_PREVIEWS` map (added in #945) used pack-qualified ids (`core/Text`)
in descriptor `component` fields, but `clientRegistry` keys renderers by the
bare `impl.name` (`Text`). Every lookup missed and rendered the error fallback.
Descriptors now use bare names; map keys remain pack-qualified to match
`/api/packs` metadata. Adds a regression test asserting every preview resolves
through the sealed registry. (#954)
