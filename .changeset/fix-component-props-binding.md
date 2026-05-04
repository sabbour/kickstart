---
"@aks-kickstart/web": patch
"@aks-kickstart/pack-core": patch
---

fix(components): re-wrap pack-core renderers with web GenericBinder; align AuthCard schema with agent contract

- registerPackComponents: re-wrap core components with web's createReactComponent so GenericBinder resolves props before render (was: raw pass-through stored as impl.render, causing props=undefined crash for all rich components)
- AuthCard: add provider field to schema to match what agents emit; make title nullable/optional with default derived from provider; derive providerLabel from provider
- core-previews: fix AuthCard preview to pass provider + title + description
