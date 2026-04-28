---
"@aks-kickstart/pack-core": patch
---

When the `core.triage` agent needs to ask about data sources on the Foundry inference path, it now emits a `RadioGroup` component (Documents, Websites, Business data, No external data) instead of asking in plain text prose. Users get clickable buttons rather than a free-text prompt.
