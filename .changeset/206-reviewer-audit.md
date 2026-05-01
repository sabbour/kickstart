---
"@aks-kickstart/pack-core": patch
---

The reviewer agent now cross-references generated artifacts against the Microsoft skills catalog (`config/microsoft-skills.json`), documents the codesmith→reviewer 3-turn wiring contract, and clarifies the review context it produces for downstream publishing flows. The scope boundary with `aks.reviewer` as the manifest/safeguards reviewer is explicitly documented.
