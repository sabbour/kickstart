---
'@kickstart/api': patch
'@kickstart/harness': patch
'@kickstart/pack-core': patch
'@kickstart/pack-azure': patch
'@kickstart/pack-aks-automatic': patch
'@kickstart/pack-github': patch
---

Fix API pack registry startup so bundled agent and skill assets resolve correctly in the built Functions bundle.
