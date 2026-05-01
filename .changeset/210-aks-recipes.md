---
"@aks-kickstart/pack-aks-automatic": minor
---

New `config/aks-recipes.json` provides structured per-shape AKS Automatic recipes (13 workload shapes) with detection signals, KEDA scaler configs, node-pool expectations, and cost band hints. Agents can now look up the right recipe for each workload shape instead of relying on prose.
