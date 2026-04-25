---
"@aks-kickstart/web": patch
---

Fix A2UI surface ownership so updates render under the current assistant turn.

When the agent re-used a `shared:` A2UI surface across turns, the live
update rendered under the previous assistant bubble and the new bubble
stayed empty until the next user reply. `claimSurfaceIdsForAssistantMessage`
now transfers ownership to the current turn and strips the transferred
surfaceId from the prior bubble (in React state and the persisted session)
so the surface only renders once, in the right place.
