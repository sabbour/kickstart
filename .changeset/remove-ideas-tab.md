---
"@aks-kickstart/web": patch
---

Remove the Playground "Ideas" tab.

The tab showed only 2 sparse github scenarios (core/azure/aks contributed none visibly) and every card rendered a permanent "Loading…" state because `/api/packs` intentionally strips scenario `a2ui` preview data over the wire. The feature was visually inconsistent with the Components tab and provided no usable signal. The tab entry, gallery panel, scenario detail dialog, and associated state/helpers have been removed. The default Playground tab is now **Create**. A follow-up issue tracks reintroducing curated, fully-rendered Playground ideas later.
